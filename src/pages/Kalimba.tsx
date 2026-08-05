import { useState, useCallback, useRef, useEffect } from 'react'
import { Icon } from '../components/icons'
import { MicRhythmGame as RhythmOverlay } from './MicRhythmGame'

// ============================================================
// 17-key Kalimba — C major, tines labeled with number notation
// Ordered left-to-right as held in hands:
//   Left hand handles treble side (shorter tines on left)
//   Right hand handles bass side (longer tines on right)
// Actually in standard layout:
//   Left end = highest pitch (shortest), Right end = lowest pitch (longest)
//   But visually tines alternate: long-short-long-short from center
// ============================================================
export const TINES = [
  // Left side (treble, shorter, left hand)
  { id: 1,  num: '3°', note: 'D6', freq: 1174.66, label: '3°', side: 'left' as const, index: 0  },
  { id: 2,  num: '1°', note: 'B5', freq: 987.77,  label: '1°', side: 'left' as const, index: 1  },
  { id: 3,  num: '6°', note: 'G5', freq: 783.99,  label: '6°', side: 'left' as const, index: 2  },
  { id: 4,  num: '4°', note: 'E5', freq: 659.25,  label: '4°', side: 'left' as const, index: 3  },
  { id: 5,  num: '2°', note: 'C5', freq: 523.25,  label: '2°', side: 'left' as const, index: 4  },
  { id: 6,  num: '7°', note: 'A4', freq: 440.00,  label: '7°', side: 'left' as const, index: 5  },
  { id: 7,  num: '5°', note: 'F4', freq: 349.23,  label: '5°', side: 'left' as const, index: 6  },
  { id: 8,  num: '3',  note: 'E4', freq: 329.63,  label: '3',  side: 'left' as const, index: 7  },
  // Center tines
  { id: 9,  num: '1',  note: 'D4', freq: 293.66,  label: '1',  side: 'center' as const, index: 8  },
  // Right side (bass, longer, right hand)
  { id: 10, num: '2',  note: 'C4', freq: 261.63,  label: '2',  side: 'right' as const, index: 9  },
  { id: 11, num: '4',  note: 'B3', freq: 246.94,  label: '4',  side: 'right' as const, index: 10 },
  { id: 12, num: '6',  note: 'A3', freq: 220.00,  label: '6',  side: 'right' as const, index: 11 },
  { id: 13, num: '7',  note: 'G3', freq: 196.00,  label: '7',  side: 'right' as const, index: 12 },
  { id: 14, num: '5',  note: 'F3', freq: 174.61,  label: '5',  side: 'right' as const, index: 13 },
  { id: 15, num: '1.', note: 'E3', freq: 164.81,  label: '1.', side: 'right' as const, index: 14 },
  { id: 16, num: '3.', note: 'D3', freq: 146.83,  label: '3.', side: 'right' as const, index: 15 },
  { id: 17, num: '2.', note: 'C3', freq: 130.81,  label: '2.', side: 'right' as const, index: 16 },
]

// Typographic note mapping for tine labels
export const LABEL_DETAILS: Record<string, { main: string; sub?: string }> = {
  '3°': { main: '3', sub: '°' },
  '1°': { main: '1', sub: '°' },
  '6°': { main: '6', sub: '°' },
  '4°': { main: '4', sub: '°' },
  '2°': { main: '2', sub: '°' },
  '7°': { main: '7', sub: '°' },
  '5°': { main: '5', sub: '°' },
  '3':  { main: '3' },
  '1':  { main: '1' },
  '2':  { main: '2' },
  '4':  { main: '4' },
  '6':  { main: '6' },
  '7':  { main: '7' },
  '5':  { main: '5' },
  '1.': { main: '1', sub: '·' },
  '3.': { main: '3', sub: '·' },
  '2.': { main: '2', sub: '·' },
}

// Tine length: longer in center, shorter on edges
function tineLength(index: number): number {
  const center = 8
  const dist = Math.abs(index - center)
  return 140 - dist * 6
}

