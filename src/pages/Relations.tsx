import { useState, useCallback, useMemo, useRef } from 'react'

// ============================================================
// Types & Storage
// ============================================================
type Category = 'family' | 'friendship' | 'love'

interface VisitLog { date: string; notes: string }
interface DiaryEntry { id: string; content: string; images: string[]; date: string }

interface Person {
  id: string; name: string; avatar: string; relationship: string
  birthday: string; phone: string; notes: string; review: string
  visitReminder: { enabled: boolean; frequency: 'monthly'; dayOfMonth: number } | null
  visitLog: VisitLog[]; diary: DiaryEntry[]; lastBirthdayGreeted: string
}
interface Post { id: string; content: string; date: string }
interface RelationData {
  family: { people: Person[]; posts: Post[] }
  friendship: { people: Person[]; posts: Post[] }
  love: { people: Person[]; posts: Post[] }
}

const STORAGE_KEY = 'wb_relations_v3'
const CATEGORIES: { key: Category; label: string; icon: string; color: string; bg: string; border: string; accent: string; tagBg: string; tagText: string }[] = [
  { key:'family', label:'亲情', icon:'🏠', color:'#f97316', bg:'#fff7ed', border:'#fed7aa', accent:'#fb923c', tagBg:'#ffedd5', tagText:'#c2410c' },
  { key:'friendship', label:'友情', icon:'🤝', color:'#10b981', bg:'#ecfdf5', border:'#a7f3d0', accent:'#34d399', tagBg:'#d1fae5', tagText:'#065f46' },
  { key:'love', label:'爱情', icon:'💕', color:'#ec4899', bg:'#fdf2f8', border:'#fbcfe8', accent:'#f472b6', tagBg:'#fce7f3', tagText:'#9d174d' },
]
const AVATARS = '😊👨👩👴👵🧓👱👳👲🧔🧑👩‍🦰👨‍🦳🧑‍🦱🙂🤗😎🤓😇🥰'.split('').filter(c => c.length>=2||c.length===1)

