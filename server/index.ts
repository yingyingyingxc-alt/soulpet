import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import multer from 'multer'
import { getImageProvider, getImageProviderName } from './providers'
import { maxImageSize, validateImageFile } from './utils/imageValidation'

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxImageSize } })
const port = process.env.PORT || process.env.SERVER_PORT || 3001
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const indexHtmlPath = path.join(rootDir, 'dist', 'index.html')

const sendError = (response: express.Response, error: unknown, fallbackCode: string): void => {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500
  const code =
    typeof error === 'object' && error && 'code' in error ? String(error.code) : fallbackCode
  const message = error instanceof Error ? error.message : '请求失败。'

  response.status(status || 500).json({ success: false, code, message })
}

app.get('/api/health', (_request, response) => {
  response.json({ success: true, imageProvider: getImageProviderName() })
})

app.post('/api/generate-pet', upload.single('image'), async (request, response) => {
  const validation = validateImageFile(request.file)
  if (!validation.ok) {
    response.status(validation.code === 'FILE_TOO_LARGE' ? 413 : 400).json({
      success: false,
      code: validation.code,
      message: validation.message
    })
    return
  }

  if (request.body.source !== '现实宠物') {
    response.status(400).json({ success: false, code: 'IMAGE_GENERATION_FAILED', message: 'source 必须为现实宠物。' })
    return
  }

  try {
    const uploadedFile = request.file!
    const result = await getImageProvider().generatePetChibi({
      file: uploadedFile,
      name: request.body.name,
      personality: request.body.personality,
      source: request.body.source
    })

    response.json({
      success: true,
      generatedPetImage: result.image,
      model: result.model,
      requestId: result.requestId,
      provider: getImageProviderName()
    })
  } catch (error) {
    sendError(response, error, 'IMAGE_GENERATION_FAILED')
  }
})

app.post('/api/remove-character-background', upload.single('image'), async (request, response) => {
  const validation = validateImageFile(request.file)
  if (!validation.ok) {
    response.status(validation.code === 'FILE_TOO_LARGE' ? 413 : 400).json({
      success: false,
      code: validation.code,
      message: validation.message
    })
    return
  }

  if (request.body.source !== '虚拟角色' && request.body.source !== '原创角色') {
    response.status(400).json({
      success: false,
      code: 'BACKGROUND_REMOVAL_FAILED',
      message: 'source 必须为虚拟角色或原创角色。'
    })
    return
  }

  try {
    const uploadedFile = request.file!
    const result = await getImageProvider().removeCharacterBackground({
      file: uploadedFile,
      name: request.body.name,
      source: request.body.source
    })

    response.json({
      success: true,
      processedCharacterImage: result.image,
      model: result.model,
      requestId: result.requestId,
      provider: getImageProviderName()
    })
  } catch (error) {
    sendError(response, error, 'BACKGROUND_REMOVAL_FAILED')
  }
})

app.use(express.static('dist'))
app.get(/^(?!\/api\/).*/, (_request, response) => {
  response.sendFile(indexHtmlPath)
})

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ success: false, code: 'FILE_TOO_LARGE', message: '图片不能超过 10MB。' })
    return
  }

  sendError(response, error, 'UNKNOWN_ERROR')
})

app.listen(port, () => {
  console.log(`SoulPet API server listening on http://localhost:${port}`)
})
