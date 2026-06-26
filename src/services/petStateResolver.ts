import type { SoulPetCharacter } from '../types/soulPet'
import type { TimeContext } from './timeContext'

export type ResolvedPetState = {
  mainState: string
  bubbleText: string
  moodIcon: string
  animationType: 'idle' | 'happy' | 'sleepy' | 'hungry' | 'sad'
}

export const resolvePetState = (
  character: SoulPetCharacter,
  timeContext: TimeContext,
  overrideBubble?: string
): ResolvedPetState => {
  if (overrideBubble) {
    return {
      mainState: overrideBubble,
      bubbleText: overrideBubble,
      moodIcon: '🥰',
      animationType: 'idle'
    }
  }

  if (character.energy <= 20) {
    const text = '有点困困的，想休息一下。'
    return { mainState: text, bubbleText: text, moodIcon: '😴', animationType: 'sleepy' }
  }

  if (character.satiety <= 25) {
    const text = '肚子有点饿了，可以喂我一点吗？'
    return { mainState: text, bubbleText: text, moodIcon: '🍙', animationType: 'hungry' }
  }

  if (character.mood <= 25) {
    const text = '今天有点没精神，可以陪陪我吗？'
    return { mainState: text, bubbleText: text, moodIcon: '🥺', animationType: 'sad' }
  }

  return {
    mainState: timeContext.idleText,
    bubbleText: timeContext.idleText,
    moodIcon: '😊',
    animationType: 'idle'
  }
}
