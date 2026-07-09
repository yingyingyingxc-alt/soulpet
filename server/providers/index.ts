import type { ImageProvider } from './imageProvider'

export const getImageProviderName = (): string => process.env.IMAGE_AI_PROVIDER || 'volcengine'

export const getImageProvider = async (): Promise<ImageProvider> => {
  const providerName = getImageProviderName()

  if (providerName === 'openai') {
    const { openaiImageProvider } = await import('./openaiImageProvider')
    return openaiImageProvider
  }

  const { volcengineImageProvider } = await import('./volcengineImageProvider')
  return volcengineImageProvider
}
