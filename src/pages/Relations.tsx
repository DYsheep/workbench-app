import { useState, useCallback, useMemo, useRef } from 'react'

type Category = 'family' | 'friendship' | 'love'

interface DiaryEntry { id: string; content: string; images: string[]; date: string }
interface Person {
  id: string; name: string; avatar: string; relationship: string
  birthday: string; phone: string; notes: string; review: string
  diary: DiaryEntry[]; lastBirthdayGreeted: string
}
type RelationData = Record<Category, Person[]>

const STORAGE_KEY = 'wb_relations_v3'
const CATEGORIES: { key: Category; label: string; icon: string; color: string; bg: string; border: string; accent: string; tagBg: string; tagText: string }[] = [
  { key:'family', label:'亲情', icon:'🏠', color:'#f97316', bg:'#fff7ed', border:'#fed7aa', accent:'#fb923c', tagBg:'#ffedd5', tagText:'#c2410c' },
  { key:'friendship', label:'友情', icon:'🤝', color:'#10b981', bg:'#ecfdf5', border:'#a7f3d0', accent:'#34d399', tagBg:'#d1fae5', tagText:'#065f46' },
  { key:'love', label:'爱情', icon:'💕', color:'#ec4899', bg:'#fdf2f8', border:'#fbcfe8', accent:'#f472b6', tagBg:'#fce7f3', tagText:'#9d174d' },
]
const AVATARS = [
  { e:'👴',l:'爷爷' },{ e:'👵',l:'奶奶' },{ e:'🧓',l:'长辈' },
  { e:'👨',l:'中年男' },{ e:'👩',l:'中年女' },{ e:'👨‍🦱',l:'成年男' },{ e:'👩‍🦰',l:'成年女' },
  { e:'🧑',l:'青年男' },{ e:'👱‍♀️',l:'青年女' },
  { e:'👦',l:'男孩' },{ e:'👧',l:'女孩' },{ e:'👶',l:'幼儿' },
]

function loadData(): RelationData {
  const empty: RelationData = { family:[], friendship:[], love:[] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      // Migrate from old format with posts, normalize person objects
      const normalize = (arr: any[]): Person[] => (arr || []).filter((p: any) => p && typeof p === 'object').map((p: any) => ({
        id: p.id || generateId(),
        name: p.name || '',
        avatar: p.avatar || '👤',
        relationship: p.relationship || '',
        birthday: p.birthday || '',
        phone: p.phone || '',
        notes: p.notes || '',
        review: p.review || '',
        diary: Array.isArray(p.diary) ? p.diary.map((e: any) => ({ ...e, images: Array.isArray(e.images) ? e.images : [] })) : [],
        lastBirthdayGreeted: p.lastBirthdayGreeted || '',
      }))
      return {
        family: normalize(d.family?.people || d.family),
        friendship: normalize(d.friendship?.people || d.friendship),
        love: normalize(d.love?.people || d.love),
      }
    }
  } catch { return empty }
  return empty
}
function saveData(data: RelationData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  catch { /* quota exceeded, silently ignore */ }
}
function generateId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,7) }
function today() { return new Date().toISOString().slice(0,10) }
function todayMMDD() { const d=new Date();return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function thisYear() { return String(new Date().getFullYear()) }
function formatDate(d:string){const dt=new Date(d);const diff=Date.now()-dt.getTime();const mins=Math.floor(diff/6e4);if(mins<1)return'刚刚';if(mins<60)return`${mins}分钟前`;const hrs=Math.floor(mins/60);if(hrs<24)return`${hrs}小时前`;const days=Math.floor(hrs/24);if(days<7)return`${days}天前`;return dt.toLocaleDateString('zh-CN',{month:'short',day:'numeric'})}
function daysUntil(mmdd:string){const now=new Date();const [m,d]=mmdd.split('-').map(Number);const t=new Date(now.getFullYear(),m-1,d);if(t<now)t.setFullYear(t.getFullYear()+1);return Math.ceil((t.getTime()-now.getTime())/864e5)}
function readImage(file: File): Promise<string> { return new Promise((resolve)=>{const r=new FileReader();r.onload=()=>resolve(r.result as string);r.readAsDataURL(file)}) }

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch { return false }
  }
}