// ============================================================
// Songs
// ============================================================
export const SONGS = [
  {
    title: '小星星',
    difficulty: 1,
    bpm: 80,
    notes: [
      [1,1,1,1,1,1], [5,5,5,5,5,5], [6,6,6,6,6,6], [5,5,5,5,5,-1],
      [4,4,4,4,4,4], [3,3,3,3,3,3], [2,2,2,2,2,2], [1,1,1,1,1,-1],
      [5,5,5,5,5,5], [4,4,4,4,4,4], [3,3,3,3,3,3], [2,2,2,2,2,-1],
      [5,5,5,5,5,5], [4,4,4,4,4,4], [3,3,3,3,3,3], [2,2,2,2,2,-1],
      [1,1,1,1,1,1], [5,5,5,5,5,5], [6,6,6,6,6,6], [5,5,5,5,5,-1],
      [4,4,4,4,4,4], [3,3,3,3,3,3], [2,2,2,2,2,2], [1,1,1,1,1,-1],
    ].map((row, i) => ({ time: i * 1.5, notes: row })),
  },
  {
    title: '生日快乐',
    difficulty: 2,
    bpm: 90,
    notes: [
      [5,5,-1,-1,-1,-1], [6,5,-1,-1,-1,-1], [1,5,-1,-1,-1,-1], [7,7,-1,-1,-1,-1],
      [5,5,-1,-1,-1,-1], [6,5,-1,-1,-1,-1], [2,1,-1,-1,-1,-1], [1,1,-1,-1,-1,-1],
      [5,5,-1,-1,-1,-1], [5,3,-1,-1,-1,-1], [1,1,7,7,-1,-1], [6,6,5,5,-1,-1],
      [2,2,2,2,-1,-1], [1,1,-1,-1,-1,-1], [1,1,-1,-1,-1,-1], [-1,-1,-1,-1,-1,-1],
    ].map((row, i) => ({ time: i * 1.2, notes: row })),
  },
]

// ============================================================
// Web Audio
// ============================================================
let audioCtx: AudioContext | null = null
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}
export function playNote(freq: number) {
  const ctx = getAudioCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.25, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 1.5)
}

// ============================================================
// Achievements
// ============================================================
const ACHIEVEMENTS = [
  { id: 'first_note', name: '初试琴音', desc: '第一次弹出声音', icon: 'Music' as const },
  { id: 'first_song', name: '初露锋芒', desc: '完成第一首曲目', icon: 'Check' as const },
  { id: 'streak_3', name: '三日坚持', desc: '连续练习 3 天', icon: 'Clock' as const },
  { id: 'streak_7', name: '一周琴友', desc: '连续练习 7 天', icon: 'Clock' as const },
  { id: 'free_5min', name: '自由之魂', desc: '自由演奏累计 5 分钟', icon: 'LayoutDashboard' as const },
  { id: 'master_3', name: '曲目达人', desc: '掌握 3 首曲目', icon: 'FolderOpen' as const },
]

