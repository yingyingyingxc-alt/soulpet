import { ChangeEvent, FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { applyOfflineLifeSettlement, createInitialLifeValues, getCompanionDays, getGrowthStage, updateLifeValue } from './config/lifeSystem'
import { generatePetWithAI, removeCharacterBackgroundWithAI } from './services/imageApi'
import { hasMeaningfulTransparency } from './services/imageTransparency'
import { clearSoulPetCharacter, clearSoulPetImageCache, loadSoulPetCharacter, saveSoulPetCharacter } from './services/petStorage'
import { resolvePetState } from './services/petStateResolver'
import { getTimeContext } from './services/timeContext'
import type { ActiveCharacterImageType, CharacterKind, CharacterSource, SoulPetCharacter } from './types/soulPet'

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
const activeStatusTexts = ['偷偷看了你一眼', '在小家里转了一圈', '轻轻蹭了蹭你', '好像有话想说', '正在发呆']

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
  const [isBgmEnabled, setIsBgmEnabled] = useState(() => localStorage.getItem(bgmStorageKey) !== 'false')
  const [isBgmPlaying, setIsBgmPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeStatusTimerRef = useRef<number | undefined>(undefined)
  const activeStatusClearRef = useRef<number | undefined>(undefined)
  const isDebug = new URLSearchParams(window.location.search).get('debug') === '1'

  const timeContext = useMemo(() => getTimeContext(), [character?.lastUpdatedAt, route])
  const resolvedState = character ? resolvePetState(character, timeContext, bubbleOverride) : null
  const activeImage = getActiveImage(character)
  const growthStage = character ? getGrowthStage(character) : ''
  const companionDays = character ? getCompanionDays(character) : 1

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
      if (stored) setCharacter(applyOfflineLifeSettlement(stored))
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
    audio.volume = 0.35
    audioRef.current = audio

    const handlePlay = () => setIsBgmPlaying(true)
    const handlePause = () => setIsBgmPlaying(false)
    const handleError = () => setIsBgmPlaying(false)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('error', handleError)

    if (isBgmEnabled) {
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

    const reunionText =
      awayHours >= 24
        ? '昨天没有见到你，有一点想你。'
        : awayHours >= 6
          ? '你回来啦，我等你好久啦。'
          : ''

    if (reunionText) {
      setBubbleOverride(reunionText)
      window.setTimeout(() => setBubbleOverride(''), 5000)
    }

    setCharacter((current) => {
      if (!current || current.id !== character.id) return current
      const visitedUpdate = { ...current, lastVisitedAt: now.toISOString() }
      return reunionText
        ? updateLifeValue(visitedUpdate, {
            mood: visitedUpdate.mood + 5,
            bond: visitedUpdate.bond + 1
          })
        : visitedUpdate
    })
  }, [route, character?.id, character?.lastVisitedAt])

  useEffect(() => {
    if (route !== '/home' || !character) return

    const scheduleActiveStatus = () => {
      const delay = 30000 + Math.floor(Math.random() * 30000)
      activeStatusTimerRef.current = window.setTimeout(() => {
        const text = activeStatusTexts[Math.floor(Math.random() * activeStatusTexts.length)]
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
  }, [route, character?.id])

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
      localStorage.setItem(bgmStorageKey, 'false')
      setIsBgmEnabled(false)
      return
    }

    localStorage.setItem(bgmStorageKey, 'true')
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
    setBirthStatus('success')
  }

  const chooseOriginalImage = () => {
    if (!character) return
    setCharacter({ ...character, activeCharacterImageType: 'original' })
    setBirthStatus('success')
  }

  const useOriginalForRealPet = () => {
    if (!character) return
    setCharacter({ ...character, activeCharacterImageType: 'original' })
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
    showFeedback('feed', '好好吃，谢谢你！')
  }

  const handlePet = () => {
    if (!character) return
    if (character.lastPettedAt && Date.now() - new Date(character.lastPettedAt).getTime() < 5000) return
    setCharacter({
      ...updateLifeValue(character, {
        mood: character.mood + 3,
        bond: character.bond + 1
      }),
      lastPettedAt: new Date().toISOString()
    })
    showFeedback('pet', '再摸一下也可以哦。')
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
    return <main className="app-page"><section className="placeholder-layout"><p className="eyebrow">SoulPet Chat</p><h1>聊天功能开发中</h1><button className="primary-action form-action" onClick={() => navigate('/home')}>返回 SoulPet Home</button></section></main>
  }

  if (route === '/memory') {
    return <main className="app-page"><section className="placeholder-layout"><p className="eyebrow">SoulPet Memory</p><h1>记忆功能开发中</h1><button className="primary-action form-action" onClick={() => navigate('/home')}>返回 SoulPet Home</button></section></main>
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

    return (
      <main className={`app-page pet-home-page ${timeContext.sceneClass} ${resolvedState?.animationType === 'sleepy' ? 'is-sleepy' : ''}`}>
        <section className="pet-home-layout" aria-label="SoulPet 小家">
          <div className="home-scene" aria-hidden="true"><span className="cloud cloud-one" /><span className="cloud cloud-two" /><span className="window-shape" /><span className="house-shelf" /><span className="plant plant-left" /><span className="plant plant-right" /><span className="floor-rug" /><span className="wall-star star-one" /><span className="wall-star star-two" /><span className="ambient-icon">{timeContext.ambientIcon}</span></div>
          <div className="game-status-bar">
            <div className="mini-avatar" aria-hidden="true">{activeImage ? <img alt="" src={activeImage} /> : <div className="mini-q-pet"><span /></div>}</div>
            <div className="status-meta"><strong>{character.name}</strong><span>❤️ 亲密度：{character.bond} · {growthStage}</span><small>陪伴第 {companionDays} 天　🍙 {character.satiety}　😊 {character.mood}　⚡ {character.energy}</small></div>
            <div className="status-progress" aria-hidden="true"><div style={{ width: `${character.bond}%` }} /></div>
          </div>
          <div className="side-actions left-actions" aria-label="小家功能"><button onClick={() => navigate('/profile')}>成长日记</button><button>相册</button><button>伙伴</button></div>
          <div className="side-actions right-actions" aria-label="轻量设置"><button>设置</button><button className={isBgmPlaying ? 'is-playing' : ''} onClick={toggleBgm}>{isBgmPlaying ? '播放中' : '音乐'}{isBgmPlaying && <span className="music-note" aria-hidden="true">♪</span>}</button><button>帮助</button></div>
          <div className="home-pet-stage" aria-label={`${character.name} 的小家`}>
            <div className="status-bubble">{resolvedState?.bubbleText}</div>
            {resolvedState?.animationType === 'sleepy' && <div className="zzz">Zzz</div>}
            <button className={`pet-character ${feedback === 'pet' ? 'is-petted' : ''} ${feedback === 'feed' ? 'is-fed' : ''}`} onClick={handlePet} aria-label={`抚摸 ${character.name}`}>
              {activeImage ? <img alt={character.name} className="home-pet-image" src={activeImage} onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <img alt={character.name} className="home-pet-image" src={createDefaultPetImage(character.kind)} />}
            </button>
            {feedback !== 'none' && <div className={`feedback-particles ${feedback}`}><span>❤</span><span>{feedback === 'feed' ? '●' : '❤'}</span><span>❤</span></div>}
            <div className="home-life-caption"><strong>{resolvedState?.moodIcon} {timeContext.timePeriod}</strong><span>{timeContext.greeting}</span></div>
          </div>
          <div className="pet-actions" aria-label="主互动"><button onClick={() => navigate('/chat')}>聊天</button><button onClick={handleFeed}>投喂</button><button onClick={() => { setBubbleOverride('装扮功能开发中'); window.setTimeout(() => setBubbleOverride(''), 2200) }}>装扮</button></div>
          {storageNotice && <div className="storage-notice">{storageNotice}</div>}
          {isDebug && (
            <div className="debug-panel">
              <strong>Debug</strong>
              <button onClick={() => setCharacter({ ...character, lastUpdatedAt: new Date(Date.now() - 3600000).toISOString() })}>时间前进 1 小时</button>
              <button onClick={() => setCharacter(updateLifeValue(character, { satiety: character.satiety - 20 }))}>饱食度 -20</button>
              <button onClick={() => setCharacter(updateLifeValue(character, { mood: character.mood - 20 }))}>心情值 -20</button>
              <button onClick={() => setCharacter(updateLifeValue(character, { energy: character.energy - 20 }))}>精力值 -20</button>
              <button onClick={restoreStats}>状态全部恢复</button>
              <button onClick={() => simulateLongAbsence(7)}>模拟离开 7 小时</button>
              <button onClick={() => simulateLongAbsence(25)}>模拟离开 25 小时</button>
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