function openWeChat() {
  // URL Scheme 唤起微信（手机/桌面均注册了该协议）
  try { window.location.href = 'weixin://' } catch {}
}

function BirthdayBadge({ p }: { p: Person }) {
  if(!p.birthday) return null
  const days=daysUntil(p.birthday); const t=todayMMDD()
  if(p.birthday===t)return <span style={{fontSize:10,color:'#ef4444',background:'#fee2e2',padding:'1px 6px',borderRadius:8,animation:'pulse 1.5s infinite'}}>🎂 今天生日！</span>
  if(days<=7)return <span style={{fontSize:10,color:'#b45309',background:'#fef3c7',padding:'1px 6px',borderRadius:8}}>🎂 {days}天</span>
  return null
}

// Birthday picker
function BirthdayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startDow = new Date(viewYear, viewMonth, 1).getDay()
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
  const selectDay = (d: number) => { onChange(`${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`); setOpen(false) }
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 text-left focus:outline-none focus:border-zinc-300 bg-white hover:border-zinc-300 transition-colors">
        {value || <span className="text-zinc-400">选择生日</span>}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-zinc-200 shadow-lg p-3 z-20" style={{ width: 240 }}>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1)} else setViewMonth(m=>m-1) }} className="text-xs text-zinc-400 hover:text-zinc-600 px-1">◀</button>
            <span className="text-xs font-medium text-zinc-700">{viewYear}年 {months[viewMonth]}</span>
            <button type="button" onClick={() => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1)} else setViewMonth(m=>m+1) }} className="text-xs text-zinc-400 hover:text-zinc-600 px-1">▶</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {['日','一','二','三','四','五','六'].map(d => (<div key={d} className="text-[9px] text-zinc-400 py-1">{d}</div>))}
            {Array(startDow).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
              const sel = value === `${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
              return (<button type="button" key={d} onClick={() => selectDay(d)} className={`text-xs rounded-lg py-1.5 transition-colors ${sel ? 'bg-indigo-500 text-white font-medium' : 'text-zinc-600 hover:bg-zinc-100'}`}>{d}</button>)
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function RelationsPage() {
  const [data,setData]=useState(loadData)
  const [tab,setTab]=useState<Category>('family')
  const [selectedPerson,setSelectedPerson]=useState<string|null>(null)
  const [showPersonForm,setShowPersonForm]=useState(false)
  const [editingPerson,setEditingPerson]=useState<Person|null>(null)
  const [diaryOpen,setDiaryOpen]=useState(false);const [diaryDraft,setDiaryDraft]=useState('');const [diaryImgs,setDiaryImgs]=useState<string[]>([])
  const [greetMsg,setGreetMsg]=useState('')
  const [previewImg,setPreviewImg]=useState<string|null>(null)
  const [expandedDiary,setExpandedDiary]=useState<string|null>(null)
  const [reviewEdit,setReviewEdit]=useState(false);const [reviewDraft,setReviewDraft]=useState('')
  const imgRef=useRef<HTMLInputElement>(null)

  const cat=CATEGORIES.find(c=>c.key===tab)!; const people=data[tab]
  const person=useMemo(()=>people.find(p=>p.id===selectedPerson)||null,[people,selectedPerson])

  const savePerson=useCallback((p:Person)=>{setData(prev=>{const np=prev[tab];const idx=np.findIndex(x=>x.id===p.id);const nn=idx>=0?np.map(x=>x.id===p.id?p:x):[...np,p];const next={...prev,[tab]:nn};saveData(next);return next});setShowPersonForm(false);setEditingPerson(null);setSelectedPerson(p.id)},[tab])
  const deletePerson=useCallback((id:string)=>{setData(prev=>{const next={...prev,[tab]:prev[tab].filter(p=>p.id!==id)};saveData(next);return next});setSelectedPerson(null)},[tab])
  const saveReview=useCallback((pid:string,review:string)=>{setData(prev=>{const next={...prev,[tab]:prev[tab].map(p=>p.id===pid?{...p,review}:p)};saveData(next);return next});setReviewEdit(false)},[tab])
  const addDiary=useCallback((pid:string)=>{if(!diaryDraft.trim()&&diaryImgs.length===0)return;const e:DiaryEntry={id:generateId(),content:diaryDraft.trim(),images:diaryImgs,date:today()};setData(prev=>{const next={...prev,[tab]:prev[tab].map(p=>p.id===pid?{...p,diary:[e,...p.diary]}:p)};saveData(next);return next});setDiaryDraft('');setDiaryImgs([]);setDiaryOpen(false)},[tab,diaryDraft,diaryImgs])
  const deleteDiary=useCallback((pid:string,eid:string)=>{setData(prev=>{const next={...prev,[tab]:prev[tab].map(p=>p.id===pid?{...p,diary:p.diary.filter(e=>e.id!==eid)}:p)};saveData(next);return next})},[tab])
  const openNewPerson=()=>{setEditingPerson({id:generateId(),name:'',avatar:AVATARS[Math.floor(Math.random()*AVATARS.length)].e,relationship:'',birthday:'',phone:'',notes:'',review:'',diary:[],lastBirthdayGreeted:''});setShowPersonForm(true)}
  const openEditPerson=(p:Person)=>{setEditingPerson({...p});setShowPersonForm(true)}

  return (
    <div className="max-w-4xl">
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
        @keyframes celebrate{0%{transform:scale(0);opacity:0}50%{transform:scale(1.3)}100%{transform:scale(1);opacity:1}}
        .anim-celebrate{animation:celebrate .4s ease}
        .img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:4px}
        .img-thumb{width:100%;height:80px;object-fit:cover;border-radius:6px;cursor:pointer;transition:transform .15s}
        .img-thumb:hover{transform:scale(1.05)}
        .img-preview-overlay{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;cursor:pointer}
        .img-preview-overlay img{max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
      `}</style>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-800">关系梳理</h2>
        <span className="text-xs text-zinc-400">{people.length}人</span>
      </div>

      <div className="flex gap-2 mb-6">
        {CATEGORIES.map(c=>(<button key={c.key} onClick={()=>{setTab(c.key);setSelectedPerson(null)}} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200" style={{background:tab===c.key?c.bg:'#f4f4f5',color:tab===c.key?c.color:'#71717a',border:`1.5px solid ${tab===c.key?c.border:'transparent'}`,boxShadow:tab===c.key?`0 0 0 2px ${c.accent}20`:'none'}}><span className="text-base">{c.icon}</span>{c.label}</button>))}
      </div>

      {/* People */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{cat.label}人物</h3>
        <button onClick={openNewPerson} className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors" style={{color:cat.color,background:cat.bg}}>+ 添加</button>
      </div>

      {people.length===0?(
        <div className="text-center py-8 mb-6 rounded-2xl border border-dashed border-zinc-200">
          <div className="text-3xl mb-2 opacity-30">👨‍👩‍👧‍👦</div>
          <p className="text-sm text-zinc-400">添加人物，记录重要日子</p>
        </div>
      ):(
        <div className="flex flex-wrap gap-2 mb-6">
          {people.map(p=>{
            const isSel=selectedPerson===p.id; const isBday=p.birthday===todayMMDD()
            return (
              <div key={p.id} onClick={()=>setSelectedPerson(isSel?null:p.id)} className={`cursor-pointer text-left rounded-2xl border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${isSel?'p-4 shadow-sm block w-full':'p-2.5 inline-flex items-center'}`}
                style={{background:isSel?cat.bg:'#fff',borderColor:isSel?cat.border:isBday?'#fca5a5':'#e4e4e7',boxShadow:isSel?`0 0 0 3px ${cat.accent}15`:'none'}}>
                <div className="flex items-center" style={{gap:isSel?12:6}}>
                  <div className="shrink-0 flex items-center justify-center rounded-lg transition-all duration-300"
                    style={{width:isSel?48:32,height:isSel?48:32,fontSize:isSel?30:20,background:isSel?cat.bg:'#f4f4f5'}}>
                    {p.avatar}
                  </div>
                  <div className={isSel?'flex-1 min-w-0':''}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-800" style={{fontSize:isSel?14:12}}>{p.name||'未命名'}</span>
                      {p.relationship&&<span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{background:isSel?cat.tagBg:'#f4f4f5',color:isSel?cat.tagText:'#a1a1aa'}}>{p.relationship}</span>}
                      {!isSel&&<BirthdayBadge p={p}/>}
                    </div>
                    {isSel&&<div className="flex flex-wrap gap-1.5 mt-1.5"><BirthdayBadge p={p}/></div>}
                    {isSel&&p.review&&<p className="text-[11px] text-zinc-500 mt-2 line-clamp-1 italic">💬 {p.review}</p>}
                    {isSel&&p.diary&&p.diary.length>0&&<p className="text-[10px] text-zinc-400 mt-1">📓 {p.diary.length}篇日记</p>}
                  </div>
                  {isSel&&<span className="text-zinc-300 text-xs mt-1">▾</span>}
                </div>

                {isSel&&(
                  <div className="mt-4 pt-4" style={{borderTop:`1px solid ${cat.border}`}}>
                    {p.birthday && (
                      <div className="mb-3">
                        <button onClick={async e=>{e.stopPropagation();
                          if(p.birthday===todayMMDD()){
                            // 工具按钮：写剪贴板 → 唤起微信，每次点击都执行，不锁定状态
                            const msg = `祝${p.name||'你'}生日快乐！健康平安，天天开心 🎂`
                            const copied = await copyText(msg)
                            openWeChat()
                            setGreetMsg(copied ? '祝福语已复制，微信已打开，去粘贴发送吧 ✨' : '已打开微信，祝福语请手动输入')
                          }else{
                            setGreetMsg(`今天还不是${p.name||'TA'}的生日，等到${p.birthday.replace('-','月')}日再来吧`)
                          }
                          setTimeout(()=>setGreetMsg(''),4000)
                        }} className={`w-full py-2 text-xs font-medium rounded-lg transition-colors ${p.birthday===todayMMDD()?'text-white anim-celebrate':'text-zinc-500 border border-zinc-200'}`}
                          style={{background:p.birthday===todayMMDD()?'#ef4444':'#fff'}}>
                          🎂 {p.birthday===todayMMDD()?'发送生日祝福':'生日祝福'}
                        </button>
                        {greetMsg&&<p className="text-xs text-center mt-1" style={{color:p.birthday===todayMMDD()?'#10b981':'#f97316'}}>{greetMsg}</p>}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      {p.birthday&&<div className="flex justify-between"><span className="text-zinc-400">生日</span><span className="text-zinc-700 font-medium">{p.birthday}</span></div>}
                      {p.phone&&<div className="flex justify-between"><span className="text-zinc-400">电话</span><span className="text-zinc-700 font-medium">{p.phone}</span></div>}
                    </div>

                    {/* Review */}
                    <div className="mb-3 p-3 rounded-xl" style={{background:'rgba(255,255,255,0.5)',border:`1px solid ${cat.border}`}}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider">评价</span>
                        {!reviewEdit&&<button onClick={e=>{e.stopPropagation();setReviewEdit(true);setReviewDraft(p.review||'')}} className="text-[10px] text-zinc-400 hover:text-zinc-600">{p.review?'编辑':'写评价'}</button>}
                      </div>
                      {reviewEdit?(
                        <div onClick={e=>e.stopPropagation()}>
                          <textarea value={reviewDraft} onChange={e=>setReviewDraft(e.target.value)} className="w-full p-2 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300 resize-none" rows={2} placeholder="简短评价这个人..." autoFocus/>
                          <div className="flex justify-end gap-2 mt-1">
                            <button onClick={()=>setReviewEdit(false)} className="px-2 py-0.5 text-[10px] text-zinc-500 rounded">取消</button>
                            <button onClick={()=>saveReview(p.id,reviewDraft)} className="px-2 py-0.5 text-[10px] font-medium text-white rounded" style={{background:cat.color}}>保存</button>
                          </div>
                        </div>
                      ):(
                        <p className="text-xs text-zinc-600">{p.review||<span className="text-zinc-300 italic">暂无评价</span>}</p>
                      )}
                    </div>

                    {/* Diary */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider">日记 ({(p.diary||[]).length})</span>
                        <button onClick={e=>{e.stopPropagation();setDiaryOpen(!diaryOpen);setDiaryDraft('');setDiaryImgs([])}} className="text-[10px] font-medium transition-colors" style={{color:cat.color}}>{diaryOpen?'收起':'+ 写日记'}</button>
                      </div>
                      {diaryOpen&&(
                        <div onClick={e=>e.stopPropagation()} className="mb-3 p-3 rounded-xl" style={{background:'rgba(255,255,255,0.5)',border:`1px solid ${cat.border}`}}>
                          <textarea value={diaryDraft} onChange={e=>setDiaryDraft(e.target.value)} className="w-full p-2 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300 resize-none" rows={3} placeholder="记录和TA的一件事..." autoFocus/>
                          {diaryImgs.length>0&&(<div className="img-grid mt-2">{diaryImgs.map((img,i)=>(<div key={i} className="relative"><img src={img} className="img-thumb" alt=""/><button onClick={()=>setDiaryImgs(prev=>prev.filter((_,j)=>j!==i))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center">✕</button></div>))}</div>)}
                          <div className="flex items-center justify-between mt-2">
                            <button onClick={e=>{e.stopPropagation();imgRef.current?.click()}} className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 px-2 py-1 rounded-lg hover:bg-black/5 transition-colors">🖼 添加图片</button>
                            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={async e=>{const files=Array.from(e.target.files||[]);const imgs=await Promise.all(files.map(readImage));setDiaryImgs(prev=>[...prev,...imgs]);e.target.value=''}}/>
                            <button onClick={()=>addDiary(p.id)} disabled={!diaryDraft.trim()&&diaryImgs.length===0} className="px-3 py-1 text-[10px] font-medium text-white rounded-lg transition-all disabled:opacity-30" style={{background:cat.color}}>发布</button>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                      {(p.diary||[]).slice(0,diaryOpen?99:6).map(e => {
                        const imgs = e.images || []
                        const cover = imgs[0] || null
                        const hasContent = !!e.content
                        return (
                          <div key={e.id} className="relative rounded-xl overflow-hidden cursor-pointer group transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                            onClick={ev=>{ev.stopPropagation();setExpandedDiary(expandedDiary===e.id?null:e.id)}}
                            style={{background:cover?'transparent':cat.bg,border:cover?'none':`1px solid ${cat.border}`}}>
                            {/* Cover image or gradient placeholder */}
                            {cover ? (
                              <div className="relative">
                                <img src={cover} className="w-full object-cover" style={{height:120}} alt=""/>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                <span className="absolute top-2 right-2 text-[9px] bg-white/90 text-zinc-600 px-1.5 py-0.5 rounded-md">{e.date.slice(5)}</span>
                                {hasContent&&<p className="absolute bottom-2 left-3 right-3 text-[11px] text-white font-medium line-clamp-1 drop-shadow-sm">{e.content.slice(0,40)}</p>}
                              </div>
                            ) : (
                              <div className="p-4 pb-2" style={{minHeight:100}}>
                                <div className="flex items-start justify-between mb-2">
                                  {hasContent
                                    ? <p className="text-xs text-zinc-600 leading-relaxed line-clamp-3 flex-1">{e.content}</p>
                                    : <div className="flex-1 text-2xl opacity-20" style={{color:cat.color}}>📝</div>
                                  }
                                </div>
                              </div>
                            )}
                            {/* Footer */}
                            <div className="flex items-center justify-between px-3 pb-3" style={{background:cover?'rgba(255,255,255,0.95)':''}}>
                              <span className="text-[9px] text-zinc-400">{formatDate(e.date)}</span>
                              <div className="flex items-center gap-2">
                                {imgs.length>0&&<span className="text-[9px] text-zinc-400">📷 {imgs.length}</span>}
                                {hasContent&&!cover&&<span className="text-[9px] text-zinc-400">📄 {e.content.length}字</span>}
                                <button onClick={ev=>{ev.stopPropagation();if(window.confirm('删除这条日记？'))deleteDiary(p.id,e.id)}} className="opacity-0 group-hover:opacity-100 text-[9px] text-zinc-400 hover:text-red-400 transition-all">删除</button>
                              </div>
                            </div>
                            {/* Expanded view */}
                            {expandedDiary===e.id&&(
                              <div className="px-3 pb-3 bg-white" onClick={ev=>ev.stopPropagation()}>
                                {cover&&hasContent&&<p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap mb-2">{e.content}</p>}
                                {imgs.length>1&&(
                                  <div className="flex gap-1.5 flex-wrap">
                                    {imgs.map((img,i)=>(<img key={i} src={img} className="rounded-md cursor-pointer hover:opacity-90 transition-opacity" style={{width:56,height:56,objectFit:'cover'}} alt="" onClick={()=>setPreviewImg(img)}/>))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      </div>
                      {!diaryOpen&&(p.diary||[]).length>6&&<p className="text-center text-[10px] text-zinc-400 cursor-pointer mt-1" onClick={e=>{e.stopPropagation();setDiaryOpen(true)}}>查看全部 {(p.diary||[]).length} 篇...</p>}
                    </div>

                    {p.notes&&<div className="text-[11px] text-zinc-500 italic mb-3" style={{background:'rgba(255,255,255,0.6)',padding:'6px 10px',borderRadius:8}}>📝 {p.notes}</div>}
                    <div className="flex gap-2"><button onClick={e=>{e.stopPropagation();openEditPerson(p)}} className="text-[11px] px-3 py-1 rounded-lg text-zinc-500 hover:bg-black/5 transition-colors">编辑资料</button><button onClick={e=>{e.stopPropagation();if(window.confirm('确定删除？'))deletePerson(p.id)}} className="text-[11px] px-3 py-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors">删除</button></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showPersonForm&&editingPerson&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)'}} onClick={()=>{setShowPersonForm(false);setEditingPerson(null)}}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e=>e.stopPropagation()} style={{maxHeight:'90vh',overflow:'auto'}}>
            <h3 className="text-sm font-semibold text-zinc-800 mb-4">{people.find(x=>x.id===editingPerson.id)?'编辑信息':`添加${cat.label}人物`}</h3>
            <div className="space-y-3">
              <div><label className="text-[11px] text-zinc-500 mb-1 block">头像</label><div className="grid grid-cols-6 gap-1.5">{AVATARS.map(a=>(<button key={a.e} onClick={()=>setEditingPerson({...editingPerson,avatar:a.e})} className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all ${editingPerson.avatar===a.e?'ring-2 shadow-sm':'opacity-60 hover:opacity-100'}`} style={{ringColor:cat.color,background:editingPerson.avatar===a.e?cat.bg:'transparent'}}><span className="text-xl">{a.e}</span><span className="text-[8px]" style={{color:editingPerson.avatar===a.e?cat.color:'#a1a1aa'}}>{a.l}</span></button>))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] text-zinc-500 mb-1 block">姓名</label><input value={editingPerson.name} onChange={e=>setEditingPerson({...editingPerson,name:e.target.value})} className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300" placeholder="如：舅舅"/></div>
                <div><label className="text-[11px] text-zinc-500 mb-1 block">关系</label><input value={editingPerson.relationship} onChange={e=>setEditingPerson({...editingPerson,relationship:e.target.value})} className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300" placeholder="如：舅舅"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] text-zinc-500 mb-1 block">生日</label><BirthdayPicker value={editingPerson.birthday} onChange={v=>setEditingPerson({...editingPerson,birthday:v})}/></div>
                <div><label className="text-[11px] text-zinc-500 mb-1 block">电话</label><input value={editingPerson.phone} onChange={e=>setEditingPerson({...editingPerson,phone:e.target.value})} className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300" placeholder="手机号"/></div>
              </div>
              <div><label className="text-[11px] text-zinc-500 mb-1 block">备注</label><textarea value={editingPerson.notes} onChange={e=>setEditingPerson({...editingPerson,notes:e.target.value})} className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300 resize-none" rows={2} placeholder="兴趣爱好、注意事项等"/></div>
              <div className="flex gap-2 pt-2"><button onClick={()=>{setShowPersonForm(false);setEditingPerson(null)}} className="flex-1 py-2 text-xs rounded-lg text-zinc-500 border border-zinc-200 hover:bg-zinc-50 transition-colors">取消</button><button onClick={()=>savePerson(editingPerson)} disabled={!editingPerson.name.trim()} className="flex-1 py-2 text-xs font-medium text-white rounded-lg transition-all disabled:opacity-30" style={{background:cat.color}}>保存</button></div>
            </div>
          </div>
        </div>
      )}
      {previewImg&&<div className="img-preview-overlay" onClick={()=>setPreviewImg(null)}><img src={previewImg} alt=""/></div>}
    </div>
  )
}
