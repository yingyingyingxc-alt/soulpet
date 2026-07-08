export const safeGetStorageItem = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export const safeSetStorageItem = (key: string, value: string): boolean => {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export const safeRemoveStorageItem = (key: string): void => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Some in-app mobile browsers can temporarily block localStorage.
  }
}

export const safeReadJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = safeGetStorageItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
