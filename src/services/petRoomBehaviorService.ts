import type { SoulPetCharacter } from '../types/soulPet'
import type { TimeContext } from './timeContext'

export type PetRoomActivity = 'idle' | 'sleep' | 'play' | 'watch' | 'wander' | 'talk'

export type PetRoomSpot = {
  id: 'rug' | 'bed' | 'window' | 'toy' | 'catTree' | 'foreground'
  label: string
  x: number
  y: number
  scale: number
  activity: PetRoomActivity
}

type WeightedSpot = PetRoomSpot & {
  weight: number
}

export const defaultRoomSpot: PetRoomSpot = {
  id: 'rug',
  label: '地毯中央',
  x: 50,
  y: 68,
  scale: 0.88,
  activity: 'idle'
}

const roomSpots: Record<PetRoomSpot['id'], Omit<PetRoomSpot, 'activity'>> = {
  rug: { id: 'rug', label: '地毯中央', x: 50, y: 68, scale: 0.88 },
  bed: { id: 'bed', label: '小床', x: 34, y: 67, scale: 0.72 },
  window: { id: 'window', label: '窗边', x: 32, y: 54, scale: 0.64 },
  toy: { id: 'toy', label: '玩具区', x: 64, y: 69, scale: 0.76 },
  catTree: { id: 'catTree', label: '猫爬架附近', x: 77, y: 60, scale: 0.62 },
  foreground: { id: 'foreground', label: '靠近你的位置', x: 50, y: 75, scale: 1 }
}

const activityText: Record<PetRoomActivity, string> = {
  idle: '安静地待着。',
  sleep: '睡得很香。',
  play: '正在玩小玩具。',
  watch: '正在看窗外。',
  wander: '在小家里转了一圈。',
  talk: '我来啦。'
}

const createSpot = (
  id: PetRoomSpot['id'],
  activity: PetRoomActivity,
  weight: number
): WeightedSpot => ({
  ...roomSpots[id],
  activity,
  weight
})

const weightedPick = (spots: WeightedSpot[]): PetRoomSpot => {
  const total = spots.reduce((sum, spot) => sum + spot.weight, 0)
  let ticket = Math.random() * total

  for (const spot of spots) {
    ticket -= spot.weight
    if (ticket <= 0) {
      const { weight: _weight, ...picked } = spot
      return picked
    }
  }

  const { weight: _weight, ...fallback } = spots[0]
  return fallback
}

export const getNextRoomBehaviorDelay = (): number => 180000

export const resolveRoomActivityText = (spot: PetRoomSpot, character?: SoulPetCharacter): string => {
  if (character && character.satiety <= 25) return '想吃点东西。'
  if (spot.id === 'rug' && spot.activity === 'idle') return '安静地待着。'
  return activityText[spot.activity]
}

export const resolveNextRoomSpot = (
  character: SoulPetCharacter,
  timeContext: TimeContext
): PetRoomSpot => {
  if (character.satiety <= 25) {
    return { ...roomSpots.rug, activity: 'idle', scale: 0.96 }
  }

  const isSleepy = character.energy <= 20 || timeContext.timePeriod === '深夜'
  const base: WeightedSpot[] = [
    createSpot('rug', 'idle', 5),
    createSpot('bed', 'sleep', isSleepy ? 12 : 2),
    createSpot('window', 'watch', 4),
    createSpot('toy', 'play', character.mood >= 80 ? 9 : 3),
    createSpot('catTree', 'wander', character.mood >= 80 ? 5 : 3),
    createSpot('foreground', 'talk', Math.max(1, Math.round(character.bond / 18)))
  ]

  if (character.mood >= 80) {
    base.push(createSpot('rug', 'wander', 5))
  }

  return weightedPick(base)
}

export const getApproachSpot = (): PetRoomSpot => ({
  ...roomSpots.foreground,
  activity: 'talk'
})
