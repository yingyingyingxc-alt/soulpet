import type sharpType from 'sharp'

let sharpInstance: typeof sharpType | undefined

export const loadSharp = async (): Promise<typeof sharpType> => {
  if (!sharpInstance) {
    const sharpModule = await import('sharp')
    sharpInstance = sharpModule.default
    sharpInstance.cache(false)
    sharpInstance.concurrency(1)
  }

  return sharpInstance
}
