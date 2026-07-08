import type { LifeStageInfo } from './lifeVisualResolver'

export type DiaryEntry = {
  id: string
  date: string
  type: 'birth' | 'feed' | 'pet' | 'return' | 'stage' | 'mood' | 'system'
  title: string
  content: string
}

const diaryStorageKey = 'soulpet_diary_entries'
const diaryFlagsStorageKey = 'soulpet_diary_flags'

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const writeEntries = (entries: DiaryEntry[]): void => {
  localStorage.setItem(diaryStorageKey, JSON.stringify(entries))
}

const readFlags = (): Record<string, boolean> => readJson(diaryFlagsStorageKey, {})

const writeFlags = (flags: Record<string, boolean>): void => {
  localStorage.setItem(diaryFlagsStorageKey, JSON.stringify(flags))
}

export const loadDiaryEntries = (): DiaryEntry[] => readJson<DiaryEntry[]>(diaryStorageKey, [])

export const addDiaryEntry = (
  entry: Omit<DiaryEntry, 'id' | 'date'>,
  options?: { onceKey?: string }
): DiaryEntry[] => {
  const flags = readFlags()
  if (options?.onceKey && flags[options.onceKey]) return loadDiaryEntries()

  const entries = loadDiaryEntries()
  const nextEntry: DiaryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    date: new Date().toISOString()
  }
  const nextEntries = [nextEntry, ...entries].slice(0, 80)
  writeEntries(nextEntries)

  if (options?.onceKey) {
    writeFlags({ ...flags, [options.onceKey]: true })
  }

  return nextEntries
}

export const recordBirthDiary = (): DiaryEntry[] =>
  addDiaryEntry(
    {
      type: 'birth',
      title: '第一次来到小家',
      content: '今天，它正式成为你的 SoulPet。'
    },
    { onceKey: 'birth' }
  )

export const recordFirstFeedDiary = (): DiaryEntry[] =>
  addDiaryEntry(
    {
      type: 'feed',
      title: '第一次投喂',
      content: '它记住了你给它的第一份食物。'
    },
    { onceKey: 'feed' }
  )

export const recordFirstPetDiary = (): DiaryEntry[] =>
  addDiaryEntry(
    {
      type: 'pet',
      title: '第一次被摸摸',
      content: '它好像更愿意靠近你了。'
    },
    { onceKey: 'pet' }
  )

export const recordFirstChatDiary = (): DiaryEntry[] =>
  addDiaryEntry(
    {
      type: 'system',
      title: '第一次聊天',
      content: '它认真听见了你对它说的话。'
    },
    { onceKey: 'chat' }
  )

export const recordFirstAccessoryDiary = (): DiaryEntry[] =>
  addDiaryEntry(
    {
      type: 'system',
      title: '第一次装扮',
      content: '它换上了你选的小装饰。'
    },
    { onceKey: 'accessory' }
  )

export const recordReturnDiary = (content: string): DiaryEntry[] =>
  addDiaryEntry({
    type: 'return',
    title: '你回来了',
    content
  })

export const recordStageDiary = (stage: LifeStageInfo): DiaryEntry[] =>
  addDiaryEntry(
    {
      type: 'stage',
      title: '关系变近了',
      content: `你们进入了【${stage.name}】。`
    },
    { onceKey: `stage:${stage.name}` }
  )

export const clearDiaryEntries = (): DiaryEntry[] => {
  localStorage.removeItem(diaryStorageKey)
  localStorage.removeItem(diaryFlagsStorageKey)
  return []
}
