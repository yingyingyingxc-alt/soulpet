import { safeReadJson, safeRemoveStorageItem, safeSetStorageItem } from './safeStorage'

export type AlbumItem = {
  id: string
  date: string
  image?: string
  title: string
  description: string
}

const albumStorageKey = 'soulpet_album_items'
const albumFlagsStorageKey = 'soulpet_album_flags'
const maxStoredImageChars = 900000

const writeItems = (items: AlbumItem[]): void => {
  safeSetStorageItem(albumStorageKey, JSON.stringify(items))
}

const readFlags = (): Record<string, boolean> => safeReadJson(albumFlagsStorageKey, {})

const writeFlags = (flags: Record<string, boolean>): void => {
  safeSetStorageItem(albumFlagsStorageKey, JSON.stringify(flags))
}

export const loadAlbumItems = (): AlbumItem[] => safeReadJson<AlbumItem[]>(albumStorageKey, [])

export const addAlbumItem = (
  item: Omit<AlbumItem, 'id' | 'date'>,
  options?: { onceKey?: string }
): AlbumItem[] => {
  const flags = readFlags()
  if (options?.onceKey && flags[options.onceKey]) return loadAlbumItems()

  const items = loadAlbumItems()
  const nextItem: AlbumItem = {
    ...item,
    image: item.image && item.image.length <= maxStoredImageChars ? item.image : undefined,
    id: crypto.randomUUID(),
    date: new Date().toISOString()
  }
  const nextItems = [nextItem, ...items].slice(0, 80)
  writeItems(nextItems)

  if (options?.onceKey) {
    writeFlags({ ...flags, [options.onceKey]: true })
  }

  return nextItems
}

export const recordBirthAlbum = (image?: string): AlbumItem[] =>
  addAlbumItem(
    {
      image,
      title: 'SoulPet 诞生',
      description: '它第一次来到你的小家。'
    },
    { onceKey: 'birth' }
  )

export const recordFirstHomeAlbum = (image?: string): AlbumItem[] =>
  addAlbumItem(
    {
      image,
      title: '第一次回到小家',
      description: '这是你们开始一起生活的地方。'
    },
    { onceKey: 'first-home' }
  )

export const recordAccessoryAlbum = (accessoryName: string, image?: string): AlbumItem[] =>
  addAlbumItem({
    image,
    title: `换上${accessoryName}`,
    description: '它留下了一张新的小家回忆。'
  })

export const clearAlbumItems = (): AlbumItem[] => {
  safeRemoveStorageItem(albumStorageKey)
  safeRemoveStorageItem(albumFlagsStorageKey)
  return []
}
