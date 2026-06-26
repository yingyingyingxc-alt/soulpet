import type { Express } from 'express'

export const maxImageSize = 10 * 1024 * 1024
const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])

export type ValidationResult = { ok: true } | { ok: false; code: string; message: string }

export const validateImageFile = (file?: Express.Multer.File): ValidationResult => {
  if (!file) {
    return { ok: false, code: 'IMAGE_GENERATION_FAILED', message: '请先上传图片。' }
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    return { ok: false, code: 'INVALID_FILE_TYPE', message: '仅支持 png、jpg、jpeg、webp 图片。' }
  }

  if (file.size > maxImageSize) {
    return { ok: false, code: 'FILE_TOO_LARGE', message: '图片不能超过 10MB。' }
  }

  return { ok: true }
}
