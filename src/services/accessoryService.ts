import { safeGetStorageItem, safeRemoveStorageItem, safeSetStorageItem } from './safeStorage'

export type AccessoryId = 'none' | 'crown' | 'bow' | 'sleepCap' | 'scarf'

export type AccessoryOption = {
  id: AccessoryId
  name: string
  icon: string
}

const accessoryStorageKey = 'soulpet_active_accessory'

export const accessoryOptions: AccessoryOption[] = [
  { id: 'none', name: '无装扮', icon: '×' },
  { id: 'crown', name: '小皇冠', icon: '👑' },
  { id: 'bow', name: '蝴蝶结', icon: '🎀' },
  { id: 'sleepCap', name: '睡帽', icon: '🌙' },
  { id: 'scarf', name: '小围巾', icon: '🧣' }
]

export const loadActiveAccessory = (): AccessoryId => {
  const value = safeGetStorageItem(accessoryStorageKey)
  return accessoryOptions.some((option) => option.id === value) ? (value as AccessoryId) : 'none'
}

export const saveActiveAccessory = (accessory: AccessoryId): void => {
  if (accessory === 'none') {
    safeRemoveStorageItem(accessoryStorageKey)
    return
  }

  safeSetStorageItem(accessoryStorageKey, accessory)
}

export const getAccessoryOption = (accessory: AccessoryId): AccessoryOption =>
  accessoryOptions.find((option) => option.id === accessory) || accessoryOptions[0]
