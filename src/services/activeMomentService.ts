import type { SoulPetCharacter } from '../types/soulPet'
import type { LifeStageInfo } from './lifeVisualResolver'

const stageMoments: Record<LifeStageInfo['name'], string[]> = {
  初遇期: ['偷偷看了你一眼。', '好像还在适应新家。'],
  熟悉期: ['在小家里转了一圈。', '轻轻蹭了蹭你。'],
  依恋期: ['它好像有话想和你说。', '一直待在你附近。'],
  亲密期: ['它看到你就很开心。', '今天也想一直陪着你。']
}

const pick = (items: string[]): string => items[Math.floor(Math.random() * items.length)]

export const getNextActiveMomentDelay = (): number => 30000 + Math.floor(Math.random() * 30000)

export const resolveActiveMoment = (
  character: SoulPetCharacter,
  lifeStage: LifeStageInfo
): string | null => {
  if (character.energy <= 20) return null
  if (character.satiety <= 25) return null

  if (character.mood <= 25) {
    return pick(['它安静地缩在角落。', '它轻轻靠近了一点。'])
  }

  return pick(stageMoments[lifeStage.name])
}
