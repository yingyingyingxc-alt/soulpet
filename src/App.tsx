import { ChangeEvent, CSSProperties, FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { applyOfflineLifeSettlement, createInitialLifeValues, getCompanionDays, getGrowthStage, updateLifeValue } from './config/lifeSystem'
import { accessoryOptions, getAccessoryOption, loadActiveAccessory, saveActiveAccessory, type AccessoryId } from './services/accessoryService'
import { clearAlbumItems, loadAlbumItems, recordAccessoryAlbum, recordBirthAlbum, recordFirstHomeAlbum, type AlbumItem } from './services/albumService'
import { getNextActiveMomentDelay, resolveActiveMoment } from './services/activeMomentService'
import { clearDiaryEntries, loadDiaryEntries, recordBirthDiary, recordFirstAccessoryDiary, recordFirstChatDiary, recordFirstFeedDiary, recordFirstPetDiary, recordReturnDiary, recordStageDiary, type DiaryEntry } from './services/growthDiaryService'
import { generatePetWithAI, removeCharacterBackgroundWithAI } from './services/imageApi'
import { hasMeaningfulTransparency } from './services/imageTransparency'
import { resolveLifeStage, resolveLifeVisual } from './services/lifeVisualResolver'
import { getLocalChatReply, quickChatQuestions, type QuickChatQuestion } from './services/localChatService'
import { clearSoulPetCharacter, clearSoulPetImageCache, loadSoulPetCharacter, saveSoulPetCharacter } from './services/petStorage'
import { defaultRoomSpot, getApproachSpot, getNextRoomBehaviorDelay, resolveNextRoomSpot, resolveRoomActivityText, type PetRoomSpot } from './services/petRoomBehaviorService'
import { safeGetStorageItem, safeSetStorageItem } from './services/safeStorage'
import { getTimeContext } from './services/timeContext'
import type { CharacterKind, CharacterSource, SoulPetCharacter } from './types/soulPet'

type Route = '/' | '/create' | '/birth' | '/home' | '/chat' | '/memory' | '/profile'
type Personality = '温柔' | '活泼' | '傲娇' | '治愈'
type BirthStatus = 'preparing' | 'uploading' | 'generating' | 'success' | 'error' | 'preview' | 'processing' | 'compare'

const characterSources: CharacterSource[] = ['现实宠物', '虚拟角色', '原创角色']
const characterKinds: Record<CharacterSource, CharacterKind[]> = {
  现实宠物: ['猫', '狗', '兔子', '鸟'],
  虚拟角色: ['Q版角色占位'],
  原创角色: ['团子', '精灵', '小幽灵']
}
const personalities: Personality[] = ['温柔', '活泼', '傲娇', '治愈']
const bgmStorageKey = 'soulpet_bgm_enabled'
const bgmPath = '/audio/soulpet-home.mp3'
type HomePanel = 'diary' | 'album' | 'chat' | 'dressup' | 'help' | null
type ChatMessage = { id: string; speaker: 'user' | 'pet'; text: string }

const isMobileLikeBrowser = (): boolean =>
  /iPhone|iPad|iPod|Android|Mobile|MicroMessenger/i.test(window.navigator.userAgent)

const getCurrentRoute = (): Route => {
  const path = window.location.pathname
  if (path === '/create' || path === '/birth' || path === '/home' || path === '/chat' || path === '/memory' || path === '/profile') {
    return path
  }
  return '/'
}

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('图片读取失败'))
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })

const formatDisplayDate = (value: string): string =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))

const createDefaultPetImage = (kind: CharacterKind): string => {
  const colors = {
    猫: ['#f6d7a8', '#f0b98c', '#e98585'],
    狗: ['#d7b08a', '#9d765a', '#c16f4c'],
    兔子: ['#f7f1ea', '#f7c5ce', '#e9a0ae'],
    鸟: ['#9bd7e5', '#fff6bf', '#f0a44c'],
    团子: ['#fff8ea', '#dff1eb', '#ffb6b8'],
    精灵: ['#cfeee2', '#95cdb9', '#9d8ce3'],
    小幽灵: ['#f8fbff', '#dfe8ff', '#9fb1d9'],
    Q版角色占位: ['#e7d8ff', '#fff8ea', '#8c76d6']
  }[kind]
  const [body, accent, detail] = colors
  const ears =
    kind === '兔子'
      ? '<path d="M176 147c-42-84-31-129 14-143 46 62 57 108 32 153" fill="' + accent + '"/><path d="M336 147c42-84 31-129-14-143-46 62-57 108-32 153" fill="' + accent + '"/>'
      : kind === '鸟'
        ? '<path d="M145 214c-53 8-88 38-103 88 54 14 93-1 122-46" fill="' + accent + '"/><path d="M367 214c53 8 88 38 103 88-54 14-93-1-122-46" fill="' + accent + '"/>'
        : '<path d="M151 145c-24-47-18-81 13-103 48 20 76 51 83 94" fill="' + accent + '"/><path d="M361 145c24-47 18-81-13-103-48 20-76 51-83 94" fill="' + accent + '"/>'
  const bodyPath =
    kind === '小幽灵'
      ? 'M112 260c0-99 64-164 144-164s144 65 144 164v110c-30 15-58 11-84-15-27 35-67 35-94 0-27 35-67 35-94 0-28 29-56 33-116 15Z'
      : 'M112 252c0-99 64-164 144-164s144 65 144 164c0 95-57 169-144 169s-144-74-144-169Z'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><filter id="s"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#5d8d81" flood-opacity=".24"/></filter></defs><ellipse cx="256" cy="404" rx="148" ry="32" fill="#8fcf7b" opacity=".38"/><g filter="url(#s)">${ears}<path d="${bodyPath}" fill="${body}"/><circle cx="205" cy="248" r="19" fill="#263c38"/><circle cx="307" cy="248" r="19" fill="#263c38"/><path d="M235 302c13 15 29 15 42 0" fill="none" stroke="#41645e" stroke-width="12" stroke-linecap="round"/><circle cx="160" cy="294" r="24" fill="${detail}" opacity=".42"/><circle cx="352" cy="294" r="24" fill="${detail}" opacity=".42"/></g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const createCharacter = (
  name: string,
  source: CharacterSource,
  kind: CharacterKind,
  personality: Personality,
  originalImage?: string
): SoulPetCharacter => {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: name.trim() || '未命名 SoulPet',
    source,
    kind,
    personality,
    originalImage,
    activeCharacterImageType: source === '现实宠物' ? 'generated' : 'original',
    activeAccessory: 'none',
    createdAt: now,
    lastUpdatedAt: now,
    lastVisitedAt: now,
    ...createInitialLifeValues()
  }
}

