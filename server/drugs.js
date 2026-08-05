// ============================================================
// 门诊用药 - 万维易源药品 API 模块
//
// 接口链路（阿里云市场网关，AppCode 认证）：
//   GET /classify                 → 714 个小分类（34 大分类）
//   GET /drugInfo?classifyId=X    → 分类下药品列表（drugId/drugName/pzwh）
//   GET /drugDetail?searchType=4&searchKey=drugId → 药品完整详情（35 字段）
//
// 策略：
//   1. 后台懒加载建立"药名→drugId"本地索引（SQLite drug_index 表）
//   2. 搜索先查本地索引，命中后调 drugDetail 拿详情
//   3. 索引未命中可触发增量构建（遍历分类拉列表）
// ============================================================

const path = require('path')

const APPCODE = process.env.WANWEI_APPCODE || ''
const API_BASE = process.env.WANWEI_API_BASE || 'http://drug.market.alicloudapi.com'

// 索引深度：每个小分类拉多少页（每页20条）
// - 第1版只拉1页（20条/分类）→ 覆盖5459药，利培酮等在分类第6页的药全部漏掉
// - 现在拉到10页（200条/分类）→ 绝大多数分类可全覆盖（专科分类通常<200药）
//   成本约 714分类×10页 ≈ 7140 次调用（约7元），可在 .env 用 WANWEI_INDEX_PAGES 覆盖
const INDEX_PAGES_PER_CLASSIFY = parseInt(process.env.WANWEI_INDEX_PAGES || '10', 10)
const INDEX_CONCURRENCY = 8          // 建索引并发数

let indexState = {
  building: false,
  total: 0,          // 累计已入库药品数
  builtClassifies: 0, // 已处理分类数
  totalClassifies: 0,
  lastBuildAt: null,
  error: '',
}

// ============================================================
// 分类 count 缓存（classify_counts.json）
// 深挖的"地图"：存 714 个分类各自的药品总数，用于过滤已全量分类 + 广度优先排序。
// 自动保鲜：buildIndex / deepSearch 拉 /drugInfo 时响应自带 count，顺手写回。
// ============================================================
let countCache = null // 惰性加载
const COUNT_CACHE_PATH = path.join(__dirname, '..', 'classify_counts.json')

function loadCountCache() {
  if (countCache) return countCache
  try {
    const fs = require('fs')
    countCache = fs.existsSync(COUNT_CACHE_PATH)
      ? JSON.parse(fs.readFileSync(COUNT_CACHE_PATH, 'utf8'))
      : {}
  } catch {
    countCache = {}
  }
  return countCache
}

function saveCountCache() {
  try {
    const fs = require('fs')
    fs.writeFileSync(COUNT_CACHE_PATH, JSON.stringify(loadCountCache()), 'utf8')
  } catch (e) {
    console.error('[Drugs] save count cache failed:', e.message)
  }
}

// 更新单个分类的 count（来自 /drugInfo 响应的 count 字段）
function updateCountCache(classifyId, count) {
  const n = Number(count)
  if (n > 0) {
    loadCountCache()[classifyId] = n
  }
}

// ============================================================
// HTTP helper
// ============================================================
function callApi(path, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const url = `${API_BASE}${path}${qs ? '?' + qs : ''}`
  return fetch(url, {
    headers: { Authorization: `APPCODE ${APPCODE}` },
  }).then(r => r.json()).then(d => {
    const body = d && d.showapi_res_body
    if (!body || body.ret_code !== '0') {
      const err = new Error((body && body.msg) || 'API 调用失败')
      err.code = body && body.ret_code
      throw err
    }
    return body
  }).catch(e => {
    if (e.code !== undefined) throw e
    throw new Error('无法连接万维易源 API，请检查网络或 AppCode 配置')
  })
}

