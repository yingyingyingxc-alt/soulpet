import type { SoulPetCharacter } from '../types/soulPet'

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)))

export const getCompanionDays = (character: SoulPetCharacter, now = new Date()): number => {
  const createdAt = new Date(character.createdAt)
  const elapsedDays = Math.floor(Math.max(0, now.getTime() - createdAt.getTime()) / 86400000)
  return elapsedDays + 1
}

export const getGrowthStage = (character: SoulPetCharacter): string => {
  if (character.bond <= 20) return '初遇期'
  if (character.bond <= 50) return '熟悉期'
  if (character.bond <= 80) return '依恋期'
  return '亲密期'
}

export const createInitialLifeValues = () => ({
  satiety: 80,
  mood: 75,
  energy: 80,
  bond: 0
})

export const applyOfflineLifeSettlement = (
  character: SoulPetCharacter,
  now = new Date()
): SoulPetCharacter => {
  const lastUpdatedAt = new Date(character.lastUpdatedAt)
  const elapsedHours = Math.min(24, Math.max(0, (now.getTime() - lastUpdatedAt.getTime()) / 3600000))

  if (elapsedHours < 0.05) {
    return character
  }

  let energyDelta = 0
  const fullHours = Math.floor(elapsedHours)

  for (let index = 1; index <= fullHours; index += 1) {
    const hour = new Date(lastUpdatedAt.getTime() + index * 3600000).getHours()
    energyDelta += hour >= 23 || hour < 7 ? 5 : -1
  }

  return {
    ...character,
    satiety: clamp(character.satiety - elapsedHours * 2),
    mood: clamp(character.mood - Math.floor(elapsedHours / 2)),
    energy: clamp(character.energy + energyDelta),
    lastUpdatedAt: now.toISOString()
  }
}

export const updateLifeValue = (
  character: SoulPetCharacter,
  changes: Partial<Pick<SoulPetCharacter, 'satiety' | 'mood' | 'energy' | 'bond'>>
): SoulPetCharacter => ({
  ...character,
  satiety: clamp(changes.satiety ?? character.satiety),
  mood: clamp(changes.mood ?? character.mood),
  energy: clamp(changes.energy ?? character.energy),
  bond: clamp(changes.bond ?? character.bond),
  lastUpdatedAt: new Date().toISOString()
})
