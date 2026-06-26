import { openaiImageProvider } from './openaiImageProvider'
import { volcengineImageProvider } from './volcengineImageProvider'
import type { ImageProvider } from './imageProvider'

export const getImageProviderName = (): string => process.env.IMAGE_AI_PROVIDER || 'volcengine'

export const getImageProvider = (): ImageProvider => {
  const providerName = getImageProviderName()

  if (providerName === 'openai') {
    return openaiImageProvider
  }

  return volcengineImageProvider
}
