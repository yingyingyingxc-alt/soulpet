export type ImageProviderInput = {
  file: Express.Multer.File
  name?: string
  personality?: string
  source?: string
}

export type ImageProviderResult = {
  image: string
  model: string
  requestId: string
}

export type ImageProvider = {
  generatePetChibi(input: ImageProviderInput): Promise<ImageProviderResult>
  removeCharacterBackground(input: ImageProviderInput): Promise<ImageProviderResult>
}

export const toDataUrl = (base64: string): string => {
  if (base64.startsWith('data:image/')) return base64
  return `data:image/png;base64,${base64}`
}

export const createProviderError = (
  code: string,
  message: string,
  status = 400
): Error & { code: string; status: number } =>
  Object.assign(new Error(message), {
    code,
    status
  })
