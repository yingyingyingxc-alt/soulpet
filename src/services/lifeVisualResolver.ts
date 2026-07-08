import type { SoulPetCharacter } from '../types/soulPet'
import type { TimeContext, TimePeriod } from './timeContext'

export type LifeStageName = '初遇期' | '熟悉期' | '依恋期' | '亲密期'
export type MainEmotion = '开心' | '平静' | '低落' | '困倦' | '饥饿'

export type LifeStageInfo = {
  name: LifeStageName
  description: string
  label: string
}

export type LifeVisualState = {
  lifeStage: LifeStageInfo
  mainEmotion: MainEmotion
  bubbleText: string
  animationClass: 'happy-bounce' | 'idle-breathe' | 'sad-small' | 'sleepy-float'
  statusIcon: string
  petScale: number
  shouldShowSleepBubble: boolean
  shouldShowHungerHint: boolean
  shouldShowLonelyHint: boolean
}

const pick = (items: string[], seed: number): string => items[Math.abs(seed) % items.length]

export const resolveLifeStage = (bond: number): LifeStageInfo => {
  if (bond <= 20) {
    return { name: '初遇期', description: '刚刚认识你', label: '初遇期 · 刚刚认识你' }
  }

  if (bond <= 50) {
    return { name: '熟悉期', description: '开始依赖你', label: '熟悉期 · 开始依赖你' }
  }

  if (bond <= 80) {
    return { name: '依恋期', description: '喜欢待在你身边', label: '依恋期 · 喜欢待在你身边' }
  }

  return { name: '亲密期', description: '你是最重要的人', label: '亲密期 · 你是最重要的人' }
}

export const isSleepyTime = (timePeriod: TimePeriod): boolean => timePeriod === '深夜'

export const resolveLifeVisual = (
  character: SoulPetCharacter,
  timeContext: TimeContext,
  overrideBubble?: string
): LifeVisualState => {
  const lifeStage = resolveLifeStage(character.bond)
  const isSleepy = character.energy <= 20 || isSleepyTime(timeContext.timePeriod)
  const isHungry = character.satiety <= 25
  const isLonely = character.mood <= 25
  const seed = character.bond + character.satiety + character.mood + character.energy + timeContext.timePeriod.length

  if (overrideBubble) {
    return {
      lifeStage,
      mainEmotion: isSleepy ? '困倦' : isHungry ? '饥饿' : character.mood < 40 ? '低落' : '平静',
      bubbleText: overrideBubble,
      animationClass: isSleepy ? 'sleepy-float' : character.mood >= 80 ? 'happy-bounce' : 'idle-breathe',
      statusIcon: isSleepy ? '😴' : isHungry ? '🍙' : '💬',
      petScale: 1,
      shouldShowSleepBubble: isSleepy,
      shouldShowHungerHint: isHungry,
      shouldShowLonelyHint: isLonely
    }
  }

  if (isSleepy) {
    return {
      lifeStage,
      mainEmotion: '困倦',
      bubbleText: pick(['困困的……想早点休息。', '呼呼……我先睡一会儿。'], seed),
      animationClass: 'sleepy-float',
      statusIcon: '😴',
      petScale: 0.98,
      shouldShowSleepBubble: true,
      shouldShowHungerHint: isHungry,
      shouldShowLonelyHint: isLonely
    }
  }

  if (isHungry) {
    return {
      lifeStage,
      mainEmotion: '饥饿',
      bubbleText: '肚子有点饿了，可以喂我一点吗？',
      animationClass: 'sad-small',
      statusIcon: '🍙',
      petScale: 0.98,
      shouldShowSleepBubble: false,
      shouldShowHungerHint: true,
      shouldShowLonelyHint: isLonely
    }
  }

  if (character.mood >= 80) {
    return {
      lifeStage,
      mainEmotion: '开心',
      bubbleText: pick(['今天超开心！', '和你待在一起就很安心。'], seed),
      animationClass: 'happy-bounce',
      statusIcon: '🥰',
      petScale: 1.04,
      shouldShowSleepBubble: false,
      shouldShowHungerHint: false,
      shouldShowLonelyHint: false
    }
  }

  if (character.mood < 40) {
    return {
      lifeStage,
      mainEmotion: '低落',
      bubbleText: pick(['今天有一点没精神。', '可以陪陪我吗？'], seed),
      animationClass: 'sad-small',
      statusIcon: '🥺',
      petScale: 0.96,
      shouldShowSleepBubble: false,
      shouldShowHungerHint: false,
      shouldShowLonelyHint: true
    }
  }

  return {
    lifeStage,
    mainEmotion: '平静',
    bubbleText: pick(['今天也一起加油吧。', '我会陪着你的。', timeContext.idleText], seed),
    animationClass: 'idle-breathe',
    statusIcon: '😊',
    petScale: 1,
    shouldShowSleepBubble: false,
    shouldShowHungerHint: false,
    shouldShowLonelyHint: false
  }
}
