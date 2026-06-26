import sharp from 'sharp'

export type RemoveGreenScreenBackgroundResult = {
  dataUrl: string
  transparentPixels: number
  width: number
  height: number
}

const channels = 4

const pixelIndex = (x: number, y: number, width: number): number => (y * width + x) * channels

const isGreenScreenPixel = (r: number, g: number, b: number, a: number): boolean =>
  a > 0 && g > 180 && r < 120 && b < 140 && g - r > 80 && g - b > 60

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

export const removeGreenScreenBackground = async (
  imageBuffer: Buffer
): Promise<RemoveGreenScreenBackgroundResult> => {
  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  console.log('green screen removal input:', width, height)

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

    if (!isGreenScreenPixel(r, g, b, a)) continue

    data[index + 3] = 0
    transparentPixels += 1

    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  const pngBuffer = await sharp(data, { raw: { width, height, channels } }).png().toBuffer()

  console.log('green screen removal transparent pixels:', transparentPixels)
  console.log('green screen removal output: png')

  return {
    dataUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`,
    transparentPixels,
    width,
    height
  }
}
