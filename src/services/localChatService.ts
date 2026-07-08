import type { SoulPetCharacter } from '../types/soulPet'
import type { TimeContext } from './timeContext'

export const quickChatQuestions = [
  '你现在感觉怎么样？',
  '今天想做什么？',
  '你喜欢这里吗？',
  '我回来啦',
  '晚安'
] as const

export type QuickChatQuestion = (typeof quickChatQuestions)[number]

const timeReplies: Record<TimeContext['timePeriod'], string> = {
  早晨: '早安呀，今天也一起加油。',
  中午: '到饭点啦，你也要记得吃饭。',
  下午: '下午想和你一起安静待一会儿。',
  晚上: '今天辛苦啦，欢迎回来。',
  深夜: '很晚啦，我们都该休息了。'
}

export const getLocalChatReply = (
  question: QuickChatQuestion,
  character: SoulPetCharacter,
  timeContext: TimeContext
): string => {
  if (question === '晚安') return '晚安呀，我会乖乖休息，也等你明天回来。'
  if (question === '我回来啦') return character.bond >= 80 ? '你回来啦。只要你在，我就觉得这里是家。' : '你回来啦，我刚刚还在想你。'

  if (character.energy <= 20) return '有点困困的，但还是想陪你一会儿。'
  if (character.satiety <= 25) return '肚子有点饿啦……不过看到你还是很开心。'
  if (character.mood <= 40) return '今天有一点点低落，但你来了就好多了。'
  if (character.bond <= 20) return '这里还很陌生，但我会慢慢熟悉你的。'
  if (character.bond >= 80) return '只要你在，我就觉得这里是家。'

  if (question === '今天想做什么？') return '想在小家里转一圈，然后靠近你待一会儿。'
  if (question === '你喜欢这里吗？') return '喜欢，这里有你的气味，也有我的小角落。'

  return timeReplies[timeContext.timePeriod]
}
