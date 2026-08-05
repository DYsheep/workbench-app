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

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    member_count INTEGER DEFAULT 1,
    file_count INTEGER DEFAULT 0,
    color TEXT DEFAULT 'indigo',
    owner_id TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'file',
    size TEXT DEFAULT '0 KB',
    workspace_id TEXT REFERENCES workspaces(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`)
// 万维易源药品 API 索引表
const drugApi = require('./drugs')
drugApi.ensureIndexTable(db)

// 清理废弃的 drug_cache 表（旧版 mock 缓存，搜索已走 drug_index）
try {
  db.exec('DROP TABLE IF EXISTS drug_cache')
  console.log('[DB] Dropped legacy drug_cache table')
} catch (e) {
  console.error('[DB] Drop drug_cache failed:', e.message)
}

// ============================================================
// Session 过期清理（TTL 7 天）
// 惰性：requireAuth 校验时顺手删过期会话
// 周期：启动时 + 每 6 小时批量清理
// ============================================================
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 天

function cleanupExpiredSessions() {
  try {
    const cutoff = new Date(Date.now() - SESSION_TTL_MS).toISOString()
    const r = db.prepare('DELETE FROM sessions WHERE created_at < ?').run(cutoff)
    if (r.changes > 0) console.log(`[Session] 清理过期会话 ${r.changes} 个`)
  } catch (e) {
    console.error('[Session] cleanup failed:', e.message)
  }
}

function sessionIsExpired(row) {
  if (!row || !row.created_at) return true
  return Date.now() - new Date(row.created_at).getTime() > SESSION_TTL_MS
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

  const insertWs = db.prepare(
    'INSERT INTO workspaces (id, name, description, member_count, file_count, color, owner_id) VALUES (?,?,?,?,?,?,?)'
  )
  insertWs.run('w1', '会议室改造项目', '236、412、419等会议室智能化升级方案', 4, 16, 'indigo', 'u1')
  insertWs.run('w2', '网络安全运维', '防火墙策略与邮件系统日常管理', 3, 32, 'emerald', 'u1')
  insertWs.run('w3', '文档处理外包', '2022-2025年供应商管理与竞品分析', 5, 24, 'amber', 'u1')
  insertWs.run('w4', '摄影作品管理', '个人摄影网站开发与相册管理', 1, 8, 'rose', 'u1')
  insertWs.run('w5', 'SillyTavern 学习', 'AI 角色扮演聊天工具部署与使用', 1, 3, 'violet', 'u1')

  const insertFile = db.prepare('INSERT INTO files (id, name, type, size, workspace_id) VALUES (?,?,?,?,?)')
  insertFile.run('f1', '会议室改造设备清单.xlsx', 'xlsx', '245 KB', 'w1')
  insertFile.run('f2', '网络安全巡检报告.docx', 'docx', '1.2 MB', 'w2')
  insertFile.run('f3', '供应商评估表.xlsx', 'xlsx', '890 KB', 'w3')
  insertFile.run('f4', '摄影相册数据库设计.md', 'md', '12 KB', 'w4')
  insertFile.run('f5', 'SillyTavern 配置指南.pdf', 'pdf', '3.5 MB', 'w5')
  insertFile.run('f6', '邮件服务器排查记录.txt', 'txt', '8 KB', 'w2')
  insertFile.run('f7', '竞品分析-科大讯飞.docx', 'docx', '560 KB', 'w3')
  insertFile.run('f8', '工作台架构设计方案.md', 'md', '34 KB', 'w3')

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
  const row = db.prepare('SELECT user_id, created_at FROM sessions WHERE id = ?').get(sessionId)
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

    const { username, password } = await parseBody(req)
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

    const sessionId = generateId()
    db.prepare('INSERT INTO sessions (id, user_id) VALUES (?,?)').run(sessionId, user.id)

    const secure = NODE_ENV === 'production' ? '; Secure' : ''
    res.setHeader('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax${secure}`)
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

  // ====== WORKSPACES ======
  if (pathname === '/api/workspaces' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const rows = db.prepare('SELECT * FROM workspaces ORDER BY updated_at DESC').all()
    return json(res, { data: rows })
  }

  if (pathname === '/api/workspaces' && req.method === 'POST') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const { name, description } = await parseBody(req)
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return json(res, { error: '名称不能为空' }, 400)
    }
    const id = generateId()
    const color = ['indigo','emerald','amber','rose','violet'][Math.floor(Math.random()*5)]
    db.prepare('INSERT INTO workspaces (id,name,description,color,owner_id) VALUES (?,?,?,?,?)')
      .run(id, name.trim(), (description||'').trim(), color, sess.user_id)
    const ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id)
    return json(res, { data: ws }, 201)
  }

  if (pathname.startsWith('/api/workspaces/') && req.method === 'DELETE') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const wsId = pathname.split('/')[3]
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(wsId)
    return json(res, { ok: true })
  }

  if (pathname.startsWith('/api/workspaces/') && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const wsId = pathname.split('/')[3]
    const ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(wsId)
    if (!ws) return json(res, { error: '未找到' }, 404)
    const files = db.prepare('SELECT * FROM files WHERE workspace_id = ?').all(wsId)
    return json(res, { data: { ...ws, files } })
  }

  // ====== FILES ======
  if (pathname === '/api/files' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const q = parseQuery(url)
    let rows
    if (q.search && typeof q.search === 'string') {
      rows = db.prepare('SELECT * FROM files WHERE name LIKE ?').all(`%${q.search}%`)
    } else {
      rows = db.prepare('SELECT * FROM files ORDER BY updated_at DESC').all()
    }
    return json(res, { data: rows })
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
    let candidates = drugApi.searchIndex(db, keyword, 600)

    // 索引未命中 → 按需补齐（深挖全库分类）
    let detail = null
    if (candidates.length) {
      detail = await drugApi.fetchDetail(candidates[0].drug_id)
    } else {
      try {
        const drugId = await drugApi.deepSearch(db, keyword)
        if (drugId) {
          candidates = drugApi.searchIndex(db, keyword, 600)
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

  // ====== STATS ======
  if (pathname === '/api/stats' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    return json(res, {
      wsCount: db.prepare('SELECT COUNT(*) as c FROM workspaces').get().c,
      fileCount: db.prepare('SELECT COUNT(*) as c FROM files').get().c,
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
