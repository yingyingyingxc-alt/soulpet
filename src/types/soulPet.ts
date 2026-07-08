export type CharacterSource = '现实宠物' | '虚拟角色' | '原创角色'

export type CharacterKind =
  | '猫'
  | '狗'
  | '兔子'
  | '鸟'
  | '团子'
  | '精灵'
  | '小幽灵'
  | 'Q版角色占位'

export type ActiveCharacterImageType = 'generated' | 'processed' | 'original' | 'default'
export type ActiveAccessory = 'none' | 'crown' | 'bow' | 'sleepCap' | 'scarf'

export type SoulPetCharacter = {
  id: string
  name: string
  source: CharacterSource
  kind: CharacterKind
  personality: string
  originalImage?: string
  generatedPetImage?: string
  processedCharacterImage?: string
  activeCharacterImageType?: ActiveCharacterImageType
  activeAccessory?: ActiveAccessory
  createdAt: string
  lastUpdatedAt: string
  lastVisitedAt?: string
  bond: number
  satiety: number
  mood: number
  energy: number
  lastFedAt?: string
  lastPettedAt?: string
}

export type ApiErrorCode =
  | 'OPENAI_API_KEY_MISSING'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'IMAGE_GENERATION_FAILED'
  | 'BACKGROUND_REMOVAL_FAILED'
  | 'RATE_LIMITED'
  | 'CONTENT_REJECTED'
  | 'QUOTA_EXCEEDED'
  | 'NETWORK_TIMEOUT'
  | 'UNKNOWN_ERROR'
