export type TimePeriod = '早晨' | '中午' | '下午' | '晚上' | '深夜'

export type TimeContext = {
  timePeriod: TimePeriod
  greeting: string
  idleText: string
  sceneClass: string
  ambientIcon: string
}

const pick = (items: string[]): string => items[Math.floor(Math.random() * items.length)]

export const getTimeContext = (date = new Date()): TimeContext => {
  const hour = date.getHours()

  if (hour >= 6 && hour < 11) {
    return {
      timePeriod: '早晨',
      greeting: '早安主人，今天也一起加油吧。',
      idleText: pick(['早安主人，今天也一起加油吧。', '太阳出来啦。']),
      sceneClass: 'scene-morning',
      ambientIcon: '☀️'
    }
  }

  if (hour >= 11 && hour < 14) {
    return {
      timePeriod: '中午',
      greeting: '到吃饭时间啦。',
      idleText: pick(['到吃饭时间啦。', '想找个地方晒太阳。']),
      sceneClass: 'scene-noon',
      ambientIcon: '🌤️'
    }
  }

  if (hour >= 14 && hour < 18) {
    return {
      timePeriod: '下午',
      greeting: '下午也要记得休息一下。',
      idleText: pick(['下午也要记得休息一下。', '偷偷观察你工作。']),
      sceneClass: 'scene-afternoon',
      ambientIcon: '🌿'
    }
  }

  if (hour >= 18 && hour < 23) {
    return {
      timePeriod: '晚上',
      greeting: '欢迎回来，今天辛苦啦。',
      idleText: pick(['欢迎回来，今天辛苦啦。', '想和你安静地待一会儿。']),
      sceneClass: 'scene-evening',
      ambientIcon: '🌙'
    }
  }

  return {
    timePeriod: '深夜',
    greeting: '已经很晚啦，要早点休息。',
    idleText: pick(['已经很晚啦，要早点休息。', '呼呼……我先睡一会儿。']),
    sceneClass: 'scene-night',
    ambientIcon: '✨'
  }
}
