const http = require('http')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')

// ============================================================
// Database setup (in-memory fallback if better-sqlite3 fails)
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
  console.log('[DB] better-sqlite3 not available, using in-memory store:', e.message)
  db = null
}

// ============================================================
// Create tables
// ============================================================
if (db) {
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

    CREATE TABLE IF NOT EXISTS drug_cache (
      id TEXT PRIMARY KEY,
      keyword TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT DEFAULT 'mock',
      cached_at TEXT DEFAULT (datetime('now'))
    );
  `)
  console.log('[DB] Tables created')
}

// ============================================================
// Seed data
// ============================================================
if (db) {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  if (userCount === 0) {
    const insertUser = db.prepare(
      'INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
    )
    insertUser.run('u1', 'yangdh', hashPassword('123456'), '杨东浩', '管理员')

    const insertWs = db.prepare(
      'INSERT INTO workspaces (id, name, description, member_count, file_count, color, owner_id) VALUES (?,?,?,?,?,?,?)'
    )
    insertWs.run('w1', '会议室改造项目', '236、412、419等会议室智能化升级方案', 4, 16, 'indigo', 'u1')
    insertWs.run('w2', '网络安全运维', '防火墙策略与邮件系统日常管理', 3, 32, 'emerald', 'u1')
    insertWs.run('w3', '文档处理外包', '2022-2025年供应商管理与竞品分析', 5, 24, 'amber', 'u1')
    insertWs.run('w4', '摄影作品管理', '个人摄影网站开发与相册管理', 1, 8, 'rose', 'u1')
    insertWs.run('w5', 'SillyTavern 学习', 'AI 角色扮演聊天工具部署与使用', 1, 3, 'violet', 'u1')

    const insertFile = db.prepare(
      'INSERT INTO files (id, name, type, size, workspace_id) VALUES (?,?,?,?,?)'
    )
    insertFile.run('f1', '会议室改造设备清单.xlsx', 'xlsx', '245 KB', 'w1')
    insertFile.run('f2', '网络安全巡检报告.docx', 'docx', '1.2 MB', 'w2')
    insertFile.run('f3', '供应商评估表.xlsx', 'xlsx', '890 KB', 'w3')
    insertFile.run('f4', '摄影相册数据库设计.md', 'md', '12 KB', 'w4')
    insertFile.run('f5', 'SillyTavern 配置指南.pdf', 'pdf', '3.5 MB', 'w5')
    insertFile.run('f6', '邮件服务器排查记录.txt', 'txt', '8 KB', 'w2')
    insertFile.run('f7', '竞品分析-科大讯飞.docx', 'docx', '560 KB', 'w3')
    insertFile.run('f8', '工作台架构设计方案.md', 'md', '34 KB', 'w3')

    console.log('[DB] Seed data inserted')
  }
}

// ============================================================
// In-memory fallback store
// ============================================================
const memStore = {
  sessions: new Map(),
  workspaces: [
    { id:'w1', name:'会议室改造项目', description:'236、412、419等会议室智能化升级方案', member_count:4, file_count:16, color:'indigo', updated_at:'2026-08-03' },
    { id:'w2', name:'网络安全运维', description:'防火墙策略与邮件系统日常管理', member_count:3, file_count:32, color:'emerald', updated_at:'2026-08-02' },
    { id:'w3', name:'文档处理外包', description:'2022-2025年供应商管理与竞品分析', member_count:5, file_count:24, color:'amber', updated_at:'2026-07-30' },
    { id:'w4', name:'摄影作品管理', description:'个人摄影网站开发与相册管理', member_count:1, file_count:8, color:'rose', updated_at:'2026-08-01' },
    { id:'w5', name:'SillyTavern 学习', description:'AI 角色扮演聊天工具部署与使用', member_count:1, file_count:3, color:'violet', updated_at:'2026-07-28' },
  ],
  files: [
    { id:'f1', name:'会议室改造设备清单.xlsx', type:'xlsx', size:'245 KB', updated_at:'2026-08-03' },
    { id:'f2', name:'网络安全巡检报告.docx', type:'docx', size:'1.2 MB', updated_at:'2026-08-02' },
    { id:'f3', name:'供应商评估表.xlsx', type:'xlsx', size:'890 KB', updated_at:'2026-07-28' },
    { id:'f4', name:'摄影相册数据库设计.md', type:'md', size:'12 KB', updated_at:'2026-08-01' },
    { id:'f5', name:'SillyTavern 配置指南.pdf', type:'pdf', size:'3.5 MB', updated_at:'2026-07-25' },
    { id:'f6', name:'邮件服务器排查记录.txt', type:'txt', size:'8 KB', updated_at:'2026-07-30' },
    { id:'f7', name:'竞品分析-科大讯飞.docx', type:'docx', size:'560 KB', updated_at:'2026-07-20' },
    { id:'f8', name:'工作台架构设计方案.md', type:'md', size:'34 KB', updated_at:'2026-08-03' },
  ],
  drugs: new Map([
    ['阿莫西林', { title:'阿莫西林', content:'【别名】阿莫仙、再林、阿莫灵\n【外文名】Amoxicillin\n【适应症】用于敏感菌（不产β内酰胺酶菌株）所致的呼吸道感染、泌尿生殖道感染、皮肤软组织感染等。\n【用量用法】成人一次0.5g，每6-8小时一次，一日剂量不超过4g。\n【注意事项】青霉素过敏者禁用。用前需做青霉素钠皮肤试验。\n【规格】胶囊：0.25g, 0.5g' }],
    ['布洛芬', { title:'布洛芬', content:'【别名】芬必得、美林、托恩\n【外文名】Ibuprofen\n【适应症】用于缓解轻至中度疼痛如头痛、关节痛、偏头痛、牙痛、肌肉痛、神经痛、痛经。也用于普通感冒或流行性感冒引起的发热。\n【用量用法】成人一次0.2-0.4g，每4-6小时一次。成人用药最大限量一般为每日2.4g。\n【注意事项】对阿司匹林过敏的哮喘患者禁用。活动期消化道溃疡者禁用。\n【规格】缓释胶囊：0.3g；片剂：0.1g, 0.2g' }],
    ['阿奇霉素', { title:'阿奇霉素', content:'【别名】希舒美、因培康、爱米琦、瑞奇、齐诺\n【外文名】Azithromycin\n【适应症】用于敏感细菌所引起的下列感染：中耳炎、鼻窦炎、咽炎、扁桃体炎等上呼吸道感染；支气管炎、肺炎等下呼吸道感染。\n【用量用法】成人：沙眼衣原体或敏感淋球菌所致性传播疾病，仅需单次口服本品1.0g。\n【注意事项】对阿奇霉素或其他大环内酯类抗生素过敏者禁用。\n【规格】片剂（胶囊）250mg, 500mg' }],
    ['二甲双胍', { title:'二甲双胍', content:'【别名】格华止、美迪康\n【外文名】Metformin\n【适应症】用于单纯饮食控制不满意的2型糖尿病病人，尤其是肥胖和伴高胰岛素血症者。\n【用量用法】成人开始一次0.25g，一日2-3次，以后根据疗效逐渐加量，一般每日量1-1.5g。\n【注意事项】肾功能不全者禁用。需定期监测肾功能。\n【规格】片剂：0.25g, 0.5g, 0.85g' }],
    ['氯雷他定', { title:'氯雷他定', content:'【别名】开瑞坦、百为坦\n【外文名】Loratadine\n【适应症】用于缓解过敏性鼻炎有关的症状，如喷嚏、流涕、鼻痒、鼻塞以及眼部痒及烧灼感。\n【用量用法】成人及12岁以上儿童：一日1次，一次1片（10mg）。\n【注意事项】严重肝功能不全者应减低剂量。\n【规格】片剂：10mg' }],
  ]),
}

// ============================================================
// Helpers
// ============================================================
function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd + 'workbench-salt').digest('hex')
}

function generateId() {
  return crypto.randomUUID()
}

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
  if (!match) return null
  return match[1]
}

function requireAuth(req, res) {
  const sessionId = getSession(req)
  if (!sessionId) { json(res, { error:'未登录' }, 401); return null }
  if (db) {
    const row = db.prepare('SELECT user_id FROM sessions WHERE id = ?').get(sessionId)
    if (!row) { json(res, { error:'会话过期' }, 401); return null }
    return row
  } else {
    const uid = memStore.sessions.get(sessionId)
    if (!uid) { json(res, { error:'会话过期' }, 401); return null }
    return { user_id: uid }
  }
}

// ============================================================
// Static file serving (frontend build output)
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
  } catch {
    return false
  }
}

// ============================================================
// Route handler
// ============================================================
async function handleRequest(req, res) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')

  if (req.method === 'OPTIONS') {
    return json(res, { ok: true })
  }

  const url = req.url
  const pathname = url.split('?')[0]

  // ====== AUTH ======
  if (pathname === '/api/login' && req.method === 'POST') {
    const { username, password } = await parseBody(req)
    if (!username || !password || password.length < 3) {
      return json(res, { error:'用户名或密码错误' }, 401)
    }

    const sessionId = generateId()
    if (db) {
      let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
      if (!user) {
        const uid = generateId()
        db.prepare('INSERT INTO users (id, username, password_hash, name) VALUES (?,?,?,?)')
          .run(uid, username, hashPassword(password), username)
        user = { id: uid, username, name: username, role: '成员' }
      }
      db.prepare('INSERT INTO sessions (id, user_id) VALUES (?,?)').run(sessionId, user.id)
      res.setHeader('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`)
      return json(res, { user })
    } else {
      memStore.sessions.set(sessionId, username)
      res.setHeader('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`)
      return json(res, { user: { id:'u1', username, name: username, role:'管理员', avatar:'' } })
    }
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    if (db) {
      const user = db.prepare('SELECT id, username, name, role, avatar FROM users WHERE id = ?').get(sess.user_id)
      return json(res, { user })
    } else {
      return json(res, { user: { id:'u1', username:'yangdh', name:'杨东浩', role:'管理员', avatar:'' } })
    }
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const sessionId = getSession(req)
    if (sessionId) {
      if (db) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
      else memStore.sessions.delete(sessionId)
    }
    return json(res, { ok: true })
  }

  // ====== WORKSPACES ======
  if (pathname === '/api/workspaces' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    if (db) {
      const rows = db.prepare('SELECT * FROM workspaces ORDER BY updated_at DESC').all()
      return json(res, { data: rows })
    } else {
      return json(res, { data: memStore.workspaces })
    }
  }

  if (pathname === '/api/workspaces' && req.method === 'POST') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const { name, description } = await parseBody(req)
    if (!name) return json(res, { error:'名称不能为空' }, 400)
    const id = generateId()
    const color = ['indigo','emerald','amber','rose','violet'][Math.floor(Math.random()*5)]
    if (db) {
      db.prepare('INSERT INTO workspaces (id,name,description,color,owner_id) VALUES (?,?,?,?,?)')
        .run(id, name, description||'', color, sess.user_id)
      const ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id)
      return json(res, { data: ws }, 201)
    } else {
      const ws = { id, name, description:description||'', member_count:1, file_count:0, color, updated_at: new Date().toISOString().slice(0,10) }
      memStore.workspaces.unshift(ws)
      return json(res, { data: ws }, 201)
    }
  }

  if (pathname.startsWith('/api/workspaces/') && req.method === 'DELETE') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const wsId = pathname.split('/')[3]
    if (db) {
      db.prepare('DELETE FROM workspaces WHERE id = ?').run(wsId)
    } else {
      memStore.workspaces = memStore.workspaces.filter(w => w.id !== wsId)
    }
    return json(res, { ok: true })
  }

  if (pathname.startsWith('/api/workspaces/') && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const wsId = pathname.split('/')[3]
    if (db) {
      const ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(wsId)
      if (!ws) return json(res, { error:'未找到' }, 404)
      const files = db.prepare('SELECT * FROM files WHERE workspace_id = ?').all(wsId)
      return json(res, { data: { ...ws, files } })
    } else {
      const ws = memStore.workspaces.find(w => w.id === wsId)
      if (!ws) return json(res, { error:'未找到' }, 404)
      return json(res, { data: ws })
    }
  }

  // ====== FILES ======
  if (pathname === '/api/files' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const q = parseQuery(url)
    if (db) {
      let rows
      if (q.search) {
        rows = db.prepare("SELECT * FROM files WHERE name LIKE ?").all(`%${q.search}%`)
      } else {
        rows = db.prepare('SELECT * FROM files ORDER BY updated_at DESC').all()
      }
      return json(res, { data: rows })
    } else {
      let data = memStore.files
      if (q.search) {
        data = data.filter(f => f.name.toLowerCase().includes(q.search.toLowerCase()))
      }
      return json(res, { data })
    }
  }

  // ====== DRUGS ======
  if (pathname === '/api/drugs/search' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    const q = parseQuery(url)
    const keyword = q.q || ''
    if (!keyword) return json(res, { error:'请输入药品名称' }, 400)

    if (db) {
      let drug = db.prepare('SELECT * FROM drug_cache WHERE keyword = ?').get(keyword)
      if (!drug) {
        return json(res, { data: null, message:'未找到该药品（原型数据有限）' })
      }
      return json(res, { data: { title:drug.title, content:drug.content } })
    } else {
      const drug = memStore.drugs.get(keyword)
      if (!drug) return json(res, { data: null, message:'未找到该药品' })
      return json(res, { data: drug })
    }
  }

  // ====== STATS ======
  if (pathname === '/api/stats' && req.method === 'GET') {
    const sess = requireAuth(req, res)
    if (!sess) return
    if (db) {
      return json(res, {
        wsCount: db.prepare('SELECT COUNT(*) as c FROM workspaces').get().c,
        fileCount: db.prepare('SELECT COUNT(*) as c FROM files').get().c,
        drugCount: db.prepare('SELECT COUNT(*) as c FROM drug_cache').get().c,
      })
    } else {
      return json(res, { wsCount: memStore.workspaces.length, fileCount: memStore.files.length, drugCount: memStore.drugs.size })
    }
  }

  // Fallback: serve static files (SPA routing)
  if (serveStatic(req, res)) return

  // SPA fallback
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
  try {
    const html = fs.readFileSync(indexPath)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  } catch {
    json(res, { error:'Not found' }, 404)
  }
}

// ============================================================
// Start server
// ============================================================
const PORT = process.env.PORT || 3001
const server = http.createServer(handleRequest)
server.listen(PORT, () => {
  console.log(`[Server] 工作台后端已启动: http://localhost:${PORT}`)
  console.log(`[Server] 前端请访问 Vite dev server 或构建后通过本服务访问`)
})
