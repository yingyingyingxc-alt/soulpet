export const mapOpenAIError = (
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
): { code: string; message: string; status: number } => {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500
  const message = error instanceof Error ? error.message : fallbackMessage
  const lowerMessage = message.toLowerCase()

  if (status === 401) return { code: 'OPENAI_API_KEY_MISSING', message: 'OpenAI API Key 无效或缺失。', status: 401 }
  if (status === 429 && lowerMessage.includes('quota')) return { code: 'QUOTA_EXCEEDED', message: 'OpenAI 额度不足。', status: 429 }
  if (status === 429) return { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试。', status: 429 }
  if (status === 400 && lowerMessage.includes('content')) return { code: 'CONTENT_REJECTED', message: '图片内容无法处理，请换一张图片。', status: 400 }
  if (lowerMessage.includes('timeout')) return { code: 'NETWORK_TIMEOUT', message: '网络超时，请稍后重试。', status: 504 }

  return { code: fallbackCode, message: fallbackMessage, status }
}