function loadData(): RelationData {
  const empty = { family:{people:[],posts:[]}, friendship:{people:[],posts:[]}, love:{people:[],posts:[]} }
  try {
    let raw = localStorage.getItem(STORAGE_KEY)
    if(raw){const d=JSON.parse(raw);return {family:d.family||empty.family,friendship:Array.isArray(d.friendship)?{people:[],posts:d.friendship}:(d.friendship||empty.friendship),love:Array.isArray(d.love)?{people:[],posts:d.love}:(d.love||empty.love)}}
    raw=localStorage.getItem('wb_relations_v2')
    if(raw){const d=JSON.parse(raw);return {family:d.family||empty.family,friendship:{people:[],posts:d.friendship||[]},love:{people:[],posts:d.love||[]}}}
  } catch {}
  return empty
}
function saveData(data: RelationData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
function generateId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,7) }
function today() { return new Date().toISOString().slice(0,10) }
function todayMMDD() { const d=new Date();return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function thisYear() { return String(new Date().getFullYear()) }
function formatDate(d:string){const dt=new Date(d);const diff=Date.now()-dt.getTime();const mins=Math.floor(diff/6e4);if(mins<1)return'刚刚';if(mins<60)return`${mins}分钟前`;const hrs=Math.floor(mins/60);if(hrs<24)return`${hrs}小时前`;const days=Math.floor(hrs/24);if(days<7)return`${days}天前`;return dt.toLocaleDateString('zh-CN',{month:'short',day:'numeric'})}
function daysUntil(mmdd:string){const now=new Date();const [m,d]=mmdd.split('-').map(Number);const t=new Date(now.getFullYear(),m-1,d);if(t<now)t.setFullYear(t.getFullYear()+1);return Math.ceil((t.getTime()-now.getTime())/864e5)}
function readImage(file: File): Promise<string> { return new Promise((resolve)=>{const r=new FileReader();r.onload=()=>resolve(r.result as string);r.readAsDataURL(file)}) }

// ============================================================
// Sub-components
// ============================================================
function BirthdayBadge({ p }: { p: Person }) {
  const days=daysUntil(p.birthday); const t=todayMMDD()
  if(p.birthday===t && p.lastBirthdayGreeted!==thisYear())return <span style={{fontSize:10,color:'#ef4444',background:'#fee2e2',padding:'1px 6px',borderRadius:8,animation:'pulse 1.5s infinite'}}>🎂 今天生日！</span>
  if(p.birthday===t)return <span style={{fontSize:10,color:'#10b981',background:'#d1fae5',padding:'1px 6px',borderRadius:8}}>已祝福</span>
  if(days<=7)return <span style={{fontSize:10,color:'#b45309',background:'#fef3c7',padding:'1px 6px',borderRadius:8}}>🎂 {days}天</span>
  return null
}
function VisitBadge({ p }: { p: Person }) {
  if(!p.visitReminder?.enabled)return null;const now=new Date();const d=p.visitReminder.dayOfMonth;const td=now.getDate()
  const m=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;const v=p.visitLog.some(l=>l.date.startsWith(m))
  if(v)return <span style={{fontSize:10,color:'#059669',background:'#d1fae5',padding:'1px 6px',borderRadius:8}}>✅ 已看望</span>
  if(td===d)return <span style={{fontSize:10,color:'#f97316',background:'#ffedd5',padding:'1px 6px',borderRadius:8,animation:'pulse 1.5s infinite'}}>📅 今天看望</span>
  if(td>d)return <span style={{fontSize:10,color:'#dc2626',background:'#fee2e2',padding:'1px 6px',borderRadius:8}}>⚠ 已过期</span>
  return <span style={{fontSize:10,color:'#7c2d12',background:'#fed7aa',padding:'1px 6px',borderRadius:8}}>📅 {d-td}天后</span>
}

// ============================================================
// Main Component
// ============================================================
export function RelationsPage() {
  const [data,setData]=useState(loadData)
  const [tab,setTab]=useState<Category>('family')
  const [selectedPerson,setSelectedPerson]=useState<string|null>(null)
  const [showPersonForm,setShowPersonForm]=useState(false)
  const [editingPerson,setEditingPerson]=useState<Person|null>(null)
  const [writing,setWriting]=useState(false);const [draft,setDraft]=useState('')
  // Diary state
  const [diaryOpen,setDiaryOpen]=useState(false);const [diaryDraft,setDiaryDraft]=useState('');const [diaryImgs,setDiaryImgs]=useState<string[]>([])
  // Review editing
  const [reviewEdit,setReviewEdit]=useState(false);const [reviewDraft,setReviewDraft]=useState('')
  const imgRef=useRef<HTMLInputElement>(null)

  const cat=CATEGORIES.find(c=>c.key===tab)!; const cd=data[tab]; const people=cd.people; const posts=cd.posts
  const person=useMemo(()=>people.find(p=>p.id===selectedPerson)||null,[people,selectedPerson])

  const savePerson=useCallback((p:Person)=>{setData(prev=>{const cd=prev[tab];const idx=cd.people.findIndex(x=>x.id===p.id);const np=idx>=0?cd.people.map(x=>x.id===p.id?p:x):[...cd.people,p];const next={...prev,[tab]:{...cd,people:np}};saveData(next);return next});setShowPersonForm(false);setEditingPerson(null);setSelectedPerson(p.id)},[tab])
  const deletePerson=useCallback((id:string)=>{setData(prev=>{const cd=prev[tab];const next={...prev,[tab]:{...cd,people:cd.people.filter(p=>p.id!==id)}};saveData(next);return next});setSelectedPerson(null)},[tab])
  const saveReview=useCallback((pid:string,review:string)=>{setData(prev=>{const cd=prev[tab];const next={...prev,[tab]:{...cd,people:cd.people.map(p=>p.id===pid?{...p,review}:p)}};saveData(next);return next});setReviewEdit(false)},[tab])
  const markVisited=useCallback((pid:string)=>{setData(prev=>{const cd=prev[tab];const next={...prev,[tab]:{...cd,people:cd.people.map(p=>p.id===pid?{...p,visitLog:[{date:today(),notes:''},...p.visitLog]}:p)}};saveData(next);return next})},[tab])
  const greetBirthday=useCallback((pid:string)=>{setData(prev=>{const cd=prev[tab];const next={...prev,[tab]:{...cd,people:cd.people.map(p=>p.id===pid?{...p,lastBirthdayGreeted:thisYear()}:p)}};saveData(next);return next})},[tab])
  const addDiary=useCallback((pid:string)=>{if(!diaryDraft.trim()&&diaryImgs.length===0)return;const e:DiaryEntry={id:generateId(),content:diaryDraft.trim(),images:diaryImgs,date:today()};setData(prev=>{const cd=prev[tab];const next={...prev,[tab]:{...cd,people:cd.people.map(p=>p.id===pid?{...p,diary:[e,...p.diary]}:p)}};saveData(next);return next});setDiaryDraft('');setDiaryImgs([]);setDiaryOpen(false)},[tab,diaryDraft,diaryImgs])
  const deleteDiary=useCallback((pid:string,eid:string)=>{setData(prev=>{const cd=prev[tab];const next={...prev,[tab]:{...cd,people:cd.people.map(p=>p.id===pid?{...p,diary:p.diary.filter(e=>e.id!==eid)}:p)}};saveData(next);return next})},[tab])
  const addPost=useCallback((c:string)=>{if(!c.trim())return;const p:Post={id:generateId(),content:c.trim(),date:new Date().toISOString()};setData(prev=>{const cd=prev[tab];const next={...prev,[tab]:{...cd,posts:[p,...cd.posts]}};saveData(next);return next});setWriting(false);setDraft('')},[tab])
  const deletePost=useCallback((id:string)=>{setData(prev=>{const cd=prev[tab];const next={...prev,[tab]:{...cd,posts:cd.posts.filter(p=>p.id!==id)}};saveData(next);return next})},[tab])
  const openNewPerson=()=>{setEditingPerson({id:generateId(),name:'',avatar:AVATARS[Math.floor(Math.random()*AVATARS.length)],relationship:'',birthday:'',phone:'',notes:'',review:'',visitReminder:{enabled:true,frequency:'monthly',dayOfMonth:1},visitLog:[],diary:[],lastBirthdayGreeted:''});setShowPersonForm(true)}
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
        <h2 className="text-lg font-semibold text-zinc-800">关系疏离</h2>
        <span className="text-xs text-zinc-400">{people.length}人 · {posts.length}篇</span>
      </div>

      <div className="flex gap-2 mb-6">
        {CATEGORIES.map(c=>(<button key={c.key} onClick={()=>{setTab(c.key);setSelectedPerson(null);setWriting(false)}} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200" style={{background:tab===c.key?c.bg:'#f4f4f5',color:tab===c.key?c.color:'#71717a',border:`1.5px solid ${tab===c.key?c.border:'transparent'}`,boxShadow:tab===c.key?`0 0 0 2px ${c.accent}20`:'none'}}><span className="text-base">{c.icon}</span>{c.label}</button>))}
      </div>

      {/* === People === */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {people.map(p=>{
            const isSel=selectedPerson===p.id; const isBday=p.birthday===todayMMDD()&&p.lastBirthdayGreeted!==thisYear(); const isVisit=p.visitReminder?.enabled&&new Date().getDate()===p.visitReminder.dayOfMonth
            return (
              <button key={p.id} onClick={()=>setSelectedPerson(isSel?null:p.id)} className={`text-left p-4 rounded-2xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${isSel?'shadow-sm':''}`}
                style={{background:isSel?cat.bg:'#fff',borderColor:isSel?cat.border:isBday?'#fca5a5':isVisit?'#fdba74':'#e4e4e7',boxShadow:isSel?`0 0 0 3px ${cat.accent}15`:'none'}}>
                <div className="flex items-start gap-3">
                  <div className="text-3xl shrink-0 w-12 h-12 flex items-center justify-center rounded-xl" style={{background:cat.bg}}>{p.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5"><span className="text-sm font-semibold text-zinc-800">{p.name||'未命名'}</span>{p.relationship&&<span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{background:cat.tagBg,color:cat.tagText}}>{p.relationship}</span>}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5"><BirthdayBadge p={p}/><VisitBadge p={p}/></div>
                    {p.review&&<p className="text-[11px] text-zinc-500 mt-2 line-clamp-1 italic">💬 {p.review}</p>}
                    {p.diary.length>0&&<p className="text-[10px] text-zinc-400 mt-1">📓 {p.diary.length}篇日记</p>}
                  </div>
                  {isSel&&<span className="text-zinc-300 text-xs mt-1">▾</span>}
                </div>

                {/* === Expanded detail === */}
                {isSel&&(
                  <div className="mt-4 pt-4" style={{borderTop:`1px solid ${cat.border}`}}>
                    {/* Quick actions */}
                    <div className="flex gap-2 mb-4">
                      {p.birthday===todayMMDD()&&p.lastBirthdayGreeted!==thisYear()&&(
                        <button onClick={e=>{e.stopPropagation();greetBirthday(p.id)}} className="flex-1 py-2 text-xs font-medium rounded-lg text-white transition-colors hover:opacity-90 anim-celebrate" style={{background:'#ef4444'}}>🎂 发送生日祝福</button>
                      )}
                      {p.visitReminder?.enabled&&(
                        <button onClick={e=>{e.stopPropagation();markVisited(p.id)}} className="flex-1 py-2 text-xs font-medium rounded-lg transition-colors hover:opacity-90" style={{color:cat.color,background:cat.bg}}>✅ 标记为已看望</button>
                      )}
                    </div>

                    {/* Info */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      {p.birthday&&<div className="flex justify-between"><span className="text-zinc-400">生日</span><span className="text-zinc-700 font-medium">{p.birthday}</span></div>}
                      {p.phone&&<div className="flex justify-between"><span className="text-zinc-400">电话</span><span className="text-zinc-700 font-medium">{p.phone}</span></div>}
                      {p.visitReminder?.enabled&&<div className="flex justify-between"><span className="text-zinc-400">定期看望</span><span className="text-zinc-700 font-medium">每月{p.visitReminder.dayOfMonth}号</span></div>}
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

                    {/* Visit log */}
                    {p.visitLog.length>0&&(
                      <div className="mb-3"><div className="text-[10px] text-zinc-400 mb-1.5">看望记录</div>
                        <div className="space-y-1">{p.visitLog.slice(0,3).map((l,i)=><div key={i} className="flex justify-between text-[11px]"><span className="text-zinc-600">{l.date.slice(5)}</span>{l.notes&&<span className="text-zinc-400 italic truncate ml-2">{l.notes}</span>}</div>)}</div>
                      </div>
                    )}

                    {/* Diary */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider">日记 ({p.diary.length})</span>
                        <button onClick={e=>{e.stopPropagation();setDiaryOpen(!diaryOpen);setDiaryDraft('');setDiaryImgs([])}} className="text-[10px] font-medium transition-colors" style={{color:cat.color}}>
                          {diaryOpen?'收起':'+ 写日记'}
                        </button>
                      </div>

                      {diaryOpen&&(
                        <div onClick={e=>e.stopPropagation()} className="mb-3 p-3 rounded-xl" style={{background:'rgba(255,255,255,0.5)',border:`1px solid ${cat.border}`}}>
                          <textarea value={diaryDraft} onChange={e=>setDiaryDraft(e.target.value)} className="w-full p-2 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300 resize-none" rows={3} placeholder="记录和TA的一件事..." autoFocus/>
                          {/* Image upload */}
                          {diaryImgs.length>0&&(
                            <div className="img-grid mt-2">{diaryImgs.map((img,i)=>(<div key={i} className="relative"><img src={img} className="img-thumb" alt=""/><button onClick={()=>setDiaryImgs(prev=>prev.filter((_,j)=>j!==i))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center">✕</button></div>))}</div>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <button onClick={e=>{e.stopPropagation();imgRef.current?.click()}} className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 px-2 py-1 rounded-lg hover:bg-black/5 transition-colors">🖼 添加图片</button>
                            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={async e=>{const files=Array.from(e.target.files||[]);const imgs=await Promise.all(files.map(readImage));setDiaryImgs(prev=>[...prev,...imgs]);e.target.value=''}}/>
                            <button onClick={()=>addDiary(p.id)} disabled={!diaryDraft.trim()&&diaryImgs.length===0} className="px-3 py-1 text-[10px] font-medium text-white rounded-lg transition-all disabled:opacity-30" style={{background:cat.color}}>发布</button>
                          </div>
                        </div>
                      )}

                      {p.diary.slice(0,diaryOpen?99:2).map(e=>{
                        const [previewImg,setPreviewImg]=useState<string|null>(null)
                        return (
                          <div key={e.id} className="mb-2 p-3 rounded-xl group" style={{background:'rgba(255,255,255,0.5)',border:`1px solid ${cat.border}`}}>
                            {e.content&&<p className="text-xs text-zinc-700 mb-2 whitespace-pre-wrap">{e.content}</p>}
                            {e.images.length>0&&(
                              <div className="img-grid mb-2">{e.images.map((img,i)=>(<img key={i} src={img} className="img-thumb" alt="" onClick={ev=>{ev.stopPropagation();setPreviewImg(img)}}/>))}</div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-zinc-400">{formatDate(e.date)}</span>
                              <button onClick={ev=>{ev.stopPropagation();if(window.confirm('删除这条日记？'))deleteDiary(p.id,e.id)}} className="opacity-0 group-hover:opacity-100 text-[9px] text-zinc-400 hover:text-red-400 transition-all">删除</button>
                            </div>
                            {previewImg&&(<div className="img-preview-overlay" onClick={()=>setPreviewImg(null)}><img src={previewImg} alt=""/></div>)}
                          </div>
                        )
                      })}
                      {!diaryOpen&&p.diary.length>2&&<p className="text-center text-[10px] text-zinc-400 cursor-pointer" onClick={e=>{e.stopPropagation();setDiaryOpen(true)}}>展开全部 {p.diary.length} 篇...</p>}
                    </div>

                    {p.notes&&<div className="text-[11px] text-zinc-500 italic mb-3" style={{background:'rgba(255,255,255,0.6)',padding:'6px 10px',borderRadius:8}}>📝 {p.notes}</div>}
                    <div className="flex gap-2"><button onClick={e=>{e.stopPropagation();openEditPerson(p)}} className="text-[11px] px-3 py-1 rounded-lg text-zinc-500 hover:bg-black/5 transition-colors">编辑资料</button><button onClick={e=>{e.stopPropagation();if(window.confirm('确定删除？'))deletePerson(p.id)}} className="text-[11px] px-3 py-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors">删除</button></div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Divider + Posts */}
      <div className="flex items-center gap-3 mb-4"><div className="flex-1 h-px bg-zinc-100"/><span className="text-[10px] text-zinc-400">记忆片段</span><div className="flex-1 h-px bg-zinc-100"/></div>

      <div className="mb-6">
        {writing?(<div className="rounded-2xl overflow-hidden" style={{background:cat.bg,border:`1.5px solid ${cat.border}`}}><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder={`记录一段${cat.label}故事...`} autoFocus className="w-full p-4 text-sm text-zinc-700 bg-transparent resize-none focus:outline-none" rows={4} style={{background:'rgba(255,255,255,0.5)'}}/><div className="flex justify-between items-center px-4 pb-4" style={{background:'rgba(255,255,255,0.3)'}}><span className="text-[10px]" style={{color:cat.accent}}>{draft.length} 字</span><div className="flex gap-2"><button onClick={()=>{setWriting(false);setDraft('')}} className="px-3 py-1.5 text-xs rounded-lg text-zinc-500 hover:bg-black/5 transition-colors">取消</button><button onClick={()=>addPost(draft)} disabled={!draft.trim()} className="px-4 py-1.5 text-xs font-medium rounded-lg text-white transition-all disabled:opacity-30" style={{background:cat.color}}>发布</button></div></div></div>):(<button onClick={()=>setWriting(true)} className="w-full p-4 rounded-2xl text-left text-sm text-zinc-400 hover:text-zinc-500 hover:bg-zinc-50 border border-dashed border-zinc-200 hover:border-zinc-300 transition-all"><span className="text-base mr-2">{cat.icon}</span>写点什么...</button>)}
      </div>

      {posts.length===0?(<div className="text-center py-8"><div className="text-4xl mb-3 opacity-30">{cat.icon}</div><p className="text-sm text-zinc-400">还没有记录</p></div>):(
        <div className="space-y-4">{posts.map(post=>(<div key={post.id} className="rounded-2xl p-5 transition-all duration-200 group hover:shadow-md hover:-translate-y-0.5" style={{background:cat.bg,border:`1px solid ${cat.border}`}}><p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{post.content}</p><div className="flex items-center justify-between mt-3 pt-3" style={{borderTop:`1px solid ${cat.border}`}}><span className="text-[11px] text-zinc-400">{formatDate(post.date)}</span><button onClick={()=>{if(window.confirm('确定删除？'))deletePost(post.id)}} className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-400 hover:text-red-400 px-2 py-0.5 rounded transition-all">删除</button></div></div>))}</div>
      )}

      {/* === Person Edit Modal === */}
      {showPersonForm&&editingPerson&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)'}} onClick={()=>{setShowPersonForm(false);setEditingPerson(null)}}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e=>e.stopPropagation()} style={{maxHeight:'90vh',overflow:'auto'}}>
            <h3 className="text-sm font-semibold text-zinc-800 mb-4">{people.find(x=>x.id===editingPerson.id)?'编辑信息':`添加${cat.label}人物`}</h3>
            <div className="space-y-3">
              <div><label className="text-[11px] text-zinc-500 mb-1 block">头像</label><div className="flex flex-wrap gap-1.5">{AVATARS.map(a=>(<button key={a} onClick={()=>setEditingPerson({...editingPerson,avatar:a})} className={`text-xl p-1 rounded-lg transition-all ${editingPerson.avatar===a?'scale-110 shadow-sm':'opacity-50'}`} style={{background:editingPerson.avatar===a?cat.bg:'transparent'}}>{a}</button>))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] text-zinc-500 mb-1 block">姓名</label><input value={editingPerson.name} onChange={e=>setEditingPerson({...editingPerson,name:e.target.value})} className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300" placeholder="如：舅舅"/></div>
                <div><label className="text-[11px] text-zinc-500 mb-1 block">关系</label><input value={editingPerson.relationship} onChange={e=>setEditingPerson({...editingPerson,relationship:e.target.value})} className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300" placeholder="如：舅舅"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] text-zinc-500 mb-1 block">生日 (MM-DD)</label><input value={editingPerson.birthday} onChange={e=>setEditingPerson({...editingPerson,birthday:e.target.value})} className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300" placeholder="08-15" maxLength={5}/></div>
                <div><label className="text-[11px] text-zinc-500 mb-1 block">电话</label><input value={editingPerson.phone} onChange={e=>setEditingPerson({...editingPerson,phone:e.target.value})} className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300" placeholder="手机号"/></div>
              </div>
              <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editingPerson.visitReminder?.enabled??false} onChange={e=>setEditingPerson({...editingPerson,visitReminder:e.target.checked?{enabled:true,frequency:'monthly',dayOfMonth:15}:null})} className="rounded"/><span className="text-[11px] text-zinc-600">定期看望提醒</span></label>
                {editingPerson.visitReminder?.enabled&&(<div className="flex items-center gap-2 mt-2"><span className="text-[11px] text-zinc-400">每月</span><input type="number" min={1} max={28} value={editingPerson.visitReminder.dayOfMonth} onChange={e=>setEditingPerson({...editingPerson,visitReminder:{...editingPerson.visitReminder!,dayOfMonth:Math.min(28,Math.max(1,parseInt(e.target.value)||1))}})} className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300"/><span className="text-[11px] text-zinc-400">号</span></div>)}
              </div>
              <div><label className="text-[11px] text-zinc-500 mb-1 block">备注</label><textarea value={editingPerson.notes} onChange={e=>setEditingPerson({...editingPerson,notes:e.target.value})} className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-300 resize-none" rows={2} placeholder="兴趣爱好、注意事项等"/></div>
              <div className="flex gap-2 pt-2"><button onClick={()=>{setShowPersonForm(false);setEditingPerson(null)}} className="flex-1 py-2 text-xs rounded-lg text-zinc-500 border border-zinc-200 hover:bg-zinc-50 transition-colors">取消</button><button onClick={()=>savePerson(editingPerson)} disabled={!editingPerson.name.trim()} className="flex-1 py-2 text-xs font-medium text-white rounded-lg transition-all disabled:opacity-30" style={{background:cat.color}}>保存</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
