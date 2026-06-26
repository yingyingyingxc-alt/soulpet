import { characterBackgroundRemovalPrompt } from '../prompts/characterBackgroundRemovalPrompt'
import { petGenerationPrompt } from '../prompts/petGenerationPrompt'
import { removeGreenScreenBackground } from '../utils/removeGreenScreenBackground'
import { removeWhiteBackgroundFloodFill } from '../utils/removeWhiteBackgroundFloodFill'
import { withRetry } from '../utils/retry'
import { createProviderError, type ImageProvider, type ImageProviderInput, type ImageProviderResult } from './imageProvider'

type VolcengineImageResponse = {
  id?: string
  request_id?: string
  data?: Array<{
    b64_json?: string
    image?: string
    url?: string
  }>
  error?: {
    code?: string
    message?: string
  }
}

type VolcengineProviderMode = 'pet-chibi' | 'background-removal'

const getVolcengineConfig = (): { apiKey: string; model: string } => {
  const apiKey = process.env.VOLCENGINE_API_KEY
  const model = process.env.VOLCENGINE_IMAGE_MODEL

  if (!apiKey) {
    throw createProviderError('VOLCENGINE_API_KEY_MISSING', '请先配置 VOLCENGINE_API_KEY。')
  }

  if (!model) {
    throw createProviderError('VOLCENGINE_IMAGE_MODEL_MISSING', '请先配置 VOLCENGINE_IMAGE_MODEL。')
  }

  return { apiKey, model }
}

const mapVolcengineError = (error: unknown, fallbackCode: string, fallbackMessage: string) => {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500
  const message = error instanceof Error ? error.message : fallbackMessage
  const lowerMessage = message.toLowerCase()

  if (status === 401 || status === 403) {
    return { code: 'VOLCENGINE_API_KEY_MISSING', message: '火山方舟 API Key 无效或缺失。', status }
  }

  if (status === 429) {
    return { code: 'RATE_LIMITED', message: '火山方舟请求过于频繁，请稍后再试。', status }
  }

  if (lowerMessage.includes('quota') || lowerMessage.includes('余额')) {
    return { code: 'QUOTA_EXCEEDED', message: '火山方舟额度不足。', status }
  }

  if (lowerMessage.includes('timeout')) {
    return { code: 'NETWORK_TIMEOUT', message: '火山方舟请求超时，请稍后重试。', status: 504 }
  }

  return { code: fallbackCode, message: `火山方舟返回错误：${message}`, status }
}

const imageToDataUrl = (file: Express.Multer.File): string =>
  `data:${file.mimetype};base64,${file.buffer.toString('base64')}`

const stripDataUrlPrefix = (image: string): string => {
  const [, base64] = image.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/) || []
  return base64 || image
}

const imageResponseToBuffer = async (image?: string, url?: string): Promise<Buffer> => {
  if (image) return Buffer.from(stripDataUrlPrefix(image), 'base64')

  if (!url) throw new Error('火山方舟没有返回图片。')

  const response = await fetch(url)
  if (!response.ok) throw new Error('火山方舟图片下载失败。')

  return Buffer.from(await response.arrayBuffer())
}

const maskPayloadForLog = (payload: Record<string, unknown>): Record<string, unknown> => ({
  ...payload,
  image: '[image data omitted]'
})

const logVolcengineError = (
  mode: VolcengineProviderMode,
  status: number,
  code: string | undefined,
  message: string,
  responseBody: unknown,
  requestPayload: Record<string, unknown>
): void => {
  console.error('[SoulPet][VolcengineImageProvider] request failed', {
    mode,
    status,
    code,
    message,
    requestPayload: maskPayloadForLog(requestPayload),
    responseBody
  })
}

const callVolcengineImageApi = async (
  input: ImageProviderInput,
  prompt: string,
  mode: VolcengineProviderMode,
  fallbackCode: string,
  fallbackMessage: string
): Promise<ImageProviderResult> => {
  const { apiKey, model } = getVolcengineConfig()

  try {
    const size = '2048x2048'

    console.log('Using image model:', model)
    console.log('Using image size:', size)

    const payload = {
      model,
      prompt,
      image: imageToDataUrl(input.file),
      response_format: 'b64_json',
      size,
      n: 1,
      watermark: false
      // TODO: 如果所选豆包图片模型要求图像编辑专用 endpoint 或字段名，
      // 在这里按具体模型文档调整 image / response_format / size 等字段。
    }

    const response = await withRetry(async () =>
      fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
    )

    const result = (await response.json()) as VolcengineImageResponse

    if (!response.ok || result.error) {
      logVolcengineError(
        mode,
        response.status,
        result.error?.code,
        result.error?.message || fallbackMessage,
        result,
        payload
      )
      throw Object.assign(new Error(result.error?.message || fallbackMessage), {
        status: response.status,
        code: result.error?.code
      })
    }

    const responseImage = result.data?.[0]
    const image = responseImage?.b64_json || responseImage?.image
    if (!image && !responseImage?.url) {
      logVolcengineError(
        mode,
        response.status,
        'VOLCENGINE_EMPTY_IMAGE',
        '火山方舟响应中没有图片字段。',
        result,
        payload
      )
      throw new Error('火山方舟没有返回图片。')
    }

    const imageBuffer = await imageResponseToBuffer(image, responseImage?.url)
    const greenScreenOutput = await removeGreenScreenBackground(imageBuffer)
    const outputImage =
      mode === 'background-removal' && greenScreenOutput.transparentPixels === 0
        ? await removeWhiteBackgroundFloodFill(imageBuffer)
        : greenScreenOutput

    return {
      image: outputImage.dataUrl,
      model,
      requestId: result.id || result.request_id || crypto.randomUUID()
    }
  } catch (error) {
    const mapped = mapVolcengineError(error, fallbackCode, fallbackMessage)
    throw Object.assign(new Error(mapped.message), mapped)
  }
}

export const volcengineImageProvider: ImageProvider = {
  generatePetChibi(input) {
    return callVolcengineImageApi(
      input,
      petGenerationPrompt,
      'pet-chibi',
      'IMAGE_GENERATION_FAILED',
      '火山方舟 Q 版 SoulPet 生成失败。'
    )
  },
  removeCharacterBackground(input) {
    return callVolcengineImageApi(
      input,
      characterBackgroundRemovalPrompt,
      'background-removal',
      'BACKGROUND_REMOVAL_FAILED',
      '火山方舟智能抠图失败。'
    )
  }
}
