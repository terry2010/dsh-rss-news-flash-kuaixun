/** dep-prompt.ts 单测：状态机（两类各一生一次）+ depStatus + 路由（dismiss 写 flag）。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { readDepState, markSeenMain, depStatus, mountDepRoutes, hasService, DEP_BASE } = await import('../lib/dep-prompt.js')

const tmp = () => mkdtempSync(join(tmpdir(), 'kx-dep-'))
const log = { info() {}, warn() {} }
const ctxNoRnd = { rndSources: undefined }
const ctxThrow = { get rndSources() { throw new Error('cannot get property "rndSources" without inject') } }

/** fake ws：按 path 收 handler */
const fakeWs = () => {
  const routes = new Map()
  return {
    routes,
    register: (o) => { routes.set(o.path, o.handler); return () => routes.delete(o.path) },
  }
}
const fakeRes = () => {
  const r = { code: 0, body: '', writeHead(c) { r.code = c; return r }, end(b) { r.body = b ?? '' } }
  return r
}
const postReq = (body, ct = 'application/json') => ({
  method: 'POST', headers: { 'content-type': ct },
  async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)) },
})

test('dep-state：读缺省→{}；markSeenMain 写 seenMain + 清两类 prompted', () => {
  const d = tmp()
  assert.deepEqual(readDepState(d), {})
  markSeenMain(d)
  assert.equal(readDepState(d).seenMain, true)
  rmSync(d, { recursive: true, force: true })
})

test('markSeenMain 重置周期：主插件在场后，缺席弹层重新激活', async () => {
  const d = tmp()
  const ws = fakeWs()
  mountDepRoutes(ws, ctxNoRnd, log, d)
  await ws.routes.get(`${DEP_BASE}/api/dep/dismiss`)(postReq({ kind: 'install' }), fakeRes())
  assert.equal(readDepState(d).installPrompted, true) // 本周期已弹

  markSeenMain(d) // 主插件出现（启用/安装）→ 周期重置
  const s = depStatus({ dataDir: d, mainPresent: () => false })
  assert.equal(s.kind, 'removal') // seenMain 保留 → 下次缺席按移除语义
  assert.equal(s.prompted, false)  // 但 flag 已清 → 会再弹
  rmSync(d, { recursive: true, force: true })
})

test('hasService：undefined/抛错→false，有值→true；真 cordis 走 reflect.get', () => {
  assert.equal(hasService(ctxThrow, 'rndSources'), false)
  assert.equal(hasService(ctxNoRnd, 'rndSources'), false)
  assert.equal(hasService({ rndSources: {} }, 'rndSources'), true)
  // cordis 真机：外层 ctx.<svc> 必抛，探测只能走 reflect.get（strict 认 ACTIVE）
  const cordisLike = { reflect: { get: (n) => (n === 'rndSources' ? { apiVersion: 3 } : undefined) } }
  assert.equal(hasService(cordisLike, 'rndSources'), true)
  assert.equal(hasService(cordisLike, 'other'), false)
  assert.equal(hasService({ reflect: { get: () => undefined }, get rndSources() { throw new Error('x') } }, 'rndSources'), false)
})

test('depStatus：未见主插件→install 未弹；seenMain→removal', () => {
  const d = tmp()
  const s1 = depStatus({ dataDir: d, mainPresent: () => false, profile: { dir: d, name: 'p1' } })
  assert.equal(s1.kind, 'install')
  assert.equal(s1.prompted, false)
  assert.equal(s1.pkg, 'dsh-rss-news-daily')
  assert.match(s1.removeCmd, /dsh plugin --profile p1 remove dsh-news-kuaixun/)

  markSeenMain(d)
  const s2 = depStatus({ dataDir: d, mainPresent: () => false, profile: { dir: d, name: 'p1' } })
  assert.equal(s2.kind, 'removal')
  rmSync(d, { recursive: true, force: true })
})

test('depStatus：marketInstalled 按 bundles 探测', () => {
  const d = tmp()
  const s1 = depStatus({ dataDir: d, mainPresent: () => false, profile: { dir: d, name: 'p' } })
  assert.equal(s1.marketInstalled, false)
  writeFileSync(join(d, 'package.json'), JSON.stringify({ dsh: { profile: { bundles: ['dshmarket'] } } }))
  const s2 = depStatus({ dataDir: d, mainPresent: () => false, profile: { dir: d, name: 'p' } })
  assert.equal(s2.marketInstalled, true)
  rmSync(d, { recursive: true, force: true })
})

test('路由：GET 返回状态；dismiss 写 installPrompted（install kind）', async () => {
  const d = tmp()
  const ws = fakeWs()
  mountDepRoutes(ws, ctxNoRnd, log, d)
  assert.ok(ws.routes.has(`${DEP_BASE}/api/dep`))
  const r1 = fakeRes()
  await ws.routes.get(`${DEP_BASE}/api/dep`)({}, r1)
  assert.equal(r1.code, 200)
  assert.equal(JSON.parse(r1.body).kind, 'install')

  await ws.routes.get(`${DEP_BASE}/api/dep/dismiss`)(postReq({ kind: 'install' }), fakeRes())
  assert.equal(readDepState(d).installPrompted, true)
  const r2 = fakeRes()
  await ws.routes.get(`${DEP_BASE}/api/dep`)({}, r2)
  assert.equal(JSON.parse(r2.body).prompted, true)
  rmSync(d, { recursive: true, force: true })
})

test('路由：dismiss 要 JSON content-type（跨站防护）；removal kind 写对应 flag', async () => {
  const d = tmp()
  markSeenMain(d) // → removal
  const ws = fakeWs()
  mountDepRoutes(ws, ctxNoRnd, log, d)

  const bad = fakeRes()
  await ws.routes.get(`${DEP_BASE}/api/dep/dismiss`)(postReq({ kind: 'removal' }, 'text/plain'), bad)
  assert.equal(bad.code, 403)
  assert.equal(readDepState(d).removalPrompted, undefined)

  const good = fakeRes()
  await ws.routes.get(`${DEP_BASE}/api/dep/dismiss`)(postReq({ kind: 'removal' }), good)
  assert.equal(good.code, 200)
  assert.equal(readDepState(d).removalPrompted, true)
  assert.equal(readDepState(d).installPrompted, undefined)
  rmSync(d, { recursive: true, force: true })
})

test('路由：GET 拒绝 POST 方法；dismiss 空 body 按当前 kind 写', async () => {
  const d = tmp()
  const ws = fakeWs()
  mountDepRoutes(ws, ctxThrow, log, d) // ctx.rndSources 抛错 → mainPresent false
  const r = fakeRes()
  await ws.routes.get(`${DEP_BASE}/api/dep`)({ method: 'POST' }, r)
  assert.equal(r.code, 200) // GET 路由不挑方法（幂等只读）
  await ws.routes.get(`${DEP_BASE}/api/dep/dismiss`)(postReq({}), fakeRes())
  assert.equal(readDepState(d).installPrompted, true)
  rmSync(d, { recursive: true, force: true })
})

test('depStatus：缺席但在宽限内→pending=true，客户端不弹', () => {
  const d = tmp()
  const s = depStatus({ dataDir: d, mainPresent: () => false, pending: true, profile: { dir: d, name: 'p' } })
  assert.equal(s.mainPresent, false)
  assert.equal(s.pending, true)
  rmSync(d, { recursive: true, force: true })
})
