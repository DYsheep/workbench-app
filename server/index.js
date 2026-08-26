require('dotenv').config()

const http = require('http')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const bcrypt = require('bcryptjs')

// ============================================================
// Config
// ============================================================
const PORT = process.env.PORT || 3001
const NODE_ENV = process.env.NODE_ENV || 'development'
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim())
const BCRYPT_ROUNDS = 12

// 图片上传目录（服务器磁盘，数据库只存路径）
const UPLOAD_DIR = path.join(__dirname, 'uploads')
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
} catch (e) {
  console.error('[Upload] mkdir failed:', e.message)
}

// ============================================================
// Database setup
// ============================================================
let db
try {
  const Database = require('better-sqlite3')
  const dbDir = path.join(__dirname, 'data')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
  db = new Database(path.join(dbDir, 'workbench.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  console.log('[DB] SQLite connected')
} catch (e) {
  console.error('[DB] Fatal: better-sqlite3 unavailable:', e.message)
  process.exit(1)
}

// ============================================================
// Tables
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    role TEXT DEFAULT '成员',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- ====== 关系梳理（服务器端存储） ======
  CREATE TABLE IF NOT EXISTS relations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '👤',
    relationship TEXT DEFAULT '',
    birthday TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    review TEXT DEFAULT '',
    last_birthday_greeted TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_relations_user ON relations(user_id, category);

  CREATE TABLE IF NOT EXISTS relation_diaries (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES relations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    date TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_diaries_person ON relation_diaries(person_id);

  CREATE TABLE IF NOT EXISTS diary_images (
    id TEXT PRIMARY KEY,
    diary_id TEXT NOT NULL REFERENCES relation_diaries(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_diary_images ON diary_images(diary_id);

  -- ====== 我的计划（服务器端存储） ======
  CREATE TABLE IF NOT EXISTS plans (
    user_id TEXT NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    tasks TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, date)
  );

  -- ====== 药品收藏（服务器端快照，避免重复调用万维易源） ======
  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    drug_id TEXT NOT NULL,
    drug_name TEXT NOT NULL,
    manu TEXT DEFAULT '',
    spec TEXT DEFAULT '',
    detail TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, drug_id)
  );

  -- ====== 药品自定义模块（服务器端存储，每药可多个） ======
  CREATE TABLE IF NOT EXISTS drug_modules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    drug_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    sort INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_drug_modules ON drug_modules(user_id, drug_id);

  -- ====== 拇指琴统计（服务器端存储） ======
  CREATE TABLE IF NOT EXISTS kalimba_stats (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    streak INTEGER DEFAULT 0,
    last_date TEXT DEFAULT '',
    total_time INTEGER DEFAULT 0,
    achievements TEXT DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now'))
  );
`)
// 万维易源药品 API 索引表
const drugApi = require('./drugs')
drugApi.ensureIndexTable(db)

// 清理废弃表（drug_cache 旧 mock 缓存；workspaces/files 已删除模块）
try {
  db.exec('DROP TABLE IF EXISTS drug_cache')
  db.exec('DROP TABLE IF EXISTS files')
  db.exec('DROP TABLE IF EXISTS workspaces')
  db.exec('DROP TABLE IF EXISTS drug_notes')  // 备注已升级为自定义模块（drug_modules）
  console.log('[DB] Dropped legacy tables (drug_cache / workspaces / files / drug_notes)')
} catch (e) {
  console.error('[DB] Drop legacy tables failed:', e.message)
}

// ============================================================
// Session 过期策略（"记住我"长效会话）
// 未勾选记住我：12 小时 + 会话 cookie（关闭浏览器即失效）
// 勾选记住我：  30 天 + 持久 cookie
// 历史会话（无 expires_at）：按创建时间 7 天兜底
// 惰性：requireAuth 校验时顺手删过期会话
// 周期：启动时 + 每 6 小时批量清理
// ============================================================
const SESSION_TTL_SHORT_MS = 12 * 60 * 60 * 1000     // 12 小时
const SESSION_TTL_LONG_MS = 30 * 24 * 60 * 60 * 1000 // 30 天
const LEGACY_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

// sessions 表补充 expires_at 列（老库自动迁移，列已存在时忽略错误）
try {
  db.exec("ALTER TABLE sessions ADD COLUMN expires_at TEXT NOT NULL DEFAULT ''")
} catch { /* 列已存在 */ }

function cleanupExpiredSessions() {
  try {
    const now = new Date().toISOString()
    const legacyCutoff = new Date(Date.now() - LEGACY_SESSION_TTL_MS).toISOString()
    const r = db.prepare(
      "DELETE FROM sessions WHERE (expires_at != '' AND expires_at < ?) OR (expires_at = '' AND created_at < ?)"
    ).run(now, legacyCutoff)
    if (r.changes > 0) console.log(`[Session] 清理过期会话 ${r.changes} 个`)
  } catch (e) {
    console.error('[Session] cleanup failed:', e.message)
  }
}

function sessionIsExpired(row) {
  if (!row) return true
  if (row.expires_at) return Date.now() > new Date(row.expires_at).getTime()
  if (!row.created_at) return true
  return Date.now() - new Date(row.created_at).getTime() > LEGACY_SESSION_TTL_MS
}

// 启动清理 + 周期清理
cleanupExpiredSessions()
setInterval(cleanupExpiredSessions, 6 * 60 * 60 * 1000)

console.log('[DB] Tables ready')

// ============================================================
// Seed — admin user with random password
// ============================================================
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c
if (userCount === 0) {
  const adminPwd = crypto.randomBytes(8).toString('hex')
  const hash = bcrypt.hashSync(adminPwd, BCRYPT_ROUNDS)

  db.prepare('INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
    .run('u1', 'admin', hash, '管理员', '管理员')

  console.log('[DB] Seed data inserted')
  console.log(`[DB] ⚠️  管理员账号: admin / 密码: ${adminPwd}  (请立即修改)`)
}

// ============================================================
// Rate limiter
// ============================================================
const rateLimit = require('express-rate-limit')
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 10 : 1000,
  message: { error: '登录尝试过于频繁，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress,
})

// ============================================================
// Helpers
// ============================================================
function generateId() { return crypto.randomUUID() }

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { resolve({}) }
    })
  })
}

function parseQuery(url) {
  const q = {}
  const idx = url.indexOf('?')
  if (idx === -1) return q
  const search = url.slice(idx + 1)
  for (const pair of search.split('&')) {
    const [k, v] = pair.split('=').map(decodeURIComponent)
    q[k] = v
  }
  return q
}

function getSession(req) {
  const cookie = req.headers.cookie || ''
  const match = cookie.match(/session=([^;]+)/)
  return match ? match[1] : null
}

function requireAuth(req, res) {
  const sessionId = getSession(req)
  if (!sessionId) { json(res, { error: '未登录' }, 401); return null }
  const row = db.prepare('SELECT user_id, created_at, expires_at FROM sessions WHERE id = ?').get(sessionId)
  if (!row) { json(res, { error: '会话过期' }, 401); return null }
  // 惰性清理：过期会话当场删除
  if (sessionIsExpired(row)) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
    json(res, { error: '会话过期，请重新登录' }, 401)
    return null
  }
  return row
}

// ============================================================
// CORS — whitelist
// ============================================================
function corsHeaders(req, res) {
  const origin = req.headers.origin
  if (CORS_ORIGINS.includes(origin) || CORS_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin || CORS_ORIGINS[0])
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
}

// ============================================================
// Static file serving
// ============================================================
function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url
  const filePath = path.join(__dirname, '..', 'dist', urlPath)

  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  }
  const ext = path.extname(filePath)
  const mime = mimeTypes[ext] || 'application/octet-stream'

  try {
    const content = fs.readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' })
    res.end(content)
    return true
  } catch { return false }
}

// ============================================================
// Route handler
// ============================================================
async function handleRequest(req, res) {
  corsHeaders(req, res)
  if (req.method === 'OPTIONS') return json(res, { ok: true })

  const url = req.url
  const pathname = url.split('?')[0]

  // ====== Health check ======
  if (pathname === '/api/health' && req.method === 'GET') {
    return json(res, { status: 'ok', uptime: process.uptime(), db: !!db, env: NODE_ENV })
  }

  // ====== AUTH ======
  if (pathname === '/api/login' && req.method === 'POST') {
    // Apply rate limiter
    const limiterResult = await new Promise(resolve => {
      loginLimiter(req, res, () => resolve(null))
    })
    if (limiterResult !== null) return

    const { username, password, remember } = await parseBody(req)
    if (!username || !password || password.length < 4) {
      return json(res, { error: '用户名或密码错误' }, 401)
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!user) {
      return json(res, { error: '用户名或密码错误' }, 401)
    }

    const valid = bcrypt.compareSync(password, user.password_hash)
    if (!valid) {
      return json(res, { error: '用户名或密码错误' }, 401)
    }

    // 勾选"记住我"：30 天长效会话；否则 12 小时短会话
    const ttl = remember ? SESSION_TTL_LONG_MS : SESSION_TTL_SHORT_MS
    const expiresAt = new Date(Date.now() + ttl).toISOString()
    const sessionId = generateId()
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)').run(sessionId, user.id, expiresAt)

    const secure = NODE_ENV === 'production' ? '; Secure' : ''
    // 记住我 → 持久 cookie（Max-Age 30 天）；否则 → 会话 cookie，关闭浏览器即失效
    const maxAge = remember ? `; Max-Age=${Math.floor(SESSION_TTL_LONG_MS / 1000)}` : ''
    res.setHeader('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax${secure}${maxAge}`)
    return json(res, { user: { id: user.id, name: user.name, role: user.role, avatar: user.avatar } })
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const user = db.prepare('SELECT id, username, name, role, avatar FROM users WHERE id = ?').get(sess.user_id)
    return json(res, { user })
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const sessionId = getSession(req)
    if (sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
    // Clear cookie
    res.setHeader('Set-Cookie', 'session=; Path=/; Max-Age=0')
    return json(res, { ok: true })
  }

  // ====== DRUGS (万维易源) ======
  // GET /api/drugs/search?q=xxx → 本地索引候选 + 第一个候选详情
  if (pathname === '/api/drugs/search' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const q = parseQuery(url)
    const keyword = (q.q || '').trim()
    if (!keyword) return json(res, { error: '请输入药品名称' }, 400)

    if (!drugApi.getConfig().hasAppCode) {
      return json(res, { error: '服务端未配置万维易源 AppCode' }, 500)
    }

    // 索引为空时提示先构建
    const indexCount = db.prepare('SELECT COUNT(*) as c FROM drug_index').get().c
    if (indexCount === 0) {
      return json(res, {
        data: null,
        needIndex: true,
        message: '药品索引尚未建立，请先建立索引',
      })
    }

    // 本地模糊匹配候选
    let candidates = drugApi.searchIndex(db, keyword)

    // 索引未命中 → 按需补齐（深挖全库分类）
    let detail = null
    if (candidates.length) {
      detail = await drugApi.fetchDetail(candidates[0].drug_id)
    } else {
      try {
        const drugId = await drugApi.deepSearch(db, keyword)
        if (drugId) {
          candidates = drugApi.searchIndex(db, keyword)
          detail = await drugApi.fetchDetail(drugId)
        }
      } catch (e) {
        console.error('[Drugs] deepSearch error:', e.message)
      }
    }

    if (!detail) {
      // 返回索引覆盖信息，前端可提示"已扩展索引，可重试"
      const cov = db.prepare('SELECT COUNT(*) as c FROM drug_index_coverage').get()
      const idx = db.prepare('SELECT COUNT(*) as c FROM drug_index').get()
      return json(res, {
        data: null,
        deepSearched: true,
        message: `未找到与「${keyword}」相关的药品（已自动扩展索引，覆盖 ${idx.c} 种药品，可再次搜索）`,
        coverage: { classifies: cov.c, drugs: idx.c },
      })
    }
    return json(res, { data: { detail, candidates } })
  }

  // POST /api/drugs/build-index → 触发索引构建
  if (pathname === '/api/drugs/build-index' && req.method === 'POST') {
    const sess = requireAuth(req, res)
    if (!sess) return
    if (!drugApi.getConfig().hasAppCode) {
      return json(res, { error: '服务端未配置万维易源 AppCode' }, 500)
    }
    // 不阻塞响应，后台构建
    drugApi.buildIndex(db).then(r => {
      console.log('[Drugs] build-index:', r.message, '| total:', r.total || 0)
    }).catch(e => console.error('[Drugs] build-index error:', e.message))
    return json(res, { ok: true, message: '索引构建已启动' })
  }

  // GET /api/drugs/index-status → 索引状态
  if (pathname === '/api/drugs/index-status' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const count = db.prepare('SELECT COUNT(*) as c FROM drug_index').get().c
    return json(res, { data: { ...drugApi.getIndexState(), dbCount: count } })
  }

  // GET /api/drugs/detail?drugId=xxx → 指定药品详情
  if (pathname === '/api/drugs/detail' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const q = parseQuery(url)
    const drugId = (q.drugId || '').trim()
    if (!drugId) return json(res, { error: '缺少 drugId' }, 400)
    try {
      const detail = await drugApi.fetchDetail(drugId)
      if (!detail) return json(res, { data: null, message: '未找到该药品详情' })
      return json(res, { data: detail })
    } catch (e) {
      return json(res, { data: null, message: e.message }, 502)
    }
  }

  // ====== RELATIONS（关系梳理 · 服务器端存储） ======
  // GET /api/relations → 当前用户全量数据 { family, friendship, love }
  if (pathname === '/api/relations' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const people = db.prepare(
      'SELECT * FROM relations WHERE user_id = ? ORDER BY created_at'
    ).all(sess.user_id)
    const diaries = db.prepare(
      'SELECT d.*, di.path as image_path FROM relation_diaries d LEFT JOIN diary_images di ON di.diary_id = d.id ORDER BY d.created_at'
    ).all()
    const byDiary = {}
    for (const row of db.prepare('SELECT diary_id, path FROM diary_images').all()) {
      ;(byDiary[row.diary_id] ||= []).push(row.path)
    }
    const data = { family: [], friendship: [], love: [] }
    for (const p of people) {
      const pDiaries = diaries.filter((d) => d.person_id === p.id).map((d) => ({
        id: d.id, content: d.content, date: d.date, images: byDiary[d.id] || [],
      }))
      data[p.category].push({
        id: p.id, name: p.name, avatar: p.avatar, relationship: p.relationship,
        birthday: p.birthday, phone: p.phone, notes: p.notes, review: p.review,
        diary: pDiaries, lastBirthdayGreeted: p.last_birthday_greeted,
      })
    }
    return json(res, { data })
  }

  // PUT /api/relations → 全量同步（事务替换当前用户数据，清理孤儿记录与图片文件）
  if (pathname === '/api/relations' && req.method === 'PUT') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const body = await parseBody(req)
    const input = body.data || {}
    const tx = db.transaction(() => {
      // 收集旧图片路径（删除后清理磁盘文件）
      const oldImages = (db.prepare(
        'SELECT path FROM diary_images WHERE diary_id IN (SELECT id FROM relation_diaries WHERE person_id IN (SELECT id FROM relations WHERE user_id = ?))'
      ).all(sess.user_id)).map((r) => r.path)
      db.prepare('DELETE FROM relations WHERE user_id = ?').run(sess.user_id)
      const insertPerson = db.prepare(
        `INSERT INTO relations (id, user_id, category, name, avatar, relationship, birthday, phone, notes, review, last_birthday_greeted)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      )
      const insertDiary = db.prepare(
        'INSERT INTO relation_diaries (id, person_id, content, date) VALUES (?,?,?,?)'
      )
      const insertImage = db.prepare(
        'INSERT INTO diary_images (id, diary_id, path) VALUES (?,?,?)'
      )
      const usedPaths = new Set()
      for (const cat of ['family', 'friendship', 'love']) {
        for (const p of input[cat] || []) {
          const pid = p.id || `r_${crypto.randomUUID()}`
          insertPerson.run(pid, sess.user_id, cat, p.name || '', p.avatar || '👤', p.relationship || '',
            p.birthday || '', p.phone || '', p.notes || '', p.review || '', p.lastBirthdayGreeted || '')
          for (const d of p.diary || []) {
            const did = d.id || `d_${crypto.randomUUID()}`
            insertDiary.run(did, pid, d.content || '', d.date || new Date().toISOString().slice(0, 10))
            for (const img of d.images || []) {
              if (typeof img === 'string' && img.startsWith('/uploads/')) {
                insertImage.run(`i_${crypto.randomUUID()}`, did, img)
                usedPaths.add(img)
              }
            }
          }
        }
      }
      return { oldImages, usedPaths }
    })
    const { oldImages, usedPaths } = tx()
    // 清理不再引用的图片文件
    for (const img of oldImages) {
      if (!usedPaths.has(img)) {
        const file = path.join(UPLOAD_DIR, path.basename(img))
        try { fs.unlinkSync(file) } catch { /* 文件可能已不存在 */ }
      }
    }
    return json(res, { ok: true })
  }

  // POST /api/upload → base64 图片落盘 uploads/，返回访问路径
  if (pathname === '/api/upload' && req.method === 'POST') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const { data, name } = await parseBody(req)
    if (!data || typeof data !== 'string') return json(res, { error: '缺少图片数据' }, 400)
    const m = data.match(/^data:(image\/[\w+-.]+);base64,(.+)$/)
    if (!m) return json(res, { error: '图片格式不正确' }, 400)
    const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
    const ext = extMap[m[1]] || 'jpg'
    const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`
    try {
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(m[2], 'base64'))
    } catch (e) {
      return json(res, { error: '图片保存失败' }, 500)
    }
    return json(res, { data: { path: `/uploads/${filename}`, name: name || '' } }, 201)
  }

  // GET /uploads/:file → 静态服务上传图片
  const uploadMatch = pathname.match(/^\/uploads\/([\w.-]+)$/)
  if (uploadMatch && req.method === 'GET') {
    const file = path.join(UPLOAD_DIR, uploadMatch[1])
    try {
      const buf = fs.readFileSync(file)
      const ext = path.extname(file).toLowerCase()
      const typeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }
      res.writeHead(200, {
        'Content-Type': typeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      })
      res.end(buf)
    } catch {
      json(res, { error: 'Not found' }, 404)
    }
    return
  }

  // ====== PLANS（我的计划 · 服务器端存储） ======
  // GET /api/plans → 当前用户全部计划 { "2026-08-05": { tasks, notes }, ... }
  if (pathname === '/api/plans' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const rows = db.prepare('SELECT date, tasks, notes FROM plans WHERE user_id = ?').all(sess.user_id)
    const data = {}
    for (const r of rows) {
      data[r.date] = { tasks: JSON.parse(r.tasks || '[]'), notes: r.notes || '' }
    }
    return json(res, { data })
  }

  // PUT /api/plans/:date → upsert 某天计划
  const plansMatch = pathname.match(/^\/api\/plans\/([\d-]{10})$/)
  if (plansMatch && req.method === 'PUT') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const { tasks, notes } = await parseBody(req)
    const tasksJson = JSON.stringify(Array.isArray(tasks) ? tasks : [])
    const notesStr = typeof notes === 'string' ? notes : ''
    db.prepare(
      `INSERT INTO plans (user_id, date, tasks, notes, updated_at) VALUES (?,?,?,?,datetime('now'))
       ON CONFLICT(user_id, date) DO UPDATE SET tasks = excluded.tasks, notes = excluded.notes, updated_at = datetime('now')`
    ).run(sess.user_id, plansMatch[1], tasksJson, notesStr)
    return json(res, { ok: true })
  }

  // ====== KALIMBA（拇指琴 · 服务器端存储） ======
  // GET /api/kalimba → { streak, lastDate, totalTime, achievements }
  if (pathname === '/api/kalimba' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const row = db.prepare('SELECT * FROM kalimba_stats WHERE user_id = ?').get(sess.user_id)
    if (!row) return json(res, { data: { streak: 0, lastDate: '', totalTime: 0, achievements: [] } })
    return json(res, {
      data: {
        streak: row.streak || 0,
        lastDate: row.last_date || '',
        totalTime: row.total_time || 0,
        achievements: JSON.parse(row.achievements || '[]'),
      },
    })
  }

  // PUT /api/kalimba → upsert 统计
  if (pathname === '/api/kalimba' && req.method === 'PUT') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const { streak, lastDate, totalTime, achievements } = await parseBody(req)
    const achJson = JSON.stringify(Array.isArray(achievements) ? achievements : [])
    db.prepare(
      `INSERT INTO kalimba_stats (user_id, streak, last_date, total_time, achievements, updated_at)
       VALUES (?,?,?,?,?,datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         streak = excluded.streak, last_date = excluded.last_date,
         total_time = excluded.total_time, achievements = excluded.achievements,
         updated_at = datetime('now')`
    ).run(sess.user_id, Number(streak) || 0, lastDate || '', Number(totalTime) || 0, achJson)
    return json(res, { ok: true })
  }

  // ====== FAVORITES（药品收藏 · 服务器端快照） ======
  // GET /api/favorites → 收藏列表
  if (pathname === '/api/favorites' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const rows = db.prepare(
      'SELECT drug_id, drug_name, manu, spec, detail, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC'
    ).all(sess.user_id)
    return json(res, {
      data: rows.map((r) => ({ drug_id: r.drug_id, drug_name: r.drug_name, manu: r.manu, spec: r.spec, detail: JSON.parse(r.detail), created_at: r.created_at })),
    })
  }

  // POST /api/favorites → 收藏（存完整详情快照）
  if (pathname === '/api/favorites' && req.method === 'POST') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const { drug_id, detail } = await parseBody(req)
    if (!drug_id || typeof drug_id !== 'string') return json(res, { error: '缺少 drug_id' }, 400)
    if (!detail || typeof detail !== 'object') return json(res, { error: '缺少药品详情' }, 400)
    db.prepare(
      `INSERT INTO favorites (id, user_id, drug_id, drug_name, manu, spec, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, drug_id) DO UPDATE SET detail = excluded.detail`
    ).run(
      `f_${crypto.randomUUID()}`,
      sess.user_id,
      drug_id,
      detail.name || drug_id,
      detail.manu || '',
      detail.spec || '',
      JSON.stringify(detail),
    )
    return json(res, { ok: true }, 201)
  }

  // DELETE /api/favorites/:drugId → 取消收藏
  const favMatch = pathname.match(/^\/api\/favorites\/([^/]+)$/)
  if (favMatch && req.method === 'DELETE') {
    const sess = requireAuth(req, res)
    if (!sess) return
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND drug_id = ?').run(sess.user_id, decodeURIComponent(favMatch[1]))
    return json(res, { ok: true })
  }

  // ====== DRUG MODULES（药品自定义模块 · 服务器端存储） ======
  // GET /api/drugs/modules → 当前用户全部模块 { drug_id: [{id,title,content}] }
  if (pathname === '/api/drugs/modules' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const rows = db.prepare(
      'SELECT id, drug_id, title, content FROM drug_modules WHERE user_id = ? ORDER BY sort, created_at'
    ).all(sess.user_id)
    const data = {}
    for (const r of rows) {
      ;(data[r.drug_id] ||= []).push({ id: r.id, title: r.title, content: r.content })
    }
    return json(res, { data })
  }

  // POST /api/drugs/modules → 新增模块
  if (pathname === '/api/drugs/modules' && req.method === 'POST') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const { drug_id, title, content } = await parseBody(req)
    if (!drug_id || typeof drug_id !== 'string') return json(res, { error: '缺少 drug_id' }, 400)
    const titleStr = (typeof title === 'string' ? title : '').trim()
    if (!titleStr) return json(res, { error: '请填写模块标题' }, 400)
    const contentStr = (typeof content === 'string' ? content : '').trim()
    const id = `m_${crypto.randomUUID()}`
    db.prepare(
      'INSERT INTO drug_modules (id, user_id, drug_id, title, content, sort) VALUES (?,?,?,?,?,?)'
    ).run(id, sess.user_id, drug_id, titleStr, contentStr, Date.now())
    return json(res, { data: { id, title: titleStr, content: contentStr } }, 201)
  }

  // PUT /api/drugs/modules/:id → 更新模块
  const moduleMatch = pathname.match(/^\/api\/drugs\/modules\/([^/]+)$/)
  if (moduleMatch && req.method === 'PUT') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const { title, content } = await parseBody(req)
    const titleStr = (typeof title === 'string' ? title : '').trim()
    if (!titleStr) return json(res, { error: '请填写模块标题' }, 400)
    const contentStr = (typeof content === 'string' ? content : '').trim()
    const r = db.prepare(
      "UPDATE drug_modules SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    ).run(titleStr, contentStr, decodeURIComponent(moduleMatch[1]), sess.user_id)
    if (r.changes === 0) return json(res, { error: '模块不存在' }, 404)
    return json(res, { ok: true })
  }

  // DELETE /api/drugs/modules/:id → 删除模块
  if (moduleMatch && req.method === 'DELETE') {
    const sess = requireAuth(req, res)
    if (!sess) return
    db.prepare('DELETE FROM drug_modules WHERE id = ? AND user_id = ?').run(decodeURIComponent(moduleMatch[1]), sess.user_id)
    return json(res, { ok: true })
  }

  // ====== STATS ======
  if (pathname === '/api/stats' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    return json(res, {
      drugCount: db.prepare('SELECT COUNT(*) as c FROM drug_index').get().c,
    })
  }

  // Fallback: serve static files (SPA)
  if (serveStatic(req, res)) return

  // SPA fallback
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
  try {
    const html = fs.readFileSync(indexPath)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  } catch {
    json(res, { error: 'Not found' }, 404)
  }
}

// ============================================================
// Global error handler
// ============================================================
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message)
  console.error(err.stack)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason)
})

// ============================================================
// Start server
// ============================================================
const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res)
  } catch (err) {
    console.error('[ERROR]', err.message)
    json(res, { error: '服务器内部错误' }, 500)
  }
})

server.listen(PORT, () => {
  console.log(`[Server] 工作台后端已启动: http://localhost:${PORT}`)
  console.log(`[Server] 环境: ${NODE_ENV}`)
  console.log(`[Server] CORS 白名单: ${CORS_ORIGINS.join(', ')}`)
})
