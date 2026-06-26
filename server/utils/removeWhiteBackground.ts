import sharp from 'sharp'

type Rgba = {
  r: number
  g: number
  b: number
  a: number
}

const whiteThreshold = 240
const edgeSampleSize = 12
const colorTolerance = 42

const isWhiteLike = (pixel: Rgba): boolean =>
  pixel.a > 0 && pixel.r > whiteThreshold && pixel.g > whiteThreshold && pixel.b > whiteThreshold

const colorDistance = (pixel: Rgba, background: Rgba): number =>
  Math.sqrt(
    (pixel.r - background.r) ** 2 +
      (pixel.g - background.g) ** 2 +
      (pixel.b - background.b) ** 2
  )

const getPixel = (buffer: Buffer, index: number): Rgba => ({
  r: buffer[index],
  g: buffer[index + 1],
  b: buffer[index + 2],
  a: buffer[index + 3]
})

const getIndex = (x: number, y: number, width: number): number => (y * width + x) * 4

const detectBackgroundColor = (buffer: Buffer, width: number, height: number): Rgba => {
  const samples: Rgba[] = []
  const maxX = width - 1
  const maxY = height - 1
  const corners = [
    [0, 0],
    [Math.max(0, maxX - edgeSampleSize + 1), 0],
    [0, Math.max(0, maxY - edgeSampleSize + 1)],
    [Math.max(0, maxX - edgeSampleSize + 1), Math.max(0, maxY - edgeSampleSize + 1)]
  ]

  for (const [startX, startY] of corners) {
    for (let y = startY; y < Math.min(height, startY + edgeSampleSize); y += 1) {
      for (let x = startX; x < Math.min(width, startX + edgeSampleSize); x += 1) {
        const pixel = getPixel(buffer, getIndex(x, y, width))
        if (isWhiteLike(pixel)) samples.push(pixel)
      }
    }
  }

  if (!samples.length) return { r: 255, g: 255, b: 255, a: 255 }

  const sum = samples.reduce(
    (total, pixel) => ({
      r: total.r + pixel.r,
      g: total.g + pixel.g,
      b: total.b + pixel.b,
      a: total.a + pixel.a
    }),
    { r: 0, g: 0, b: 0, a: 0 }
  )

  return {
    r: Math.round(sum.r / samples.length),
    g: Math.round(sum.g / samples.length),
    b: Math.round(sum.b / samples.length),
    a: Math.round(sum.a / samples.length)
  }
}

export const removeWhiteBackground = async (imageBuffer: Buffer): Promise<Buffer> => {
  const image = sharp(imageBuffer).rotate().ensureAlpha()
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const background = detectBackgroundColor(data, width, height)
  const visited = new Uint8Array(width * height)
  const queue: Array<[number, number]> = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1]
  ]

  const shouldRemove = (x: number, y: number): boolean => {
    const pixel = getPixel(data, getIndex(x, y, width))
    return isWhiteLike(pixel) && colorDistance(pixel, background) <= colorTolerance
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [x, y] = queue[cursor]
    if (x < 0 || y < 0 || x >= width || y >= height) continue

    const visitedIndex = y * width + x
    if (visited[visitedIndex]) continue
    visited[visitedIndex] = 1

    if (!shouldRemove(x, y)) continue

    const pixelIndex = getIndex(x, y, width)
    data[pixelIndex + 3] = 0

    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer()
}
