export const hasMeaningfulTransparency = async (dataUrl: string): Promise<boolean> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image()
    nextImage.onload = () => resolve(nextImage)
    nextImage.onerror = () => reject(new Error('图片读取失败'))
    nextImage.src = dataUrl
  })

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return false

  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  context.drawImage(image, 0, 0)

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  let transparentPixels = 0

  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 250) transparentPixels += 1
  }

  return transparentPixels / (data.length / 4) > 0.01
}
