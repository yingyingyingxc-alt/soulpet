const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const retryableCodes = new Set([408, 429, 500, 502, 503, 504])

export const isRetryableError = (error: unknown): boolean => {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 0
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''

  return retryableCodes.has(status) || code.includes('ETIMEDOUT') || code.includes('ECONNRESET')
}

export const withRetry = async <T>(task: () => Promise<T>, attempts = 2): Promise<T> => {
  let lastError: unknown

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (!isRetryableError(error) || attempt === attempts) {
        throw error
      }
      await wait(700 * (attempt + 1))
    }
  }

  throw lastError
}