// ============================================================
// Main component
// ============================================================
export function KalimbaPage() {
  const [tab, setTab] = useState<'play' | 'songs' | 'progress' | 'rhythm'>('play')
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set())
  const [micHitId, setMicHitId] = useState<number | null>(null)  // detected by mic in rhythm mode
  const [currentSong, setCurrentSong] = useState(-1)
  const [songPlaying, setSongPlaying] = useState(false)
  const [currentNoteIdx, setCurrentNoteIdx] = useState(-1)
  const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('kb_streak') || '0'))
  const [practiceMin, setPracticeMin] = useState(() => parseInt(localStorage.getItem('kb_time') || '0'))
  const [achievements, setAchievements] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('kb_achievements')
    return new Set(saved ? JSON.parse(saved) : [])
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setPracticeMin((prev) => {
        const next = prev + 1
        localStorage.setItem('kb_time', String(next))
        if (next >= 5 && !achievements.has('free_5min')) unlockAch('free_5min')
        return next
      })
    }, 60000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const last = localStorage.getItem('kb_last_date')
    if (last !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      if (last === yesterday) {
        const ns = streak + 1
        setStreak(ns)
        localStorage.setItem('kb_streak', String(ns))
        if (ns >= 3) unlockAch('streak_3')
        if (ns >= 7) unlockAch('streak_7')
      } else if (last !== today) {
        setStreak(1)
        localStorage.setItem('kb_streak', '1')
      }
      localStorage.setItem('kb_last_date', today)
    }
  }, [])

  const unlockAch = (id: string) => {
    setAchievements((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('kb_achievements', JSON.stringify([...next]))
      return next
    })
  }

  const handleNotePress = useCallback((note: typeof TINES[0]) => {
    playNote(note.freq)
    setActiveNotes((prev) => { const n = new Set(prev); n.add(note.id); return n })
    setTimeout(() => setActiveNotes((prev) => { const n = new Set(prev); n.delete(note.id); return n }), 250)
    if (!achievements.has('first_note')) unlockAch('first_note')
  }, [achievements])

  // Song autoplay
  useEffect(() => {
    if (!songPlaying || currentSong === -1) return
    const song = SONGS[currentSong]
    const nextIdx = currentNoteIdx + 1
    if (nextIdx >= song.notes.length) {
      setSongPlaying(false)
      if (!achievements.has('first_song')) unlockAch('first_song')
      return
    }
    const timer = setTimeout(() => {
      setCurrentNoteIdx(nextIdx)
      const frame = song.notes[nextIdx]
      frame.notes.forEach((n) => {
        if (n > 0) {
          const tine = TINES.find((t) => t.id === n)
          if (tine) {
            playNote(tine.freq)
            setActiveNotes((prev) => { const nx = new Set(prev); nx.add(n); return nx })
            setTimeout(() => setActiveNotes((prev) => { const nx = new Set(prev); nx.delete(n); return nx }), 250)
          }
        }
      })
    }, (60 / song.bpm) * 1000)
    return () => clearTimeout(timer)
  }, [songPlaying, currentNoteIdx, currentSong])

  // Keyboard
  useEffect(() => {
    const keys: Record<string, number> = {
      '1': 9, '2': 10, '3': 8, '4': 11, '5': 14, '6': 12, '7': 13,
      '8': 7, '9': 6, '0': 5, '-': 4, '=': 3,
      'q': 1, 'w': 2, 'e': 3, 'r': 4, 't': 5, 'y': 6, 'u': 7,
      'z': 17, 'x': 16, 'c': 15, 'v': 14, 'b': 13, 'n': 12, 'm': 11,
    }
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return
      const tineId = keys[e.key]
      if (tineId) {
        const tine = TINES.find((t) => t.id === tineId)
        if (tine) handleNotePress(tine)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNotePress])

  const startSong = (idx: number) => {
    setCurrentSong(idx)
    setCurrentNoteIdx(-1)
    setSongPlaying(true)
  }

  // Clear mic detection highlight after short delay
  useEffect(() => {
    if (micHitId === null) return
    const t = setTimeout(() => setMicHitId(null), 300)
    return () => clearTimeout(t)
  }, [micHitId])

  return (
    <div className="max-w-screen-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-800">拇指琴</h2>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><Icon name="Clock" size={14} /> {streak} 天</span>
          <span className="flex items-center gap-1"><Icon name="LayoutDashboard" size={14} /> {practiceMin} min</span>
          <span className="flex items-center gap-1"><Icon name="Check" size={14} /> {achievements.size} 勋章</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 mb-6 w-fit">
        {[
          { id: 'play' as const, label: '自由演奏' },
          { id: 'songs' as const, label: '曲目学习' },
          { id: 'progress' as const, label: '我的进度' },
          { id: 'rhythm' as const, label: '节奏挑战' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ================================================================ */}
      {/* REALISTIC HORIZONTAL KALIMBA */}
      {/* ================================================================ */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-6 overflow-x-auto">
        <div className="mx-auto relative" style={{ minWidth: 700, maxWidth: 900 }} id="kalimba-stage">
          {/* Rhythm game overlay — only visible in rhythm mode */}
          {tab === 'rhythm' && <RhythmOverlay onDetect={(id: number) => setMicHitId(id)} />}

          {/* Wooden body + sound hole — player's view: bridge at bottom, tines go upward */}
          <div className="relative rounded-[40px] border-2 border-amber-700/40 shadow-lg overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #c4985a 0%, #b8833e 25%, #a67330 50%, #b8833e 75%, #c4985a 100%)',
              padding: '20px 30px 44px 30px',
            }}
          >
            {/* Wood grain lines */}
            <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none" style={{ zIndex: 0 }}>
              <defs>
                <pattern id="grain" x="0" y="0" width="120" height="8" patternUnits="userSpaceOnUse">
                  <rect width="120" height="8" fill="none" />
                  <line x1="0" y1="4" x2="120" y2="4" stroke="#4a2800" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grain)" />
            </svg>

            {/* Edge highlight */}
            <div className="absolute inset-3 rounded-[32px] border border-amber-400/20 pointer-events-none" />

            {/* Tines row — pointing UP from bridge */}
            <div className="relative z-10 flex items-start justify-center gap-[3px] mx-auto" style={{ width: '90%' }}>
              {TINES.map((tine) => {
                const length = tineLength(tine.index)
                const isActive = activeNotes.has(tine.id)
                const isDetected = micHitId === tine.id  // mic detection in rhythm mode
                const detail = LABEL_DETAILS[tine.label] || { main: tine.label }

                return (
                  <button
                    key={tine.id}
                    onMouseDown={() => handleNotePress(tine)}
                    onTouchStart={(e) => { e.preventDefault(); handleNotePress(tine) }}
                    className="relative flex flex-col items-center justify-start rounded-b-lg cursor-pointer transition-all duration-150 border-2 focus:outline-none shrink-0 hover:brightness-110 active:brightness-90"
                    style={{
                      width: 28,
                      paddingTop: 10,
                      borderColor: isDetected ? '#10b981' : isActive ? '#6366f1' : '#9ca3af',
                      background: isDetected
                        ? 'linear-gradient(0deg, #34d399 0%, #10b981 50%, #059669 100%)'
                        : isActive
                        ? 'linear-gradient(0deg, #818cf8 0%, #6366f1 50%, #4f46e5 100%)'
                        : 'linear-gradient(0deg, #d1d5db 0%, #9ca3af 40%, #6b7280 100%)',
                      boxShadow: isDetected
                        ? '0 -3px 12px rgba(16,185,129,0.6), inset 0 1px 0 rgba(255,255,255,0.3)'
                        : isActive
                        ? '0 -3px 12px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.3)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.2)',
                      height: length,
                      transform: isActive ? 'translateY(-4px)' : 'translateY(0)',
                    }}
                    title={`${tine.label} (${tine.note})`}
                  >
                    {/* Label at top of tine */}
                    <span
                      className="relative z-10 text-[11px] font-bold select-none mb-1"
                      style={{ color: (isDetected || isActive) ? '#fff' : '#374151' }}
                    >
                      {detail.main}
                      {detail.sub && (
                        <span style={{ fontSize: 9, verticalAlign: 'super' }}>{detail.sub}</span>
                      )}
                    </span>
                    {/* Tine tip */}
                    <div
                      className="rounded-full shrink-0"
                      style={{
                        width: 16,
                        height: 16,
                        background: isDetected ? '#a7f3d0' : isActive ? '#c7d2fe' : '#e5e7eb',
                        border: `1.5px solid ${isDetected ? '#10b981' : isActive ? '#818cf8' : '#9ca3af'}`,
                        boxShadow: isDetected ? '0 0 8px rgba(16,185,129,0.5)' : isActive ? '0 0 6px rgba(99,102,241,0.4)' : 'none',
                      }}
                    />
                  </button>
                )
              })}
            </div>

            {/* Metal saddle bar — above bridge where tines are fixed */}
            <div className="relative z-10 mx-auto rounded-full mt-2"
              style={{
                width: '78%',
                height: 6,
                background: 'linear-gradient(180deg, #888 0%, #b0b0b0 50%, #e8e8e8 100%)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
            />

            {/* Bridge bar — closest to player */}
            <div className="relative z-10 mt-2 mx-auto rounded-full"
              style={{
                width: '85%',
                height: 14,
                background: 'linear-gradient(180deg, #5A3016 0%, #6B3F1F 50%, #8B5E3C 100%)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            />

            {/* Decorative bottom bar */}
            <div className="relative z-10 mx-auto mt-1.5 rounded-full"
              style={{
                width: '70%',
                height: 8,
                background: 'linear-gradient(180deg, #5A3016 0%, #6B3F1F 100%)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              }}
            />

            {/* Sound hole — in the body */}
            <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
              style={{ top: '55%', transform: 'translate(-50%, -50%)' }}
            >
              <div className="rounded-full"
                style={{
                  width: 56, height: 56,
                  background: 'radial-gradient(circle, #1a1000 0%, #2d1f05 60%, #8B5E3C 100%)',
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), 0 0 0 2px rgba(139,94,60,0.4)',
                }}
              />
              <div className="absolute inset-2 rounded-full border border-amber-700/20" />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 mt-5 text-xs text-zinc-400">
          <span>左手区域：高音区（短键）</span>
          <span className="text-zinc-300">|</span>
          <span>中央：中音</span>
          <span className="text-zinc-300">|</span>
          <span>右手区域：低音区（长键）</span>
        </div>
        <p className="text-xs text-zinc-400 text-center mt-2">
          键盘映射：左手 QWER TYU · 右手 1234 567 · 中央 89
        </p>
      </div>

      {/* ================================================================ */}
      {/* Tab: Songs */}
      {/* ================================================================ */}
      {tab === 'songs' && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h3 className="text-sm font-semibold text-zinc-800 mb-4">曲目库</h3>
          <div className="grid grid-cols-2 gap-3">
            {SONGS.map((song, i) => (
              <div key={i} className={`p-4 rounded-xl border transition-colors ${
                currentSong === i && songPlaying ? 'border-indigo-300 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-800">{song.title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      song.difficulty === 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {song.difficulty === 1 ? '入门' : '初级'}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400">BPM {song.bpm}</span>
                </div>
                <button
                  onClick={() => songPlaying && currentSong === i ? setSongPlaying(false) : startSong(i)}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentSong === i && songPlaying
                      ? 'bg-zinc-200 text-zinc-600'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {currentSong === i && songPlaying ? '停止' : '开始跟弹'}
                </button>
                {currentSong === i && songPlaying && (
                  <div className="mt-2 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${((currentNoteIdx + 1) / song.notes.length) * 100}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Tab: Progress */}
      {/* ================================================================ */}
      {tab === 'progress' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <h3 className="text-sm font-semibold text-zinc-800 mb-4">成就勋章</h3>
            <div className="grid grid-cols-3 gap-3">
              {ACHIEVEMENTS.map((ach) => {
                const unlocked = achievements.has(ach.id)
                return (
                  <div key={ach.id} className={`p-3 rounded-xl border text-center transition-colors ${
                    unlocked ? 'border-amber-200 bg-amber-50' : 'border-zinc-100 bg-zinc-50 opacity-50'
                  }`}>
                    <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${
                      unlocked ? 'bg-amber-200 text-amber-700' : 'bg-zinc-200 text-zinc-400'
                    }`}>
                      <Icon name={ach.icon} size={14} />
                    </div>
                    <p className={`text-xs font-medium ${unlocked ? 'text-zinc-800' : 'text-zinc-400'}`}>{ach.name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{ach.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <h3 className="text-sm font-semibold text-zinc-800 mb-4">练习统计</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-zinc-50 rounded-lg">
                <p className="text-2xl font-semibold text-indigo-600">{streak}</p>
                <p className="text-xs text-zinc-500">连续天数</p>
              </div>
              <div className="text-center p-3 bg-zinc-50 rounded-lg">
                <p className="text-2xl font-semibold text-emerald-600">{practiceMin}</p>
                <p className="text-xs text-zinc-500">累计分钟</p>
              </div>
              <div className="text-center p-3 bg-zinc-50 rounded-lg">
                <p className="text-2xl font-semibold text-amber-600">{achievements.size}/{ACHIEVEMENTS.length}</p>
                <p className="text-xs text-zinc-500">成就解锁</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">练习日历</h3>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 28 }, (_, i) => {
                const d = new Date(Date.now() - (27 - i) * 86400000)
                const dateStr = d.toISOString().slice(0, 10)
                const practiced = dateStr === localStorage.getItem('kb_last_date') || i < streak
                return (
                  <div key={i} className={`aspect-square rounded-md flex items-center justify-center text-xs ${
                    practiced ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-zinc-50 text-zinc-300'
                  }`}>{d.getDate()}</div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
