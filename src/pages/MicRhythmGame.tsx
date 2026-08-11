import { useState, useEffect, useRef } from 'react'
import { TINES, SONGS } from './Kalimba'

// ============================================================
// Pitch detection
// ============================================================
function detectPitch(buffer: Float32Array, sampleRate: number): { freq: number; confidence: number } | null {
  const N = buffer.length, corr = new Float32Array(N)
  for (let lag = 0; lag < N; lag++) { let sum = 0; for (let i = 0; i < N - lag; i++) sum += buffer[i] * buffer[i + lag]; corr[lag] = sum }
  let maxVal = 0, maxLag = 0
  const minLag = Math.floor(sampleRate / 2000), maxLag2 = Math.floor(sampleRate / 100), norm = corr[0] || 1
  for (let lag = minLag; lag < Math.min(maxLag2, N - 1); lag++) {
    const val = corr[lag] / norm
    if (val > maxVal && lag > 1 && corr[lag] > corr[lag - 1] && corr[lag] > corr[lag + 1]) { maxVal = val; maxLag = lag }
  }
  if (maxVal < 0.15 || maxLag === 0) return null
  return { freq: sampleRate / maxLag, confidence: maxVal }
}
function findClosestTine(freq: number) {
  let best: (typeof TINES)[0] | null = null, bestDiff = Infinity
  for (const t of TINES) { const d = Math.abs(freq - t.freq); if (d < bestDiff) { bestDiff = d; best = t } }
  return best && bestDiff < best.freq * 0.06 ? { tine: best, diff: bestDiff } : null
}

// ============================================================
// Types
// ============================================================
interface Note { id: number; tineId: number; targetTime: number; hit: boolean; judged: 'perfect' | 'good' | 'miss' | null }
function songToNotes(song: typeof SONGS[0]): Note[] {
  const r: Note[] = []; let nid = 0
  // Add FALL_SEC to every targetTime so notes have time to slide from bottom
  for (const f of song.notes) for (const tid of f.notes) if (tid > 0) r.push({ id: nid++, tineId: tid, targetTime: f.time + FALL_SEC, hit: false, judged: null })
  return r
}
const PERFECT_MS = 0.12, GOOD_MS = 0.25, FALL_SEC = 2.0