const getActiveImage = (character: SoulPetCharacter | null): string | undefined => {
  if (!character) return undefined
  if (character.source === '现实宠物') return character.generatedPetImage || character.originalImage
  if (character.activeCharacterImageType === 'processed') {
    return character.processedCharacterImage || character.originalImage
  }
  return character.originalImage
}

const App = () => {
  const [route, setRoute] = useState<Route>(getCurrentRoute)
  const [character, setCharacter] = useState<SoulPetCharacter | null>(null)
  const [storageNotice, setStorageNotice] = useState('')
  const [name, setName] = useState('')
  const [source, setSource] = useState<CharacterSource>('现实宠物')
  const [kind, setKind] = useState<CharacterKind>('猫')
  const [personality, setPersonality] = useState<Personality>('温柔')
  const [uploadedImage, setUploadedImage] = useState('')
  const [hasTransparency, setHasTransparency] = useState(false)
  const [birthStatus, setBirthStatus] = useState<BirthStatus>('preview')
  const [birthError, setBirthError] = useState('')
  const [processedPreview, setProcessedPreview] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [bubbleOverride, setBubbleOverride] = useState('')
  const [feedback, setFeedback] = useState<'none' | 'feed' | 'pet'>('none')
  const [simulatePetFailure, setSimulatePetFailure] = useState(false)
  const [simulateCutoutFailure, setSimulateCutoutFailure] = useState(false)
  const [isBgmEnabled, setIsBgmEnabled] = useState(() => safeGetStorageItem(bgmStorageKey) !== 'false')
  const [isBgmPlaying, setIsBgmPlaying] = useState(false)
  const [homePanel, setHomePanel] = useState<HomePanel>(null)
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(() => loadDiaryEntries())
  const [albumItems, setAlbumItems] = useState<AlbumItem[]>(() => loadAlbumItems())
  const [activeAccessory, setActiveAccessory] = useState<AccessoryId>(() => loadActiveAccessory())
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [roomSpot, setRoomSpot] = useState<PetRoomSpot>(defaultRoomSpot)
  const [roomActivityText, setRoomActivityText] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeStatusTimerRef = useRef<number | undefined>(undefined)
  const activeStatusClearRef = useRef<number | undefined>(undefined)
  const roomBehaviorTimerRef = useRef<number | undefined>(undefined)
  const roomActivityClearRef = useRef<number | undefined>(undefined)
  const isDebug = new URLSearchParams(window.location.search).get('debug') === '1'

  const timeContext = useMemo(() => getTimeContext(), [character?.lastUpdatedAt, route])
  const displayedBubbleOverride = roomActivityText || bubbleOverride
  const lifeVisual = character ? resolveLifeVisual(character, timeContext, displayedBubbleOverride) : null
  const activeImage = getActiveImage(character)
  const growthStage = character ? getGrowthStage(character) : ''
  const companionDays = character ? getCompanionDays(character) : 1
  const selectedAccessory = getAccessoryOption(activeAccessory)

  useEffect(() => {
    const handlePopState = () => setRoute(getCurrentRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    setKind(characterKinds[source][0])
  }, [source])

  useEffect(() => {
    void loadSoulPetCharacter().then((stored) => {
      if (stored) {
        const storedAccessory = stored.activeAccessory || loadActiveAccessory()
        setActiveAccessory(storedAccessory)
        setCharacter(applyOfflineLifeSettlement({ ...stored, activeAccessory: storedAccessory }))
      }
    })
  }, [])

  useEffect(() => {
    if (!character) return
    void saveSoulPetCharacter(character).catch(() => {
      setStorageNotice('本地图片保存受限，本次会话仍可继续使用。')
    })
  }, [character])

  useEffect(() => {
    const settle = () => {
      setCharacter((current) => (current ? applyOfflineLifeSettlement(current) : current))
    }
    window.addEventListener('focus', settle)
    if (route === '/home') settle()
    return () => window.removeEventListener('focus', settle)
  }, [route])

  useEffect(() => {
    if (route !== '/home') return

    const audio = new Audio(bgmPath)
    audio.loop = true
    audio.preload = 'none'
    audio.volume = 0.35
    audioRef.current = audio

    const handlePlay = () => setIsBgmPlaying(true)
    const handlePause = () => setIsBgmPlaying(false)
    const handleError = () => setIsBgmPlaying(false)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('error', handleError)

    if (isBgmEnabled && !isMobileLikeBrowser()) {
      void audio.play().catch(() => setIsBgmPlaying(false))
    }

    return () => {
      audio.pause()
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('error', handleError)
      audioRef.current = null
      setIsBgmPlaying(false)
    }
  }, [route, isBgmEnabled])

  useEffect(() => {
    if (route !== '/home' || !isBgmEnabled) return

    const tryResumeBgm = () => {
      void audioRef.current?.play().catch(() => setIsBgmPlaying(false))
      window.removeEventListener('pointerdown', tryResumeBgm)
      window.removeEventListener('keydown', tryResumeBgm)
    }

    window.addEventListener('pointerdown', tryResumeBgm, { once: true })
    window.addEventListener('keydown', tryResumeBgm, { once: true })

    return () => {
      window.removeEventListener('pointerdown', tryResumeBgm)
      window.removeEventListener('keydown', tryResumeBgm)
    }
  }, [route, isBgmEnabled])

  useEffect(() => {
    if (route !== '/home' || !character) return

    const now = new Date()
    const lastVisitedAt = character.lastVisitedAt ? new Date(character.lastVisitedAt) : now
    const awayHours = Math.max(0, (now.getTime() - lastVisitedAt.getTime()) / 3600000)
    if (awayHours < 0.01) return

    const reunion =
      awayHours >= 72
        ? { text: '我还以为你不会回来了……但你回来真好。', mood: 10, bond: 3, diary: '离开了好几天，它一直在等你回家。' }
        : awayHours >= 24
          ? { text: '昨天没有见到你，有一点想你。', mood: 8, bond: 2, diary: '昨天没有见到你，它有一点想你。' }
          : awayHours >= 6
            ? { text: '你回来啦，我等你好久啦。', mood: 5, bond: 1, diary: '隔了好久再见面，它立刻认出了你。' }
            : null

    if (reunion) {
      setBubbleOverride(reunion.text)
      setDiaryEntries(recordReturnDiary(reunion.diary))
      window.setTimeout(() => setBubbleOverride(''), 5000)
    }

    setCharacter((current) => {
      if (!current || current.id !== character.id) return current
      const visitedUpdate = { ...current, lastVisitedAt: now.toISOString() }
      return reunion
        ? updateLifeValue(visitedUpdate, {
            mood: visitedUpdate.mood + reunion.mood,
            bond: visitedUpdate.bond + reunion.bond
          })
        : visitedUpdate
    })
  }, [route, character?.id, character?.lastVisitedAt])

  useEffect(() => {
    if (route !== '/home' || !character) return

    const scheduleActiveStatus = () => {
      const delay = getNextActiveMomentDelay()
      activeStatusTimerRef.current = window.setTimeout(() => {
        const text = resolveActiveMoment(character, resolveLifeStage(character.bond))
        if (!text) {
          scheduleActiveStatus()
          return
        }
        setBubbleOverride(text)
        activeStatusClearRef.current = window.setTimeout(() => {
          setBubbleOverride('')
          scheduleActiveStatus()
        }, 5000)
      }, delay)
    }

    scheduleActiveStatus()

    return () => {
      window.clearTimeout(activeStatusTimerRef.current)
      window.clearTimeout(activeStatusClearRef.current)
    }
  }, [route, character?.id, character?.bond, character?.mood, character?.satiety, character?.energy])

  useEffect(() => {
    if (route !== '/home' || !character) return

    const moveToNextSpot = () => {
      const nextSpot = resolveNextRoomSpot(character, timeContext)
      setRoomSpot(nextSpot)
      setRoomActivityText(resolveRoomActivityText(nextSpot, character))
      window.clearTimeout(roomActivityClearRef.current)
      roomActivityClearRef.current = window.setTimeout(() => setRoomActivityText(''), 5200)
    }

    const scheduleRoomBehavior = () => {
      const delay = getNextRoomBehaviorDelay()
      roomBehaviorTimerRef.current = window.setTimeout(() => {
        moveToNextSpot()
        scheduleRoomBehavior()
      }, delay)
    }

    scheduleRoomBehavior()

    return () => {
      window.clearTimeout(roomBehaviorTimerRef.current)
      window.clearTimeout(roomActivityClearRef.current)
    }
  }, [route, character?.id, character?.bond, character?.mood, character?.satiety, character?.energy, timeContext.timePeriod])

  useEffect(() => {
    if (route !== '/home' || !character) return
    setAlbumItems(recordFirstHomeAlbum(activeImage))
  }, [route, character?.id, activeImage])

  useEffect(() => {
    if (!character) return
    const stage = resolveLifeStage(character.bond)
    if (stage.name === '初遇期') return
    setDiaryEntries(recordStageDiary(stage))
  }, [character?.bond, character?.id])

  const navigate = (nextRoute: Route) => {
    window.history.pushState({}, '', nextRoute)
    setRoute(nextRoute)
  }

  const handleRouteLink = (event: MouseEvent<HTMLAnchorElement>, nextRoute: Route) => {
    event.preventDefault()
    navigate(nextRoute)
  }

  const showFeedback = (type: 'feed' | 'pet', text: string) => {
    setFeedback(type)
    setBubbleOverride(text)
    window.setTimeout(() => setFeedback('none'), 900)
    window.setTimeout(() => setBubbleOverride(''), 2600)
  }

  const toggleBgm = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isBgmPlaying) {
      audio.pause()
      safeSetStorageItem(bgmStorageKey, 'false')
      setIsBgmEnabled(false)
      return
    }

    safeSetStorageItem(bgmStorageKey, 'true')
    setIsBgmEnabled(true)
    void audio.play().catch(() => setIsBgmPlaying(false))
  }

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const image = await readFileAsDataURL(file)
    setUploadedImage(image)
    setHasTransparency(await hasMeaningfulTransparency(image).catch(() => false))
  }

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextCharacter = createCharacter(name, source, kind, personality, uploadedImage || undefined)
    setCharacter(nextCharacter)
    setDiaryEntries(recordBirthDiary())
    setBirthError('')
    setProcessedPreview('')
    setBirthStatus(source === '现实宠物' ? 'preparing' : 'preview')
    navigate('/birth')
  }

  const runRealPetGeneration = async () => {
    if (!character?.originalImage || isBusy) return
    setIsBusy(true)
    setBirthError('')
    setBirthStatus('uploading')
    window.setTimeout(() => setBirthStatus('generating'), 300)
    const result = simulatePetFailure
      ? { error: '已模拟 AI 宠物生成失败', code: 'IMAGE_GENERATION_FAILED' }
      : await generatePetWithAI(character.originalImage, {
          name: character.name,
          personality: character.personality,
          source: character.source
        })
    setIsBusy(false)
    if (result.image) {
      setCharacter({ ...character, generatedPetImage: result.image, activeCharacterImageType: 'generated' })
      setAlbumItems(recordBirthAlbum(result.image))
      setBirthStatus('success')
    } else {
      setBirthError(result.error || '生成失败，可以重试或暂时使用原图。')
      setBirthStatus('error')
    }
  }

  const runCharacterCutout = async () => {
    if (!character?.originalImage || isBusy) return
    setIsBusy(true)
    setBirthError('')
    setBirthStatus('processing')
    const result = simulateCutoutFailure
      ? { error: '已模拟 AI 抠图失败', code: 'BACKGROUND_REMOVAL_FAILED' }
      : await removeCharacterBackgroundWithAI(character.originalImage, {
          name: character.name,
          source: character.source
        })
    setIsBusy(false)
    if (result.image) {
      setProcessedPreview(result.image)
      setBirthStatus('compare')
    } else {
      setBirthError(result.error || '智能抠图失败，可以重试或保留原图。')
      setBirthStatus('error')
    }
  }

  const chooseProcessedImage = () => {
    if (!character || !processedPreview) return
    setCharacter({
      ...character,
      processedCharacterImage: processedPreview,
      activeCharacterImageType: 'processed'
    })
    setAlbumItems(recordBirthAlbum(processedPreview))
    setBirthStatus('success')
  }

  const chooseOriginalImage = () => {
    if (!character) return
    setCharacter({ ...character, activeCharacterImageType: 'original' })
    setAlbumItems(recordBirthAlbum(character.originalImage))
    setBirthStatus('success')
  }

  const useOriginalForRealPet = () => {
    if (!character) return
    setCharacter({ ...character, activeCharacterImageType: 'original' })
    setAlbumItems(recordBirthAlbum(character.originalImage))
    setBirthStatus('success')
  }

  const handleFeed = () => {
    if (!character) return
    if (character.lastFedAt && Date.now() - new Date(character.lastFedAt).getTime() < 10000) {
      showFeedback('feed', '刚吃完，让肚子休息一下吧。')
      return
    }
    setCharacter({
      ...updateLifeValue(character, {
        satiety: character.satiety + 15,
        mood: character.mood + 5,
        bond: character.bond + 2
      }),
      lastFedAt: new Date().toISOString()
    })
    setRoomSpot(defaultRoomSpot)
    setDiaryEntries(recordFirstFeedDiary())
    showFeedback('feed', '好好吃，谢谢你！')
  }

  const handlePet = () => {
    if (!character) return
    const stage = resolveLifeStage(character.bond).name
    const approachText =
      roomSpot.activity === 'sleep' || lifeVisual?.shouldShowSleepBubble
        ? '唔……我醒啦。'
        : stage === '初遇期'
          ? '你是在叫我吗？'
          : stage === '熟悉期'
            ? '我来啦。'
            : stage === '依恋期'
              ? '我一直在这里。'
              : '我最喜欢你叫我啦。'

    setRoomSpot(getApproachSpot())
    setRoomActivityText('')
    setHomePanel('chat')
    setChatMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), speaker: 'pet', text: approachText }
    ])
    setBubbleOverride(approachText)

    if (character.lastPettedAt && Date.now() - new Date(character.lastPettedAt).getTime() < 5000) {
      window.setTimeout(() => setBubbleOverride(''), 3000)
      return
    }

    setCharacter({
      ...updateLifeValue(character, {
        mood: character.mood + 3,
        bond: character.bond + 1
      }),
      lastPettedAt: new Date().toISOString()
    })
    setDiaryEntries(recordFirstPetDiary())
    showFeedback('pet', approachText)
  }

  const clearLocalData = async () => {
    await clearSoulPetCharacter()
    setCharacter(null)
    navigate('/')
  }

  const clearCurrentImageCache = async () => {
    if (!character) return
    await clearSoulPetImageCache()
    setCharacter({
      ...character,
      generatedPetImage: undefined,
      processedCharacterImage: undefined,
      activeCharacterImageType: 'original'
    })
  }

  const restoreStats = () => {
    if (!character) return
    setCharacter({ ...character, satiety: 80, mood: 75, energy: 80, bond: 0, lastUpdatedAt: new Date().toISOString() })
  }

  const simulateLongAbsence = (hours: number) => {
    if (!character) return
    setCharacter({
      ...character,
      lastVisitedAt: new Date(Date.now() - hours * 3600000).toISOString(),
      lastUpdatedAt: new Date(Date.now() - hours * 3600000).toISOString()
    })
  }

  const openChatPanel = () => {
    if (!character) return
    setHomePanel('chat')

    if (lifeVisual?.shouldShowSleepBubble) {
      const text = '它已经睡着啦，明天再来找它吧。'
      setBubbleOverride(text)
      setChatMessages([{ id: crypto.randomUUID(), speaker: 'pet', text }])
      window.setTimeout(() => setBubbleOverride(''), 3200)
      return
    }

    setChatMessages((current) =>
      current.length > 0
        ? current
        : [{ id: crypto.randomUUID(), speaker: 'pet', text: '你来啦，要和我说说话吗？' }]
    )
  }

  const handleChatQuestion = (question: QuickChatQuestion) => {
    if (!character) return
    const reply = getLocalChatReply(question, character, timeContext)
    setChatMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), speaker: 'user', text: question },
      { id: crypto.randomUUID(), speaker: 'pet', text: reply }
    ])
    setDiaryEntries(recordFirstChatDiary())
    setBubbleOverride(reply)
    window.setTimeout(() => setBubbleOverride(''), 3600)
  }

  const handleAccessorySelect = (accessory: AccessoryId) => {
    if (!character) return
    const option = getAccessoryOption(accessory)
    setActiveAccessory(accessory)
    saveActiveAccessory(accessory)
    setCharacter({ ...character, activeAccessory: accessory })

    if (accessory === 'none') {
      setBubbleOverride('换回轻轻松松的样子啦。')
      window.setTimeout(() => setBubbleOverride(''), 2400)
      return
    }

    setDiaryEntries(recordFirstAccessoryDiary())
    setAlbumItems(recordAccessoryAlbum(option.name, activeImage))
    setBubbleOverride(`${option.name} 很适合我吗？`)
    window.setTimeout(() => setBubbleOverride(''), 2600)
  }

  const resetAccessory = () => {
    saveActiveAccessory('none')
    setActiveAccessory('none')
    if (character) setCharacter({ ...character, activeAccessory: 'none' })
  }

  const renderHomePanel = () => {
    if (!homePanel) return null

    const panelTitle = {
      diary: '成长日记',
      album: '回忆相册',
      chat: '和它说话',
      dressup: '选择装扮',
      help: '小家说明'
    }[homePanel]

    return (
      <div className="home-modal-backdrop" role="presentation" onClick={() => setHomePanel(null)}>
        <section className={`home-modal home-modal-${homePanel}`} role="dialog" aria-modal="true" aria-label={panelTitle} onClick={(event) => event.stopPropagation()}>
          <div className="home-modal-header">
            <h2>{panelTitle}</h2>
            <button aria-label="关闭" onClick={() => setHomePanel(null)}>×</button>
          </div>

          {homePanel === 'diary' && (
            <div className="diary-list">
              {diaryEntries.length === 0 ? (
                <p className="empty-panel-text">还没有记录，和它一起生活一会儿吧。</p>
              ) : (
                diaryEntries.map((entry) => (
                  <article className="diary-entry" key={entry.id}>
                    <time>{formatDisplayDate(entry.date)}</time>
                    <h3>{entry.title}</h3>
                    <p>{entry.content}</p>
                  </article>
                ))
              )}
            </div>
          )}

          {homePanel === 'album' && (
            <div className="album-grid">
              {albumItems.length === 0 ? (
                <p className="empty-panel-text">还没有照片，先和它创造第一段回忆吧。</p>
              ) : (
                albumItems.map((item) => (
                  <article className="album-card" key={item.id}>
                    <div className="album-image">{item.image ? <img alt={item.title} src={item.image} /> : <span>🏠</span>}</div>
                    <time>{formatDisplayDate(item.date)}</time>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                ))
              )}
            </div>
          )}

          {homePanel === 'chat' && (
            <div className="chat-panel-content">
              <div className="chat-messages">
                {chatMessages.map((message) => (
                  <p className={`chat-message ${message.speaker}`} key={message.id}>
                    {message.text}
                  </p>
                ))}
              </div>
              <div className="quick-chat-grid">
                {quickChatQuestions.map((question) => (
                  <button key={question} onClick={() => handleChatQuestion(question)}>{question}</button>
                ))}
              </div>
            </div>
          )}

          {homePanel === 'dressup' && (
            <div className="accessory-grid">
              {accessoryOptions.map((option) => (
                <button className={activeAccessory === option.id ? 'selected' : ''} key={option.id} onClick={() => handleAccessorySelect(option.id)}>
                  <span>{option.icon}</span>
                  {option.name}
                </button>
              ))}
            </div>
          )}

          {homePanel === 'help' && (
            <div className="help-panel-content">
              <p>每天回到小家，看看它的状态，投喂、摸摸、聊天都会让关系慢慢变近。</p>
              <p>成长日记会自动记录你们的重要瞬间，相册会留下诞生和装扮回忆。</p>
            </div>
          )}
        </section>
      </div>
    )
  }

  if (route === '/create') {
    return (
      <main className="app-page">
        <section className="create-layout">
          <div className="page-heading">
            <p className="eyebrow">Create SoulPet</p>
            <h1>基础信息</h1>
          </div>
          <form className="create-form" onSubmit={handleCreate}>
            <label className="field-group">
              <span>角色名称</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="给你的数字生命取个名字" />
            </label>
            <fieldset className="field-group">
              <legend>角色来源</legend>
              <div className="option-grid">
                {characterSources.map((item) => (
                  <label className="radio-card" key={item}>
                    <input checked={source === item} name="source" type="radio" onChange={() => setSource(item)} />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="field-group">
              <legend>形象类型</legend>
              <div className="option-grid kind-grid">
                {characterKinds[source].map((item) => (
                  <label className="radio-card" key={item}>
                    <input checked={kind === item} name="kind" type="radio" onChange={() => setKind(item)} />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="field-group">
              <legend>上传图片</legend>
              <p className="upload-hint">
                {source === '现实宠物'
                  ? '上传宠物照片，我们会根据它的真实特征生成专属 Q 版 SoulPet。'
                  : '上传你的 Q 版角色图、立绘或截图。可以直接使用原图，也可以一键智能抠图后住进 SoulPet 小家。'}
              </p>
              <label className="upload-box">
                <input accept="image/png,image/jpeg,image/jpg,image/webp" type="file" onChange={handleImageChange} />
                {uploadedImage ? <img alt="SoulPet 预览" src={uploadedImage} /> : <span>选择一张图片</span>}
              </label>
              {source !== '现实宠物' && uploadedImage && (
                <p className="upload-hint">
                  {hasTransparency ? '检测到透明背景，可以直接入住小家。' : 'AI 会识别角色主体并移除背景，保留人物外形、发型、服装和配饰。'}
                </p>
              )}
            </fieldset>
            <fieldset className="field-group">
              <legend>性格选择</legend>
              <div className="option-grid personality-grid">
                {personalities.map((item) => (
                  <label className="radio-card" key={item}>
                    <input checked={personality === item} name="personality" type="radio" onChange={() => setPersonality(item)} />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="primary-action form-action" type="submit" disabled={!uploadedImage || isBusy}>
              创建 SoulPet
            </button>
          </form>
        </section>
      </main>
    )
  }

  if (route === '/birth') {
    const isRealPet = character?.source === '现实宠物'
    return (
      <main className="app-page birth-page">
        <section className="birth-layout">
          <p className="eyebrow">SoulPet Birth</p>
          {isRealPet ? (
            <>
              <div className="birth-preview generated-preview">
                {birthStatus === 'success' && character?.generatedPetImage ? (
                  <img alt="生成的 Q 版 SoulPet" src={character.generatedPetImage} />
                ) : character?.originalImage ? (
                  <img alt="上传的宠物照片" src={character.originalImage} />
                ) : (
                  <span>宠物照片</span>
                )}
              </div>
              <h1>{birthStatus === 'success' ? `${character?.name ?? 'SoulPet'} 诞生了` : '正在根据你的宠物照片生成 Q版 SoulPet...'}</h1>
              {birthStatus === 'preparing' && <button className="primary-action form-action" onClick={runRealPetGeneration}>开始生成</button>}
              {(birthStatus === 'uploading' || birthStatus === 'generating') && <p className="birth-message">正在根据它的真实特征创造 SoulPet，这可能需要一些时间……</p>}
              {birthStatus === 'success' && (
                <>
                  <p className="birth-message">你好主人，我诞生啦。</p>
                  <button className="primary-action form-action" onClick={() => navigate('/home')}>进入小家</button>
                  <button className="secondary-action" onClick={runRealPetGeneration} disabled={isBusy}>重新生成一次</button>
                </>
              )}
              {birthStatus === 'error' && (
                <div className="birth-actions"><p className="error-text">{birthError}</p><button onClick={runRealPetGeneration}>重新生成</button><button onClick={useOriginalForRealPet}>暂时使用原图</button><button onClick={() => navigate('/create')}>返回重新上传</button></div>
              )}
            </>
          ) : (
            <>
              {birthStatus === 'preview' && (
                <>
                  <div className="birth-preview source-preview">{character?.originalImage ? <img alt="原图" src={character.originalImage} /> : <span>原图预览</span>}</div>
                  <h1>{hasTransparency ? '检测到透明背景，可以直接入住小家。' : '要为角色移除背景吗？'}</h1>
                  <button className="primary-action form-action" onClick={runCharacterCutout} disabled={isBusy}>{hasTransparency ? '重新智能抠图' : '一键智能抠图'}</button>
                  <button className="secondary-action" onClick={chooseOriginalImage}>直接使用原图</button>
                </>
              )}
              {birthStatus === 'processing' && <><div className="birth-preview source-preview">{character?.originalImage && <img alt="原图" src={character.originalImage} />}</div><h1>正在智能识别角色并移除背景，请稍等……</h1></>}
              {birthStatus === 'compare' && (
                <>
                  <div className="compare-panel">
                    <div><span>原图</span>{character?.originalImage && <img alt="原图" src={character.originalImage} />}</div>
                    <div className="checkerboard"><span>处理后透明图</span>{processedPreview && <img alt="处理后透明图" src={processedPreview} />}</div>
                  </div>
                  <div className="birth-actions"><button onClick={chooseProcessedImage}>使用处理后图片</button><button onClick={chooseOriginalImage}>保留原图</button><button onClick={runCharacterCutout}>重新智能抠图</button></div>
                </>
              )}
              {birthStatus === 'success' && <><div className="birth-preview generated-preview">{getActiveImage(character) && <img alt="SoulPet" src={getActiveImage(character)} />}</div><h1>{character?.name ?? 'SoulPet'} 入住小家了</h1><button className="primary-action form-action" onClick={() => navigate('/home')}>进入小家</button></>}
              {birthStatus === 'error' && <div className="birth-actions"><p className="error-text">{birthError}</p><button onClick={runCharacterCutout}>重新智能抠图</button><button onClick={chooseOriginalImage}>暂时使用原图</button><button onClick={() => navigate('/create')}>返回重新上传</button></div>}
            </>
          )}
        </section>
      </main>
    )
  }

  if (route === '/chat') {
    if (!character) {
      return <main className="app-page"><section className="placeholder-layout"><p className="eyebrow">SoulPet Chat</p><h1>还没有 SoulPet</h1><button className="primary-action form-action" onClick={() => navigate('/create')}>创建我的 SoulPet</button></section></main>
    }

    return (
      <main className="app-page">
        <section className="placeholder-layout chat-standalone">
          <p className="eyebrow">SoulPet Chat</p>
          <h1>和 {character.name} 说话</h1>
          <div className="chat-panel-content">
            <div className="chat-messages">
              {(chatMessages.length > 0 ? chatMessages : [{ id: 'hello', speaker: 'pet' as const, text: '你来啦，要和我说说话吗？' }]).map((message) => (
                <p className={`chat-message ${message.speaker}`} key={message.id}>{message.text}</p>
              ))}
            </div>
            <div className="quick-chat-grid">
              {quickChatQuestions.map((question) => (
                <button key={question} onClick={() => handleChatQuestion(question)}>{question}</button>
              ))}
            </div>
          </div>
          <button className="primary-action form-action" onClick={() => navigate('/home')}>返回 SoulPet Home</button>
        </section>
      </main>
    )
  }

  if (route === '/memory') {
    return (
      <main className="app-page">
        <section className="placeholder-layout">
          <p className="eyebrow">SoulPet Memory</p>
          <h1>回忆相册</h1>
          <div className="album-grid standalone-album">
            {albumItems.length === 0 ? (
              <p className="empty-panel-text">还没有照片，先和它创造第一段回忆吧。</p>
            ) : (
              albumItems.map((item) => (
                <article className="album-card" key={item.id}>
                  <div className="album-image">{item.image ? <img alt={item.title} src={item.image} /> : <span>🏠</span>}</div>
                  <time>{formatDisplayDate(item.date)}</time>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))
            )}
          </div>
          <button className="primary-action form-action" onClick={() => navigate('/home')}>返回 SoulPet Home</button>
        </section>
      </main>
    )
  }

  if (route === '/profile') {
    return (
      <main className="app-page">
        <section className="profile-layout">
          <div className="profile-image">{activeImage ? <img alt={character?.name} src={activeImage} /> : <span>SoulPet</span>}</div>
          <div className="profile-content">
            <p className="eyebrow">SoulPet Profile</p>
            <h1>{character?.name ?? '还没有创建 SoulPet'}</h1>
            {character && <dl className="profile-list"><div><dt>角色来源</dt><dd>{character.source}</dd></div><div><dt>性格</dt><dd>{character.personality}</dd></div><div><dt>亲密度</dt><dd>{character.bond}</dd></div></dl>}
            <button className="primary-action form-action" onClick={() => navigate('/home')}>返回 SoulPet Home</button>
          </div>
        </section>
      </main>
    )
  }

  if (route === '/home') {
    if (!character) {
      return <main className="app-page"><section className="placeholder-layout"><p className="eyebrow">SoulPet Home</p><h1>还没有 SoulPet</h1><p className="subtitle compact">先创建一个属于你的数字生命。</p><a className="primary-action form-action" href="/create" onClick={(event) => handleRouteLink(event, '/create')}>创建我的 SoulPet</a></section></main>
    }

    const roomAnimationClass =
      roomSpot.activity === 'sleep'
        ? 'sleepy-float'
        : roomSpot.activity === 'play'
          ? 'happy-bounce'
          : roomSpot.activity === 'wander'
            ? 'room-wander'
            : roomSpot.activity === 'watch'
              ? 'room-watch'
              : roomSpot.activity === 'talk'
                ? 'room-talk'
                : lifeVisual?.animationClass || ''
    const petStageStyle = {
      '--room-x': `${roomSpot.x}%`,
      '--room-y': `${roomSpot.y}%`
    } as CSSProperties
    const petScale = (lifeVisual?.petScale || 1) * roomSpot.scale
    const showSleepBubble = lifeVisual?.shouldShowSleepBubble || roomSpot.activity === 'sleep'

    return (
      <main className={`app-page pet-home-page ${timeContext.sceneClass} ${showSleepBubble ? 'is-sleepy' : ''}`}>
        <section className="pet-home-layout" aria-label="SoulPet 小家">
          <div className="home-scene" aria-hidden="true">
            <span className="attic-roof" />
            <span className="roof-beam beam-left" />
            <span className="roof-beam beam-right" />
            <span className="skylight"><i /></span>
            <span className="vine vine-left" />
            <span className="vine vine-right" />
            <span className="sunbeam sunbeam-one" />
            <span className="sunbeam sunbeam-two" />
            <span className="sun-spot spot-one" />
            <span className="sun-spot spot-two" />
            <span className="cloud cloud-one" />
            <span className="cloud cloud-two" />
            <span className="window-shape"><i /><b /></span>
            <span className="wall-lamp" />
            <span className="soft-sofa"><i /></span>
            <span className="pet-bed"><i /><b /></span>
            <span className="cat-tree"><i /><b /><em /></span>
            <span className="toy-ball" />
            <span className="toy-mouse" />
            <span className="fish-mobile"><i /><b /></span>
            <span className="small-door" />
            <span className="wood-cabinet"><i /><b /></span>
            <span className="plant plant-left" />
            <span className="plant plant-right" />
            <span className="floor-rug" />
            <span className="entry-mat" />
            <span className="wall-star star-one" />
            <span className="wall-star star-two" />
            <span className="ambient-icon">{timeContext.ambientIcon}</span>
          </div>
          <div className="game-status-bar">
            <div className="mini-avatar" aria-hidden="true">{activeImage ? <img alt="" src={activeImage} /> : <div className="mini-q-pet"><span /></div>}</div>
            <div className="status-meta">
              <strong>{character.name}</strong>
              <span>❤️ 亲密度：{character.bond} · {lifeVisual?.lifeStage.label || growthStage}</span>
              <small>陪伴第 {companionDays} 天　🍙 {character.satiety}　😊 {character.mood}　⚡ {character.energy}</small>
            </div>
            <div className="status-progress" aria-hidden="true"><div style={{ width: `${character.bond}%` }} /></div>
          </div>
          <div className="side-actions left-actions" aria-label="小家功能"><button onClick={() => setHomePanel('diary')}>成长日记</button><button onClick={() => setHomePanel('album')}>相册</button><button onClick={() => { setBubbleOverride('伙伴功能开发中'); window.setTimeout(() => setBubbleOverride(''), 2200) }}>伙伴</button></div>
          <div className="side-actions right-actions" aria-label="轻量设置"><button onClick={() => { setBubbleOverride('设置功能开发中'); window.setTimeout(() => setBubbleOverride(''), 2200) }}>设置</button><button className={isBgmPlaying ? 'is-playing' : ''} onClick={toggleBgm}>{isBgmPlaying ? '播放中' : '音乐'}{isBgmPlaying && <span className="music-note" aria-hidden="true">♪</span>}</button><button onClick={() => setHomePanel('help')}>帮助</button></div>
          <div className={`home-pet-stage spot-${roomSpot.id} activity-${roomSpot.activity}`} style={petStageStyle} aria-label={`${character.name} 的小家`}>
            <div className="status-bubble">{lifeVisual?.bubbleText}</div>
            {showSleepBubble && <div className="zzz">Zzz</div>}
            {lifeVisual?.shouldShowHungerHint && <div className="hunger-hint" aria-hidden="true">🍙</div>}
            {lifeVisual?.shouldShowLonelyHint && <div className="lonely-hint" aria-hidden="true">♡</div>}
            <button className={`pet-character ${roomAnimationClass} ${feedback === 'pet' ? 'is-petted' : ''} ${feedback === 'feed' ? 'is-fed' : ''}`} style={{ '--pet-scale': petScale } as CSSProperties} onClick={handlePet} aria-label={`抚摸 ${character.name}`}>
              {activeAccessory !== 'none' && <span className={`pet-accessory accessory-${activeAccessory}`} aria-label={selectedAccessory.name}>{selectedAccessory.icon}</span>}
              {activeImage ? <img alt={character.name} className="home-pet-image" src={activeImage} onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <img alt={character.name} className="home-pet-image" src={createDefaultPetImage(character.kind)} />}
            </button>
            {feedback !== 'none' && <div className={`feedback-particles ${feedback}`}><span>❤</span><span>{feedback === 'feed' ? '●' : '❤'}</span><span>❤</span></div>}
            <div className="home-life-caption"><strong>{lifeVisual?.statusIcon} {lifeVisual?.mainEmotion} · {timeContext.timePeriod}</strong><span>{timeContext.greeting}</span></div>
          </div>
          <div className="pet-actions" aria-label="主互动"><button onClick={openChatPanel}>聊天</button><button className={lifeVisual?.shouldShowHungerHint ? 'needs-attention' : ''} onClick={handleFeed}>投喂</button><button onClick={() => setHomePanel('dressup')}>装扮</button></div>
          {storageNotice && <div className="storage-notice">{storageNotice}</div>}
          {renderHomePanel()}
          {isDebug && (
            <div className="debug-panel">
              <strong>Debug</strong>
              <button onClick={() => setCharacter({ ...character, lastUpdatedAt: new Date(Date.now() - 3600000).toISOString() })}>时间前进 1 小时</button>
              <button onClick={() => setCharacter(updateLifeValue(character, { bond: character.bond + 20 }))}>bond +20</button>
              <button onClick={() => setCharacter(updateLifeValue(character, { mood: character.mood - 40 }))}>mood -40</button>
              <button onClick={() => setCharacter(updateLifeValue(character, { satiety: character.satiety - 40 }))}>satiety -40</button>
              <button onClick={() => setCharacter(updateLifeValue(character, { energy: character.energy - 40 }))}>energy -40</button>
              <button onClick={restoreStats}>状态全部恢复</button>
              <button onClick={() => simulateLongAbsence(8)}>模拟离开 8 小时</button>
              <button onClick={() => simulateLongAbsence(24)}>模拟离开 1 天</button>
              <button onClick={() => simulateLongAbsence(72)}>模拟离开 3 天</button>
              <button onClick={() => setDiaryEntries(clearDiaryEntries())}>清空成长日记</button>
              <button onClick={() => setAlbumItems(clearAlbumItems())}>清空相册</button>
              <button onClick={resetAccessory}>重置装扮</button>
              <button onClick={clearCurrentImageCache}>清除当前 SoulPet 图片缓存</button>
              <button onClick={clearLocalData}>清除本地角色数据</button>
              <button onClick={() => setSimulatePetFailure((value) => !value)}>模拟 AI 宠物生成失败</button>
              <button onClick={() => setSimulateCutoutFailure((value) => !value)}>模拟 AI 抠图失败</button>
            </div>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="home-page">
      <section className="hero">
        <p className="eyebrow">AI digital life companion</p>
        <h1>SoulPet</h1>
        <p className="subtitle">把现实宠物和虚拟角色转化为数字生命</p>
        <a className="primary-action" href="/create" onClick={(event) => handleRouteLink(event, '/create')}>创建我的 SoulPet</a>
      </section>
    </main>
  )
}

export default App
