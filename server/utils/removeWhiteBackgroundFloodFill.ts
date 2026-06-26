import sharp from 'sharp'

export type RemoveWhiteBackgroundFloodFillResult = {
  dataUrl: string
  transparentPixels: number
  width: number
  height: number
}

const channels = 4
const maxOutputPixels = 1024

const pixelIndex = (pixel: number): number => pixel * channels

const isNearWhiteBackground = (r: number, g: number, b: number, a: number): boolean => {
  if (a === 0) return false
  if (r >= 235 && g >= 235 && b >= 235) return true

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return r >= 225 && g >= 225 && b >= 225 && max - min <= 25
}

const enqueue = (queue: Int32Array, visited: Uint8Array, cursor: { tail: number }, pixel: number): void => {
  if (visited[pixel]) return
  visited[pixel] = 1
  queue[cursor.tail] = pixel
  cursor.tail += 1
}

const enqueueEdgePixels = (
  queue: Int32Array,
  visited: Uint8Array,
  width: number,
  height: number
): { tail: number } => {
  const cursor = { tail: 0 }

  for (let x = 0; x < width; x += 1) {
    enqueue(queue, visited, cursor, x)
    if (height > 1) enqueue(queue, visited, cursor, (height - 1) * width + x)
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(queue, visited, cursor, y * width)
    if (width > 1) enqueue(queue, visited, cursor, y * width + width - 1)
  }

  return cursor
}

export const removeWhiteBackgroundFloodFill = async (
  imageBuffer: Buffer
): Promise<RemoveWhiteBackgroundFloodFillResult> => {
  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .resize({
      width: maxOutputPixels,
      height: maxOutputPixels,
      fit: 'inside',
      withoutEnlargement: true
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  console.log('background removal input:', width, height)

  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  const cursor = enqueueEdgePixels(queue, visited, width, height)
  let transparentPixels = 0

  for (let head = 0; head < cursor.tail; head += 1) {
    const pixel = queue[head]
    const index = pixelIndex(pixel)
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    const a = data[index + 3]

    if (!isNearWhiteBackground(r, g, b, a)) continue

    data[index + 3] = 0
    transparentPixels += 1

    const x = pixel % width
    if (x < width - 1) enqueue(queue, visited, cursor, pixel + 1)
    if (x > 0) enqueue(queue, visited, cursor, pixel - 1)
    if (pixel + width < width * height) enqueue(queue, visited, cursor, pixel + width)
    if (pixel >= width) enqueue(queue, visited, cursor, pixel - width)
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
