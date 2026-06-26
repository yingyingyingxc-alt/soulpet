import type { CharacterSource } from '../types/soulPet'

export type ImageApiResult = {
  image?: string
  error?: string
  code?: string
}

const dataUrlToFile = async (dataUrl: string, fileName: string): Promise<File> => {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], fileName, { type: blob.type || 'image/png' })
}

const postImage = async (
  endpoint: string,
  imageDataUrl: string,
  fields: Record<string, string>
): Promise<Record<string, unknown>> => {
  const formData = new FormData()
  formData.set('image', await dataUrlToFile(imageDataUrl, 'soulpet-upload.png'))

  Object.entries(fields).forEach(([key, value]) => {
    formData.set(key, value)
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData
  })
  const payload = (await response.json()) as Record<string, unknown>

  if (!response.ok || payload.success === false) {
    throw Object.assign(new Error(String(payload.message || '请求失败')), {
      code: payload.code
    })
  }

  return payload
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
