import type { SoulPetCharacter } from '../types/soulPet'
import { safeGetStorageItem, safeRemoveStorageItem, safeSetStorageItem } from './safeStorage'

const metadataKey = 'soulpet:v0.4:character'
const dbName = 'soulpet-images'
const storeName = 'images'

type StoredMetadata = Omit<
  SoulPetCharacter,
  'originalImage' | 'generatedPetImage' | 'processedCharacterImage'
>

const imageKeys = {
  originalImage: 'originalImage',
  generatedPetImage: 'generatedPetImage',
  processedCharacterImage: 'processedCharacterImage'
} as const

const openImageDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName)
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const putImage = async (key: string, value?: string): Promise<void> => {
  if (!value) return

  const db = await openImageDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(value, key)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

const getImage = async (key: string): Promise<string | undefined> => {
  const db = await openImageDatabase()
  const value = await new Promise<string | undefined>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).get(key)
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return value
}

const clearImages = async (): Promise<void> => {
  const db = await openImageDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).clear()
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

const deleteImages = async (keys: string[]): Promise<void> => {
  const db = await openImageDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    keys.forEach((key) => store.delete(key))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

export const saveSoulPetCharacter = async (character: SoulPetCharacter): Promise<void> => {
  const { originalImage, generatedPetImage, processedCharacterImage, ...metadata } = character
  safeSetStorageItem(metadataKey, JSON.stringify(metadata satisfies StoredMetadata))

  try {
    await Promise.all([
      putImage(imageKeys.originalImage, originalImage),
      putImage(imageKeys.generatedPetImage, generatedPetImage),
      putImage(imageKeys.processedCharacterImage, processedCharacterImage)
    ])
  } catch {
    ;(window as Window & { __soulPetSessionCharacter?: SoulPetCharacter }).__soulPetSessionCharacter =
      character
  }
}

export const loadSoulPetCharacter = async (): Promise<SoulPetCharacter | null> => {
  const sessionCharacter = (window as Window & { __soulPetSessionCharacter?: SoulPetCharacter })
    .__soulPetSessionCharacter

  if (sessionCharacter) return sessionCharacter

  const raw = safeGetStorageItem(metadataKey)
  if (!raw) return null

  let metadata: StoredMetadata
  try {
    metadata = JSON.parse(raw) as StoredMetadata
  } catch {
    safeRemoveStorageItem(metadataKey)
    return null
  }

  try {
    return {
      ...metadata,
      originalImage: await getImage(imageKeys.originalImage),
      generatedPetImage: await getImage(imageKeys.generatedPetImage),
      processedCharacterImage: await getImage(imageKeys.processedCharacterImage)
    }
  } catch {
    return metadata
  }
}

export const clearSoulPetCharacter = async (): Promise<void> => {
  safeRemoveStorageItem(metadataKey)
  delete (window as Window & { __soulPetSessionCharacter?: SoulPetCharacter }).__soulPetSessionCharacter
  try {
    await clearImages()
  } catch {
    // IndexedDB can fail in private or restricted browser contexts.
  }
}

export const clearSoulPetImageCache = async (): Promise<void> => {
  try {
    await deleteImages([imageKeys.generatedPetImage, imageKeys.processedCharacterImage])
  } catch {
    // IndexedDB can fail in private or restricted browser contexts.
  }
}
