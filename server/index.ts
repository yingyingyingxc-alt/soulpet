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
const imageJobs = new Map<
  string,
  | { status: 'processing'; createdAt: number }
  | { status: 'succeeded'; createdAt: number; result: Record<string, unknown> }
  | { status: 'failed'; createdAt: number; code: string; message: string; statusCode: number }
>()
const imageJobTtlMs = 10 * 60 * 1000

const sendError = (response: express.Response, error: unknown, fallbackCode: string): void => {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500
  const code =
    typeof error === 'object' && error && 'code' in error ? String(error.code) : fallbackCode
  const message = error instanceof Error ? error.message : '请求失败。'

  response.status(status || 500).json({ success: false, code, message })
}

const serializeError = (error: unknown, fallbackCode: string) => {
  const statusCode = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : fallbackCode
  const message = error instanceof Error ? error.message : '请求失败。'

  return { statusCode: statusCode || 500, code, message }
}

const cleanupImageJobs = (): void => {
  const now = Date.now()
  imageJobs.forEach((job, jobId) => {
    if (now - job.createdAt > imageJobTtlMs) imageJobs.delete(jobId)
  })
}

const startImageJob = async (
  task: () => Promise<Record<string, unknown>>,
  fallbackCode: string
): Promise<string> => {
  cleanupImageJobs()
  const jobId = crypto.randomUUID()
  imageJobs.set(jobId, { status: 'processing', createdAt: Date.now() })

  void task()
    .then((result) => {
      imageJobs.set(jobId, { status: 'succeeded', createdAt: Date.now(), result })
    })
    .catch((error) => {
      const mapped = serializeError(error, fallbackCode)
      imageJobs.set(jobId, { status: 'failed', createdAt: Date.now(), ...mapped })
    })

  return jobId
}

app.get('/api/health', (_request, response) => {
  response.json({ success: true, imageProvider: getImageProviderName() })
})

app.get('/api/image-jobs/:jobId', (request, response) => {
  cleanupImageJobs()
  const job = imageJobs.get(request.params.jobId)

  if (!job) {
    response.status(404).json({
      success: false,
      status: 'failed',
      code: 'IMAGE_JOB_NOT_FOUND',
      message: '图片任务已过期，请重新生成。'
    })
    return
  }

  if (job.status === 'processing') {
    response.json({ success: true, status: 'processing' })
    return
  }

  if (job.status === 'failed') {
    response.status(job.statusCode).json({
      success: false,
      status: 'failed',
      code: job.code,
      message: job.message
    })
    return
  }

  response.json({ success: true, status: 'succeeded', ...job.result })
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
    const name = request.body.name
    const personality = request.body.personality
    const source = request.body.source
    const jobId = await startImageJob(async () => {
      const imageProvider = await getImageProvider()
      const result = await imageProvider.generatePetChibi({
        file: uploadedFile,
        name,
        personality,
        source
      })

      return {
        generatedPetImage: result.image,
        model: result.model,
        requestId: result.requestId,
        provider: getImageProviderName()
      }
    }, 'IMAGE_GENERATION_FAILED')

    response.status(202).json({ success: true, status: 'processing', jobId })
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
    const name = request.body.name
    const source = request.body.source
    const jobId = await startImageJob(async () => {
      const imageProvider = await getImageProvider()
      const result = await imageProvider.removeCharacterBackground({
        file: uploadedFile,
        name,
        source
      })

      return {
        processedCharacterImage: result.image,
        model: result.model,
        requestId: result.requestId,
        provider: getImageProviderName()
      }
    }, 'BACKGROUND_REMOVAL_FAILED')

    response.status(202).json({ success: true, status: 'processing', jobId })
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