// ============================================================
// Index building
// ============================================================
function ensureIndexTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS drug_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_name TEXT NOT NULL,
      drug_id TEXT NOT NULL,
      classify_id TEXT NOT NULL,
      classify_name TEXT DEFAULT '',
      manu TEXT DEFAULT '',
      pzwh TEXT DEFAULT '',
      UNIQUE(drug_id)
    );
    CREATE INDEX IF NOT EXISTS idx_drug_index_name ON drug_index(drug_name);
    -- 索引覆盖进度：每个分类已索引到第几页（渐进式深挖的依据）
    CREATE TABLE IF NOT EXISTS drug_index_coverage (
      classify_id TEXT PRIMARY KEY,
      covered_pages INTEGER DEFAULT 0
    );
  `)
}

async function buildIndex(db) {
  if (indexState.building) return { ok: false, message: '索引构建中，请稍候' }

  // 1. 拉全量分类
  let classifies
  try {
    const body = await callApi('/classify')
    classifies = body.data || []
  } catch (e) {
    indexState.error = e.message
    return { ok: false, message: `获取分类失败：${e.message}` }
  }

  indexState.building = true
  indexState.totalClassifies = classifies.length
  indexState.builtClassifies = 0
  indexState.total = 0
  indexState.error = ''

  // 2. 清空旧索引（重建）
  db.prepare('DELETE FROM drug_index').run()
  db.prepare('DELETE FROM drug_index_coverage').run()

  // 3. 并发拉取每个分类的药品列表
  let cursor = 0
  const setCov = db.prepare('INSERT OR REPLACE INTO drug_index_coverage (classify_id, covered_pages) VALUES (?,?)')
  const worker = async () => {
    while (cursor < classifies.length) {
      const c = classifies[cursor++]
      try {
        const pages = []
        let covered = 0
        for (let p = 1; p <= INDEX_PAGES_PER_CLASSIFY; p++) {
          const body = await callApi('/drugInfo', { classifyId: c.classifyId, page: p })
          const list = body.data || []
          pages.push(...list)
          covered = p
          // 自动重扫 count 缓存：响应自带分类药品总数，顺手写回
          if (body.count) updateCountCache(c.classifyId, body.count)
          if (list.length < (body.maxResult || 20)) break
        }
        const insert = db.prepare(
          'INSERT OR IGNORE INTO drug_index (drug_name, drug_id, classify_id, classify_name, manu, pzwh) VALUES (?,?,?,?,?,?)'
        )
        for (const d of pages) {
          if (d.drugName && d.drugId) {
            insert.run(d.drugName, d.drugId, c.classifyId, c.classify, d.manu || '', d.pzwh || '')
            indexState.total++
          }
        }
        if (covered > 0) setCov.run(c.classifyId, covered)
      } catch (e) {
        // 单个分类失败不中断
      } finally {
        indexState.builtClassifies++
      }
    }
  }

  const workers = Array.from({ length: INDEX_CONCURRENCY }, worker)
  await Promise.all(workers)
  // 构建完成：落盘刷新后的 count 缓存（分类体系变动时自动对齐）
  saveCountCache()
  indexState.building = false
  indexState.lastBuildAt = new Date().toISOString()
  return { ok: true, message: '索引构建完成', total: indexState.total }
}

// ============================================================
// Search & Detail
// ============================================================
// 剂型后缀：搜索时去掉，实现"剂型模糊匹配"
// 例："头孢丙烯胶囊" → 核心词"头孢丙烯"，可匹配"头孢丙烯片/颗粒/分散片"
const FORM_SUFFIX = /(胶囊剂|胶囊|软胶囊|片剂|缓释片|肠溶片|分散片|咀嚼片|泡腾片|素片|片|颗粒剂|颗粒|口服溶液|口服液|混悬液|糖浆|滴剂|滴丸|滴眼液|注射液|注射用|粉针|喷剂|气雾剂|乳膏|软膏|凝胶|贴剂|栓剂|栓|散剂|丸剂|丸|溶液|注射剂|口服散)$/

// 提取核心关键词：忽略厂家名/剂型等前后缀，取最长的连续中文片段再去剂型后缀
// 例："龙昌药业 感冒退热颗粒" → "感冒退热"；"头孢丙烯胶囊" → "头孢丙烯"
function extractCoreKeyword(keyword) {
  const kw = String(keyword || '').trim()
  const fragments = kw.match(/[\u4e00-\u9fa5]{2,}/g)
  let core = fragments && fragments.length ? fragments.sort((a, b) => b.length - a.length)[0] : kw
  core = core.replace(FORM_SUFFIX, '')
  return core || kw
}

// 返回全部同名候选（核心词已保证 ≥2 中文字符，匹配量可控）
function searchIndex(db, keyword) {
  const core = extractCoreKeyword(keyword)
  return db.prepare(
    `SELECT drug_id, drug_name, manu, pzwh, classify_name
     FROM drug_index WHERE drug_name LIKE ? ORDER BY drug_name`
  ).all(`%${core}%`)
}

// 药品详情 → 前端统一结构
function mapDetail(item) {
  const splitList = (s) => {
    if (!s) return []
    return String(s).split(/[；;。\n]+/).map(x => x.trim()).filter(Boolean)
  }
  const specialGroups = []
  if (item.yfjbrqfnyy) specialGroups.push({ group: '孕妇/哺乳期', advice: String(item.yfjbrqfnyy) })
  if (item.yfyy && !item.yfjbrqfnyy) specialGroups.push({ group: '孕妇', advice: String(item.yfyy) })
  if (item.etyy) specialGroups.push({ group: '儿童', advice: String(item.etyy) })
  if (item.lryy) specialGroups.push({ group: '老年', advice: String(item.lryy) })

  return {
    id: item.drugId || '',
    name: item.drugName || item.spmc || '',
    genericName: item.tymc || '',
    category: item.fl || (item.type && item.type[0] && item.type[0].type2) || '',
    manu: item.manu || '',
    pzwh: item.pzwh || '',
    spec: item.gg || '',
    indications: splitList(item.syz),
    dosage: item.yfyl || '',
    maxDose: '', // 数据源无结构化字段，从用法用量中提取常用表述
    adverseReactions: splitList(item.blfy),
    contraindications: splitList(item.jj),
    specialGroups,
    note: item.zysx || item.ywxhzy || '',
  }
}

async function fetchDetail(drugId) {
  const body = await callApi('/drugDetail', { searchType: '4', searchKey: drugId })
  const list = body.drugList || []
  if (!list.length) return null
  return mapDetail(list[0])
}

// ============================================================
// 按需补齐（Deep Search）— 渐进式索引积累
// 本地索引未命中时触发：并发翻查"尚未覆盖"的分类页。
// 核心设计（可扩展）：
//   - 每分类记录已覆盖页数（drug_index_coverage 表），只翻未覆盖的新页
//   - 翻过的页整页入库（索引随每次搜索持续增长，多次深挖自然铺满全库 ≈ 全量索引）
//   - 找到目标药即全局停止；预算耗尽返回 null（本次翻页仍已积累索引）
// ============================================================
const DEEP_SEARCH_BUDGET = parseInt(process.env.WANWEI_DEEP_BUDGET || '400', 10)
const DEEP_SEARCH_CONCURRENCY = 5
const DEEP_MAX_PAGES_PER_CLASSIFY = parseInt(process.env.WANWEI_DEEP_PAGES || '30', 10)

async function deepSearch(db, keyword, budget = DEEP_SEARCH_BUDGET) {
  const core = extractCoreKeyword(keyword)
  let classifies
  try {
    classifies = (await callApi('/classify')).data || []
  } catch {
    return null
  }

  const getCov = db.prepare('SELECT covered_pages FROM drug_index_coverage WHERE classify_id = ?')
  const setCov = db.prepare('INSERT OR REPLACE INTO drug_index_coverage (classify_id, covered_pages) VALUES (?,?)')

  // 分类选择策略（保证广度优先，避免重复加深前排分类）：
  // 1. 用 count 缓存计算每分类总页数，过滤掉已全量覆盖的分类
  // 2. 按"覆盖比例最低"排序 → 每次深挖铺开新分类，多轮后自然覆盖全库
  // 3. count 缓存缺失/为空时不做过滤排序（降级为按原始顺序翻全部），保证深挖可用
  const counts = loadCountCache()
  let useMap = false
  try {
    useMap = Object.keys(counts).length > 0
  } catch {}
  if (useMap) {
    classifies = classifies.filter(c => {
      const total = counts[c.classifyId] || 0
      if (total === 0) return false
      const covered = (getCov.get(c.classifyId) || {}).covered_pages || 0
      return covered < Math.ceil(total / 20) // 未全量覆盖才需要翻
    })
    classifies.sort((a, b) => {
      const ratioA = ((getCov.get(a.classifyId) || {}).covered_pages || 0) / Math.ceil((counts[a.classifyId] || 1) / 20)
      const ratioB = ((getCov.get(b.classifyId) || {}).covered_pages || 0) / Math.ceil((counts[b.classifyId] || 1) / 20)
      return ratioA - ratioB // 覆盖比例最低（翻得最少）的分类优先
    })
  }

  let found = null   // 命中的药品条目
  let used = 0       // 已用 API 调用数
  let cursor = 0     // 分类游标
  const stopped = () => found !== null || used >= budget

  const insert = db.prepare(
    'INSERT OR IGNORE INTO drug_index (drug_name, drug_id, classify_id, classify_name, manu, pzwh) VALUES (?,?,?,?,?,?)'
  )

  // 整页入库（含未命中页，积累索引）
  const insertPage = (c, list) => {
    for (const d of list) {
      if (d.drugName && d.drugId) {
        try { insert.run(d.drugName, d.drugId, c.classifyId, c.classify, d.manu || '', d.pzwh || '') } catch {}
      }
    }
  }

  const worker = async () => {
    while (!stopped() && cursor < classifies.length) {
      const c = classifies[cursor++]
      // 只翻未覆盖的新页
      const covRow = getCov.get(c.classifyId)
      let page = (covRow ? covRow.covered_pages : INDEX_PAGES_PER_CLASSIFY) + 1
      let pagesFetched = 0
      let lastCovered = page - 1
      while (!stopped()) {
        if (used >= budget || pagesFetched >= DEEP_MAX_PAGES_PER_CLASSIFY) break
        let body
        try {
          used++
          body = await callApi('/drugInfo', { classifyId: c.classifyId, page })
        } catch {
          break // 单页失败放弃该分类
        }
        const list = body.data || []
        const count = body.count || 0
        pagesFetched++
        lastCovered = page
        // 顺手刷新 count 缓存（深挖也保持"地图"新鲜）
        if (count > 0) updateCountCache(c.classifyId, count)
        // 整页入库（索引积累）
        insertPage(c, list)
        // 命中检查（药名包含核心关键词）
        const hit = list.find(d => d.drugName && d.drugName.includes(core))
        if (hit) {
          found = hit
          break
        }
        if (list.length < 20) { // 已到分类末尾，标记全量覆盖
          lastCovered = Math.ceil(count / 20)
          break
        }
        if (count > 0 && page >= Math.ceil(count / 20)) break // 已翻完
        page++
      }
      // 记录本分类覆盖进度（命中/预算耗尽时也保存已翻页数）
      if (lastCovered > (covRow ? covRow.covered_pages : 0)) {
        try { setCov.run(c.classifyId, lastCovered) } catch {}
      }
    }
  }

  const workers = Array.from({ length: DEEP_SEARCH_CONCURRENCY }, worker)
  await Promise.all(workers)
  // 深挖后落盘 count 缓存（增量保鲜，不影响返回值）
  saveCountCache()
  return found ? found.drugId : null
}

module.exports = {
  ensureIndexTable,
  buildIndex,
  searchIndex,
  fetchDetail,
  deepSearch,
  getIndexState: () => ({ ...indexState }),
  getConfig: () => ({ apiBase: API_BASE, hasAppCode: !!APPCODE }),
}
