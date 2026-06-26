import type { CharacterSource } from '../types/soulPet'

export type ImageApiResult = {
  image?: string
  error?: string
  code?: string
}

type ApiError = Error & { code?: string }

const dataUrlToFile = async (dataUrl: string, fileName: string): Promise<File> => {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], fileName, { type: blob.type || 'image/png' })
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))

const createApiError = (message: string, code?: string): ApiError =>
  Object.assign(new Error(message), { code })

const parseJsonResponse = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text()

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw createApiError('服务器刚刚在重启，请再试一次。', 'SERVER_NOT_READY')
  }
}

const shouldRetryImageJob = (error: unknown): boolean => {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  return code === 'IMAGE_JOB_NOT_FOUND' || code === 'IMAGE_JOB_INTERRUPTED' || code === 'SERVER_NOT_READY'
}

const submitImage = async (
  endpoint: string,
  file: File,
  fields: Record<string, string>
): Promise<Record<string, unknown>> => {
  const formData = new FormData()
  formData.set('image', file)

  Object.entries(fields).forEach(([key, value]) => {
    formData.set(key, value)
  })

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    })
  } catch {
    throw createApiError('服务器刚刚在重启，请再试一次。', 'SERVER_NOT_READY')
  }
  const payload = await parseJsonResponse(response)

  if (!response.ok || payload.success === false) {
    throw createApiError(String(payload.message || '请求失败'), String(payload.code || 'REQUEST_FAILED'))
  }

  return payload
}

const postImage = async (
  endpoint: string,
  imageDataUrl: string,
  fields: Record<string, string>
): Promise<Record<string, unknown>> => {
  const file = await dataUrlToFile(imageDataUrl, 'soulpet-upload.png')

  const run = async (allowRetry: boolean): Promise<Record<string, unknown>> => {
    const payload = await submitImage(endpoint, file, fields)

    if (payload.status === 'processing' && payload.jobId) {
      try {
        return await pollImageJob(String(payload.jobId))
      } catch (error) {
        if (allowRetry && shouldRetryImageJob(error)) {
          await wait(1500)
          return run(false)
        }

        throw error
      }
    }

    return payload
  }

  return run(true)
}

const pollImageJob = async (jobId: string): Promise<Record<string, unknown>> => {
  const maxAttempts = 90

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await wait(2000)

    let response: Response
    try {
      response = await fetch(`/api/image-jobs/${jobId}`)
    } catch {
      throw createApiError('服务器刚刚在重启，请再试一次。', 'SERVER_NOT_READY')
    }
    const payload = await parseJsonResponse(response)

    if (payload.status === 'processing') continue

    if (!response.ok || payload.success === false) {
      throw createApiError(String(payload.message || '请求失败'), String(payload.code || 'REQUEST_FAILED'))
    }

    return payload
  }

  throw Object.assign(new Error('图片生成仍在处理中，请稍后重试。'), {
    code: 'NETWORK_TIMEOUT'
  })
}

export const generatePetWithAI = async (
  imageDataUrl: string,
  fields: { name: string; personality: string; source: CharacterSource }
): Promise<ImageApiResult> => {
  try {
    const payload = await postImage('/api/generate-pet', imageDataUrl, fields)
    return { image: String(payload.generatedPetImage || '') }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '生成失败',
      code: typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined
    }
  }
}

export const removeCharacterBackgroundWithAI = async (
  imageDataUrl: string,
  fields: { name: string; source: CharacterSource }
): Promise<ImageApiResult> => {
  try {
    const payload = await postImage('/api/remove-character-background', imageDataUrl, fields)
    return { image: String(payload.processedCharacterImage || '') }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '智能抠图失败',
      code: typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined
    }
  }
}
