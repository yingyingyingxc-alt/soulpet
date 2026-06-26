import OpenAI, { toFile } from 'openai'
import { petGenerationPrompt } from '../prompts/petGenerationPrompt'
import { prepareImageForOpenAI } from '../utils/prepareImageForOpenAI'
import { withRetry } from '../utils/retry'
import { mapOpenAIError } from './openaiError'

export const generateRealPetChibi = async (
  file: Express.Multer.File
): Promise<{ generatedPetImage: string; model: string; requestId: string }> => {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('请先配置 OPENAI_API_KEY。'), {
      code: 'OPENAI_API_KEY_MISSING',
      status: 400
    })
  }

  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5'
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const preparedImage = await prepareImageForOpenAI(file)
    const result = await withRetry(async () =>
      client.images.edit({
        model,
        image: await toFile(preparedImage.buffer, preparedImage.fileName, { type: preparedImage.mimeType }),
        prompt: petGenerationPrompt,
        background: 'transparent',
        output_format: 'png',
        quality: 'medium',
        size: '1024x1024',
        n: 1,
        input_fidelity: 'high'
      } as never)
    )

    const imageBase64 = result.data?.[0]?.b64_json
    if (!imageBase64) throw new Error('OpenAI 没有返回图片。')

    return {
      generatedPetImage: `data:image/png;base64,${imageBase64}`,
      model,
      requestId: result._request_id || crypto.randomUUID()
    }
  } catch (error) {
    const mapped = mapOpenAIError(error, 'IMAGE_GENERATION_FAILED', 'Q 版 SoulPet 生成失败。')
    throw Object.assign(new Error(mapped.message), mapped)
  }
}
