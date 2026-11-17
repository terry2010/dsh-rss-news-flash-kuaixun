/** ui.ts 路由单测：/api/items 查询与分页元数据、/api/alerts 读写 + CSRF 口径、sameSite 守卫、静态服务穿越防护。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { mountUi } = await import('../lib/ui.js')
const { KxDb } = await import('../lib/db.js')
const { openAlertStore } = await import('../lib/alerts.js')

const log = { info() {} }
const BASE = '/dsh-rss-news-flash-kuaixun'
const CLS = 'https://www.cls.cn/telegraph'

/** fake ws：按 path 收 handler（prefix/exact 共用一张表，本插件路由 path 均唯一） */
const mkEnv = () => {
  const dir = mkdtempSync(join(tmpdir(), 'kx-ui-'))
  const routes = new Map()
  const ws = { register: (o) => { routes.set(o.path, o.handler); return () => routes.delete(o.path) } }
  const db = new KxDb(dir)
  mountUi(ws, log, openAlertStore(dir), db)
  return { dir, routes, db }
}

const req = ({ method = 'GET', url = '/', headers = {}, body = '' } = {}) => {
  const r = { method, url, headers }
  r.on = (ev, cb) => {
    if (ev === 'data' && body) cb(Buffer.from(body))
    if (ev === 'end') queueMicrotask(cb)
    return r
  }
  return r
}

const res = () => {
  const r = { statusCode: 0, headers: {}, body: '' }
  r.setHeader = (k, v) => { r.headers[String(k).toLowerCase()] = v }
  r.end = (b) => { r.body = b == null ? '' : (Buffer.isBuffer(b) ? b.toString('utf8') : b) }
  return r
}

const call = (routes, path, rq) => {
  const rs = res()
  return routes.get(path)(rq, rs).then(() => rs)
}

test('ui: GET /api/items——条目形状 + pageSize 回显请求值（回归：曾硬编码 50）', async () => {
  const env = mkEnv()
  try {
    env.db.insert(CLS, [{
      id: 'c1', title: '美联储宣布降息', content: '正文', publishedAt: '2026-11-17T01:00:00.000Z',
      hot: true, market: '美股', tags: ['环球市场'],
    }])
    const rs = await call(env.routes, `${BASE}/api/items`, req({ url: `${BASE}/api/items?pageSize=100` }))
    const j = JSON.parse(rs.body)
    assert.equal(j.ok, true)
    assert.equal(j.total, 1)
    assert.equal(j.page, 1)
    assert.equal(j.pageSize, 100) // 回显实际生效值
    const it = j.items[0]
    assert.equal(it.title, '美联储宣布降息')
    assert.equal(it.state.hot, true)
    assert.equal(it.market, '美股')
    assert.deepEqual(it.tags, ['环球市场'])
    assert.equal(rs.headers['content-type'], 'application/json; charset=utf-8')
  } finally { env.db.close(); rmSync(env.dir, { recursive: true, force: true }) }
})

test('ui: /api/alerts——GET 默认关、POST JSON 保存生效', async () => {
  const env = mkEnv()
  try {
    const g = await call(env.routes, `${BASE}/api/alerts`, req({ url: `${BASE}/api/alerts` }))
    assert.deepEqual(JSON.parse(g.body), { keywords: [], keyword: false, important: false, multi: false })

    const p = await call(env.routes, `${BASE}/api/alerts`, req({
      method: 'POST', url: `${BASE}/api/alerts`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keyword: true, keywords: ['降息', '美联储', '降息'] }),
    }))
    assert.deepEqual(JSON.parse(p.body), { keywords: ['降息', '美联储'], keyword: true, important: false, multi: false })
  } finally { env.db.close(); rmSync(env.dir, { recursive: true, force: true }) }
})

test('ui: /api/alerts——POST 非 JSON content-type 403 且不落盘（CSRF 纵深，与 dep dismiss 同口径）', async () => {
  const env = mkEnv()
  try {
    const bad = await call(env.routes, `${BASE}/api/alerts`, req({
      method: 'POST', url: `${BASE}/api/alerts`,
      headers: { 'content-type': 'text/plain' }, // 简单请求可跨站发送——必须拒收
      body: JSON.stringify({ important: true }),
    }))
    assert.equal(bad.statusCode, 403)
    const g = await call(env.routes, `${BASE}/api/alerts`, req({ url: `${BASE}/api/alerts` }))
    assert.equal(JSON.parse(g.body).important, false) // 未生效
  } finally { env.db.close(); rmSync(env.dir, { recursive: true, force: true }) }
})

test('ui: sameSite 守卫——cross-site 403，same-origin 放行', async () => {
  const env = mkEnv()
  try {
    const cross = await call(env.routes, `${BASE}/api/items`,
      req({ url: `${BASE}/api/items`, headers: { 'sec-fetch-site': 'cross-site' } }))
    assert.equal(cross.statusCode, 403)
    const ok = await call(env.routes, `${BASE}/api/items`,
      req({ url: `${BASE}/api/items`, headers: { 'sec-fetch-site': 'same-origin' } }))
    assert.equal(ok.statusCode, 200)
  } finally { env.db.close(); rmSync(env.dir, { recursive: true, force: true }) }
})

test('ui: 静态服务——首页 200 text/html；`..` 穿越被剥离落在 web 目录内（404 不外泄源码/库文件）', async () => {
  const env = mkEnv()
  try {
    const home = await call(env.routes, `${BASE}/`, req({ url: `${BASE}/` }))
    assert.equal(home.statusCode, 200)
    assert.equal(home.headers['content-type'], 'text/html; charset=utf-8')
    assert.match(home.body, /快讯/)

    // 若穿越未被剥离，join(webDir,'../ui.js') 会命中 lib/ui.js（200 源码泄露）；剥离后查 web/ui.js 不存在 → 404
    const up = await call(env.routes, `${BASE}/web`, req({ url: `${BASE}/web/../ui.js` }))
    assert.equal(up.statusCode, 404)
  } finally { env.db.close(); rmSync(env.dir, { recursive: true, force: true }) }
})