const btnS: React.CSSProperties = { padding: '8px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const btnG: React.CSSProperties = { padding: '8px 20px', background: 'rgba(255,255,255,0.06)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer' }

// Color by pitch register (index 不再适用——0-8 只有两色，改按频率分区)
function tineColor(freq: number) {
  return freq < 350 ? { bg: '#6366f1', b: '#818cf8' } : freq < 700 ? { bg: '#8b5cf6', b: '#a78bfa' } : { bg: '#06b6d4', b: '#22d3ee' }
}

// ============================================================
// Component
// ============================================================
type GameState = 'idle' | 'countdown' | 'waiting' | 'playing' | 'finished'

export function MicRhythmGame({ onDetect }: { onDetect: (tineId: number) => void }) {
  const [micReady, setMicReady] = useState(false)
  const [micError, setMicError] = useState('')
  const [state, setState] = useState<GameState>('idle')
  const [countdown, setCountdown] = useState(3)
  const [songIdx, setSongIdx] = useState(-1)
  const [notes, setNotes] = useState<Note[]>([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [judge, setJudge] = useState({ perfect: 0, good: 0, miss: 0 })
  const [detected, setDetected] = useState<{ label: string; freq: number } | null>(null)
  const [popup, setPopup] = useState<{ type: string; text: string } | null>(null)
  const [flash, setFlash] = useState(false)

  const audio = useRef<{ ctx: AudioContext; an: AnalyserNode; s: MediaStream } | null>(null)
  const gameRef = useRef<{ t0: number; raf: number; lt: number; ld: number | null; notes: Note[] } | null>(null)
  const cRef = useRef(0)
  const sRef = useRef(0)
  const notesRef = useRef<Note[]>([])
  const curTimeRef = useRef(0)  // for hit detection only, NOT for rendering

  // Sync notes to ref for use in RAF closure
  useEffect(() => { notesRef.current = notes }, [notes])

  // 错误分类：给出可操作的中文引导（PWA 权限问题最常见）
  const micErrorMsg = (e: any): string => {
    const name = e?.name || ''
    const msg = (e?.message || '').toLowerCase()
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || msg.includes('permission denied')) {
      return '麦克风权限被拒绝。请检查：① 若从手机主屏幕打开，请先在 Safari/Chrome 浏览器中打开本网站并允许麦克风一次；② 浏览器设置 → 网站权限 → 允许本网站使用麦克风；③ 若曾点过"不允许"，需在设置中重置后重试。'
    }
    if (name === 'NotFoundError' || msg.includes('not found')) return '未检测到麦克风设备，请检查手机麦克风是否可用。'
    if (name === 'SecurityError') return '当前环境不允许访问麦克风（需要 HTTPS 安全连接）。'
    return '麦克风不可用：' + (e?.message || name || '未知错误')
  }

  const reqMic = async () => {
    try {
      setMicError('')
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError('当前浏览器不支持麦克风访问，请使用最新版 Chrome / Safari。')
        return
      }
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      const ctx = new AudioContext({ sampleRate: 44100 }); const an = ctx.createAnalyser()
      an.fftSize = 8192; an.smoothingTimeConstant = 0.2
      ctx.createMediaStreamSource(s).connect(an); audio.current = { ctx, an, s }; setMicReady(true)
    } catch (e: any) { setMicError(micErrorMsg(e)) }
  }

  const start = (i: number) => {
    setSongIdx(i); setCountdown(3); setState('countdown')
    setScore(0); setCombo(0); setMaxCombo(0)
    setJudge({ perfect: 0, good: 0, miss: 0 })
    setNotes([])
    cRef.current = 0; sRef.current = 0
  }

  // Countdown → waiting → playing flow
  useEffect(() => {
    if (state !== 'countdown') return
    if (countdown <= 0) {
      const gameNotes = songToNotes(SONGS[songIdx])
      notesRef.current = gameNotes
      setState('waiting')
      // 1-second pause: notes and clock start simultaneously
      setTimeout(() => {
        const t0 = performance.now() / 1000
        gameRef.current = { t0, raf: 0, lt: 0, ld: null, notes: gameNotes }
        setNotes(gameNotes)       // notes appear now, at game start
        setState('playing')
      }, 1000)
      return undefined  // no cleanup — state transition to 'waiting' would clear this timer
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 800)
    return () => clearTimeout(t)
  }, [state, countdown])

  // When 'playing' state enters, kick off RAF. On exit, clean up.
  useEffect(() => {
    if (state !== 'playing' || !gameRef.current || !audio.current) return

    const an = audio.current.an
    const buf = new Float32Array(an.fftSize)

    const loop = () => {
      const g = gameRef.current
      if (!g) return
      const elapsed = performance.now() / 1000 - g.t0
      curTimeRef.current = elapsed  // ref only — no re-render
      an.getFloatTimeDomainData(buf)

      let rms = 0; for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i]
      rms = Math.sqrt(rms / buf.length)

      const pitch = detectPitch(buf, audio.current!.ctx.sampleRate)
      if (pitch && pitch.confidence > 0.2) {
        const m = findClosestTine(pitch.freq)
        if (m) {
          const t = m.tine; setDetected({ label: t.label, freq: Math.round(pitch.freq) }); onDetect(t.id)
          const now = performance.now() / 1000
          if (t.id !== g.ld || now - g.lt > 0.15) {
            g.ld = t.id; g.lt = now
            // Use notesRef to avoid stale closure
            const currentNotes = notesRef.current
            let changed = false
            const newNotes = currentNotes.map(n => {
              if (n.hit || n.tineId !== t.id) return n
              const d = Math.abs(elapsed - n.targetTime)
              if (d <= GOOD_MS) {
                const tp = d <= PERFECT_MS ? 'perfect' as const : 'good' as const
                cRef.current++; sRef.current += tp === 'perfect' ? 100 + cRef.current * 3 : 50 + cRef.current
                setCombo(cRef.current); setMaxCombo(p => Math.max(p, cRef.current)); setScore(sRef.current)
                setJudge(p => ({ ...p, [tp]: p[tp] + 1 }))
                setPopup({ type: tp, text: tp === 'perfect' ? 'PERFECT' : 'GOOD' })
                setFlash(true); setTimeout(() => { setFlash(false); setPopup(null) }, 400)
                changed = true
                const hitNote = { ...n, hit: true, judged: tp }
                // Remove after judgment animation
                setTimeout(() => {
                  notesRef.current = notesRef.current.filter(x => x.id !== hitNote.id)
                  setNotes(prev => prev.filter(x => x.id !== hitNote.id))
                }, 250)
                return hitNote
              }
              return n
            })
            if (changed) {
              notesRef.current = newNotes
              setNotes(newNotes)
            }
          }
        }
      } else {
        if (detected) setTimeout(() => setDetected(null), 400)
      }

      // Auto-miss stale notes
      {
        const currentNotes = notesRef.current
        let changed = false
        const newNotes = currentNotes.map(n => {
          if (n.hit) return n
          if (elapsed > n.targetTime + GOOD_MS + 0.1) {
            cRef.current = 0; setCombo(0); setJudge(p => ({ ...p, miss: p.miss + 1 }))
            changed = true
            const missed = { ...n, hit: true, judged: 'miss' as const }
            setPopup({ type: 'miss', text: 'FAIL' })
            setTimeout(() => setPopup(null), 400)
            // Remove FAIL display after animation
            setTimeout(() => {
              notesRef.current = notesRef.current.filter(x => x.id !== missed.id)
              setNotes(prev => prev.filter(x => x.id !== missed.id))
            }, 250)
            return missed
          }
          return n
        })
        if (changed) { notesRef.current = newNotes; setNotes(newNotes) }
      }

      // End check
      if (notesRef.current.length > 0 && notesRef.current.every(n => n.hit || elapsed > n.targetTime + GOOD_MS + 0.5) && elapsed > 1) {
        cancelAnimationFrame(g.raf)
        gameRef.current = null
        // 保留麦克风流：供"再来一次"直接复用（back() 时才真正释放）
        setState('finished')
        return
      }

      g.raf = requestAnimationFrame(loop)
    }

    gameRef.current.raf = requestAnimationFrame(loop)
    return () => { if (gameRef.current?.raf) cancelAnimationFrame(gameRef.current.raf) }
  }, [state])

  // Cleanup mic on unmount
  useEffect(() => () => { closeMic() }, [])

  const closeMic = () => {
    if (audio.current) {
      try { audio.current.s.getTracks().forEach(t => { t.stop(); t.enabled = false }) } catch {}
      try { audio.current.ctx.suspend() } catch {}  // suspend, don't destroy — so "再来一次" works
      audio.current = null
    }
  }

  const stopMic = () => {
    closeMic()
    setMicReady(false)
  }

  const back = () => {
    if (gameRef.current?.raf) cancelAnimationFrame(gameRef.current.raf)
    gameRef.current = null
    setState('idle')
    setNotes([])
    notesRef.current = []
    stopMic()
  }

  const total = judge.perfect + judge.good + judge.miss
  const acc = total > 0 ? Math.round(((judge.perfect + judge.good) / total) * 100) : 100

  // --- Select ---
  if (state === 'idle') return (
    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[38px]" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
      <div className="text-center" style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#a1a1aa', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>节奏挑战</div>
        <p className="text-xs text-zinc-500 mb-6">用真实拇指琴跟弹，麦克风实时判定音准</p>
        {!micReady ? (
          <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <p className="text-sm font-medium text-violet-300 mb-3">需要麦克风权限</p>
            <button onClick={reqMic} className="w-full py-2.5 bg-violet-500 hover:bg-violet-400 text-white rounded-xl text-sm font-medium transition-colors">允许使用麦克风</button>
            {micError && (
              <div className="mt-3">
                <p className="text-xs text-red-400 leading-relaxed">{micError}</p>
                <button onClick={reqMic} className="mt-2 w-full py-2 border border-violet-400/40 text-violet-300 rounded-xl text-xs font-medium hover:bg-violet-500/10 transition-colors">重新请求权限</button>
              </div>
            )}
          </div>
        ) : <p className="text-xs text-emerald-400 mb-4">麦克风已就绪</p>}
        {micReady && (
        <div className="grid grid-cols-2 gap-2">
          {SONGS.map((song, i) => (
            <button key={i} onClick={() => start(i)} className="text-left p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-white">{song.title}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${song.difficulty === 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{song.difficulty === 1 ? '入门' : '初级'}</span>
              </div>
              <span className="text-[11px] text-zinc-500">BPM {song.bpm}</span>
            </button>
          ))}
        </div>
        )}
      </div>
    </div>
  )

  // --- Countdown ---
  if (state === 'countdown') return (
    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[38px]" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
      <div className="text-center">
        <div style={{ fontSize: 11, color: '#71717a', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 16 }}>
          {countdown === 3 ? '准备' : countdown === 2 ? '拇指琴就位' : '开始！'}
        </div>
        <span className="text-8xl font-black text-white" style={{ textShadow: '0 0 40px rgba(139,92,246,0.5)' }}>{countdown}</span>
      </div>
    </div>
  )

  // --- Waiting (1s pause) ---
  if (state === 'waiting') return (
    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[38px]" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <style>{`@keyframes fillBar { from { width: 0% } to { width: 100% } } .anim-fill-bar { animation: fillBar 1s linear forwards }`}</style>
      <div className="text-center">
        <p className="text-sm text-zinc-400 mb-2">准备演奏...</p>
        <div className="w-20 h-1.5 bg-zinc-700 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full anim-fill-bar" />
        </div>
      </div>
    </div>
  )

  // --- Results ---
  if (state === 'finished') {
    const grade = acc >= 95 ? { l: 'S', c: '#fbbf24' } : acc >= 85 ? { l: 'A', c: '#34d399' } : acc >= 70 ? { l: 'B', c: '#60a5fa' } : { l: 'C', c: '#a1a1aa' }
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[38px]" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#52525b', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>演奏完成</div>
          <div style={{
            fontSize: 44, fontWeight: 900, color: grade.c, lineHeight: 1,
            textShadow: `0 0 36px ${grade.c}30`,
            marginBottom: 10,
          }}>{grade.l}</div>
          <div style={{
            display: 'inline-flex', gap: 18, fontSize: 11, fontFamily: 'monospace',
            background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '6px 14px',
            border: '1px solid rgba(255,255,255,0.06)', marginBottom: 14,
          }}>
            <span><span style={{ color: '#fbbf24' }}>{judge.perfect}</span><span style={{ color: '#52525b' }}>P</span></span>
            <span><span style={{ color: '#34d399' }}>{judge.good}</span><span style={{ color: '#52525b' }}>G</span></span>
            <span><span style={{ color: '#71717a' }}>{judge.miss}</span><span style={{ color: '#3f3f46' }}>M</span></span>
            <span style={{ color: '#fff', fontWeight: 700 }}>{acc}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 12, color: '#71717a', marginBottom: 12 }}>
            <span>{score.toLocaleString()} 分</span>
            <span style={{ color: '#3f3f46' }}>|</span>
            <span style={{ color: '#fbbf24' }}>{maxCombo} 连击</span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => start(songIdx)} style={btnS}>再来一次</button>
            <button onClick={back} style={btnG}>返回</button>
          </div>
        </div>
      </div>
    )
  }

  // --- Playing ---
  return (
    <div className="absolute inset-0 z-40 pointer-events-none rounded-[38px] overflow-hidden">
      <style>{`
        @keyframes judgePop { 0%{transform:translate(-50%,-50%) scale(.3);opacity:0} 40%{transform:translate(-50%,-50%) scale(1.2);opacity:1} 100%{transform:translate(-50%,-50%) scale(1);opacity:0} }
        @keyframes flashIn { 0%{opacity:0} 10%{opacity:.12} 100%{opacity:0} }
        .anim-judge-pop{animation:judgePop .5s ease-out forwards}
        .anim-flash{animation:flashIn .15s ease-out forwards}
      `}</style>

      {/* Score HUD */}
      <div className="pointer-events-none absolute top-3 left-0 right-0 flex justify-between items-start px-6">
        <div>
          <div className="text-2xl font-black text-white tabular-nums" style={{ textShadow: '0 0 12px rgba(0,0,0,0.5)' }}>{score.toLocaleString()}</div>
          {combo > 1 && <div className="text-xs font-bold" style={{ color: combo >= 20 ? '#fbbf24' : combo >= 10 ? '#f472b6' : '#34d399', textShadow: '0 0 8px rgba(0,0,0,0.5)' }}>{combo} COMBO</div>}
        </div>
        <div className="flex gap-3 text-[10px]" style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: '4px 10px' }}>
          <span className="text-red-400 font-mono">{judge.perfect}P</span>
          <span className="text-green-400 font-mono">{judge.good}G</span>
          <span className="text-zinc-500 font-mono">{judge.miss}M</span>
          <span className="text-zinc-400 font-mono ml-1">{acc}%</span>
        </div>
      </div>

      {flash && <div className="anim-flash absolute inset-0 bg-white pointer-events-none" />}

      {/* Falling notes — CSS GPU animation, stops at judgment line */}
      <style>{`
        @keyframes noteSlide { from { transform: translateY(0); opacity: 0 } 10% { opacity: 1 } 100% { transform: translateY(-200px); opacity: 1 } }
        @keyframes judgeFade { 0% { opacity: 0 } 25% { transform: scale(1.2); opacity: 1 } 100% { transform: scale(0.8); opacity: 0 } }
        @keyframes failFade { 0% { opacity: 0 } 20% { transform: scale(1.1); opacity: 1 } 100% { opacity: 0 } }
        .note-slide { animation: noteSlide ${FALL_SEC}s linear both; will-change: transform; }
        .note-judge-perfect { animation: judgeFade 0.4s ease-out forwards; }
        .note-judge-good { animation: judgeFade 0.4s ease-out forwards; }
        .note-judge-miss { animation: failFade 0.4s ease-out forwards; }
      `}</style>
      <div className="absolute flex justify-center gap-[3px] mx-auto pointer-events-none" style={{ left: '5%', right: '5%', top: 0, bottom: 0, overflow: 'hidden' }}>
        {TINES.map((tine) => {
          const c = tineColor(tine.freq)
          // Un-hit: still flying. Judged: show result then remove.
          const activeNotes = notes.filter(n => n.tineId === tine.id)

          return (
            <div key={tine.id} style={{ width: 28, position: 'relative', flexShrink: 0 }}>
              {activeNotes.map((note) => {
                if (note.judged) {
                  // Judged note — show at judgment line position
                  const jColors = { perfect: '#fbbf24', good: '#34d399', miss: '#f87171' }
                  const jTexts = { perfect: 'PERFECT', good: 'GOOD', miss: 'FAIL' }
                  return (
                    <div key={note.id}
                      className={`note-judge-${note.judged} pointer-events-none`}
                      style={{ position: 'absolute', left: 0, right: 0, bottom: 200, height: 18, zIndex: 30 }}
                    >
                      <div style={{
                        width: '100%', height: '100%', borderRadius: 9,
                        background: jColors[note.judged],
                        boxShadow: `0 0 10px ${jColors[note.judged]}80`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span className="text-[8px] font-black text-white">{jTexts[note.judged]}</span>
                      </div>
                    </div>
                  )
                }

                // Un-hit note — CSS slide animation
                // Note's adjusted targetTime includes FALL_SEC; delay = targetTime - FALL_SEC
                const delay = note.targetTime - FALL_SEC
                const arrived = delay <= 0
                return (
                  <div key={note.id}
                    className={`note-slide pointer-events-none`}
                    style={{
                      position: 'absolute', left: 0, right: 0,
                      bottom: 0, height: 18,
                      transform: arrived ? 'translateY(-200px)' : undefined,
                      animationDelay: `${delay}s`,
                      zIndex: 10,
                    }}
                  >
                    <div style={{
                      width: '100%', height: '100%', borderRadius: 9,
                      background: arrived ? 'linear-gradient(180deg,#fda4af,#f43f5e)' : `linear-gradient(180deg,${c.b},${c.bg})`,
                      border: arrived ? '1px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="text-[10px] font-bold select-none" style={{ color: arrived ? '#881337' : '#fff' }}>
                        {tine.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Detected note */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
        <div style={{ display:'flex',alignItems:'center',gap:6,padding:'3px 12px',borderRadius:20,background:detected?'rgba(16,185,129,0.15)':'rgba(0,0,0,0.3)',border:`1px solid ${detected?'rgba(16,185,129,0.3)':'rgba(255,255,255,0.08)'}` }}>
          <div style={{ width:6,height:6,borderRadius:'50%',background:detected?'#10b981':'#6366f1',boxShadow:detected?'0 0 6px rgba(16,185,129,0.5)':'none' }} />
          <span className="text-[11px] font-mono" style={{ color:detected?'#6ee7b7':'#71717a' }}>{detected?detected.label:'--'}</span>
        </div>
      </div>

      {/* Judge popup */}
      {popup && (
        <div className="anim-judge-pop pointer-events-none absolute" style={{ top:'40%',left:'50%' }}>
          <span className="text-3xl font-black tracking-wider" style={{ color:popup.type==='perfect'?'#fbbf24':popup.type==='good'?'#34d399':'#f87171',textShadow:`0 0 20px ${popup.type==='perfect'?'rgba(251,191,36,0.5)':popup.type==='good'?'rgba(52,211,153,0.5)':'rgba(248,113,113,0.5)'}` }}>{popup.text}</span>
        </div>
      )}

      {/* Exit */}
      <button onClick={back} className="pointer-events-auto absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[11px] text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors" style={{ background:'rgba(0,0,0,0.3)' }}>
        ✕ 退出
      </button>
    </div>
  )
}
