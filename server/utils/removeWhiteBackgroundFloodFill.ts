import sharp from 'sharp'

export type RemoveWhiteBackgroundFloodFillResult = {
  dataUrl: string
  transparentPixels: number
  width: number
  height: number
}

const channels = 4

const pixelIndex = (x: number, y: number, width: number): number => (y * width + x) * channels

const isNearWhiteBackground = (r: number, g: number, b: number, a: number): boolean => {
  if (a === 0) return false
  if (r >= 235 && g >= 235 && b >= 235) return true

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return r >= 225 && g >= 225 && b >= 225 && max - min <= 25
}

const enqueueEdgePixels = (width: number, height: number): Array<[number, number]> => {
  const queue: Array<[number, number]> = []

  for (let x = 0; x < width; x += 1) {
    queue.push([x, 0])
    if (height > 1) queue.push([x, height - 1])
  }

  for (let y = 1; y < height - 1; y += 1) {
    queue.push([0, y])
    if (width > 1) queue.push([width - 1, y])
  }

  return queue
}

export const removeWhiteBackgroundFloodFill = async (
  imageBuffer: Buffer
): Promise<RemoveWhiteBackgroundFloodFillResult> => {
  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  console.log('background removal input:', width, height)

  const visited = new Uint8Array(width * height)
  const queue = enqueueEdgePixels(width, height)
  let transparentPixels = 0

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [x, y] = queue[cursor]
    if (x < 0 || x >= width || y < 0 || y >= height) continue

    const visitedIndex = y * width + x
    if (visited[visitedIndex]) continue
    visited[visitedIndex] = 1

    const index = pixelIndex(x, y, width)
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    const a = data[index + 3]

    if (!isNearWhiteBackground(r, g, b, a)) continue

    data[index + 3] = 0
    transparentPixels += 1

    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  const pngBuffer = await sharp(data, { raw: { width, height, channels } }).png().toBuffer()

  console.log('background removal transparent pixels:', transparentPixels)
  console.log('background removal output: png')

  return {
    dataUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`,
    transparentPixels,
    width,
    height
  }
}
