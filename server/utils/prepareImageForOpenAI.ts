import path from 'node:path'
import sharp from 'sharp'

type PreparedImage = {
  buffer: Buffer
  fileName: string
  mimeType: 'image/png'
}

const maxInputPixels = 1024

export const prepareImageForOpenAI = async (file: Express.Multer.File): Promise<PreparedImage> => {
  const fileName = `${path.parse(file.originalname || 'image').name || 'image'}.png`
  const buffer = await sharp(file.buffer)
    .rotate()
    .resize({
      width: maxInputPixels,
      height: maxInputPixels,
      fit: 'inside',
      withoutEnlargement: true
    })
    .png()
    .toBuffer()

  return {
    buffer,
    fileName,
    mimeType: 'image/png'
  }
}
