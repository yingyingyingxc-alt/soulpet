import OpenAI, { toFile } from 'openai'
import { characterBackgroundRemovalPrompt } from '../prompts/characterBackgroundRemovalPrompt'
import { petGenerationPrompt } from '../prompts/petGenerationPrompt'
import { mapOpenAIError } from '../services/openaiError'
import { prepareImageForOpenAI } from '../utils/prepareImageForOpenAI'
import { withRetry } from '../utils/retry'
import { createProviderError, toDataUrl, type ImageProvider, type ImageProviderInput, type ImageProviderResult } from './imageProvider'

const getClient = (): OpenAI => {
  if (!process.env.OPENAI_API_KEY) {
    throw createProviderError('OPENAI_API_KEY_MISSING', '请先配置 OPENAI_API_KEY。')
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const getModel = (): string => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5'

const editImage = async (
  input: ImageProviderInput,
  prompt: string,
  quality: 'medium' | 'high',
  fallbackCode: string,
  fallbackMessage: string
): Promise<ImageProviderResult> => {
  const model = getModel()
  const client = getClient()

  try {
    const preparedImage = await prepareImageForOpenAI(input.file)
    const result = await withRetry(async () =>
      client.images.edit({
        model,
        image: await toFile(preparedImage.buffer, preparedImage.fileName, {
          type: preparedImage.mimeType
        }),
        prompt,
        background: 'transparent',
        output_format: 'png',
        quality,
        size: '1024x1024',
        n: 1,
        input_fidelity: 'high'
      } as never)
    )

    const imageBase64 = result.data?.[0]?.b64_json
    if (!imageBase64) throw new Error('图片服务没有返回图片。')

    return {
      image: toDataUrl(imageBase64),
      model,
      requestId: result._request_id || crypto.randomUUID()
    }
  } catch (error) {
    const mapped = mapOpenAIError(error, fallbackCode, fallbackMessage)
    throw Object.assign(new Error(mapped.message), mapped)
  }
}

export const openaiImageProvider: ImageProvider = {
  generatePetChibi(input) {
    return editImage(input, petGenerationPrompt, 'medium', 'IMAGE_GENERATION_FAILED', 'Q 版 SoulPet 生成失败。')
  },
  removeCharacterBackground(input) {
    return editImage(input, characterBackgroundRemovalPrompt, 'high', 'BACKGROUND_REMOVAL_FAILED', '智能抠图失败。')
  }
}
