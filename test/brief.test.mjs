/** brief.ts 单测：类型定义、供给器窗口取数、聚类去重、评分/market 映射。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { KxDb } = await import('../lib/db.js')
const { briefDef, briefItems } = await import('../lib/brief.js')
const { clusterTitles } = await import('../lib/similar.js')

const JIN10 = 'https://www.jin10.com/'
const CLS = 'https://www.cls.cn/telegraph'
const SINCE = '2026-11-17T09:00:00.000Z'
const it = (id, title, extra = {}) => ({ id, title, publishedAt: '2026-11-17T09:30:00.000Z', ...extra })

test('briefDef: 源点名 allow-list + 显示名 + 快讯骨架 prompt', () => {
  const def = briefDef([{ url: JIN10, title: '金十' }, { url: CLS, title: '财联社' }])
  assert.equal(def.id, 'kx-flash')
  assert.deepEqual(def.sourceIds, [JIN10, CLS])
  assert.deepEqual(def.sourceNames, { [JIN10]: '金十', [CLS]: '财联社' })
  assert.equal(def.itemTime, true)
  assert.match(def.prompt, /互证/)
})

test('briefItems: 窗口过滤 + 多源互证 rep 9 分 + 非 rep dupOf', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kx-brief-'))
  try {
    const db = new KxDb(dir)
    db.insert(JIN10, '金十', [it('j1', '美联储宣布降息25个基点')])
    db.insert(CLS, '财联社', [it('c1', '【财联社】美联储降息25个基点落地')])
    db.insert(JIN10, '金十', [it('j2', '英伟达财报超预期', { hot: 1 })])
    db.insert(CLS, '财联社', [it('c2', '比特币突破10万美元', { market: '加密' })])
    db.insert(JIN10, '金十', [it('j0', '旧闻一条', { publishedAt: '2026-11-17T08:00:00.000Z' })])
    const items = briefItems(db, SINCE)
    assert.equal(items.length, 4) // j0 在窗口外
    const rep = items.find((x) => x.llmScore === 9)
    assert.ok(rep && !rep.dupOf)
    assert.equal(rep.llmReason, '×2源互证')
    assert.equal(rep.dupCount, 1)
    const dup = items.find((x) => x.dupOf)
    assert.equal(dup.dupOf, rep.id)
    assert.equal(items.find((x) => x.id === 'j2').llmScore, 8)
    const btc = items.find((x) => x.id === 'c2')
    assert.equal(btc.llmScore, 6)
    assert.equal(btc.topic, '加密')
    db.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('briefItems: market 空/其他 → topic 综合', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kx-brief-'))
  try {
    const db = new KxDb(dir)
    db.insert(JIN10, '金十', [it('m1', '欧元区ZEW指数公布-14.7', { market: '其他' })])
    db.insert(JIN10, '金十', [it('m2', '香港恒生指数收涨', { market: '港股' })])
    const items = briefItems(db, SINCE)
    assert.equal(items.find((x) => x.id === 'm1').topic, '综合')
    assert.equal(items.find((x) => x.id === 'm2').topic, '港股')
    db.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('clusterTitles: 同事件并簇，异事件不并', () => {
  const cs = clusterTitles(
    [{ t: '【财联社】美联储降息25个基点' }, { t: '美联储降息25基点落地' }, { t: '比特币突破10万美元' }],
    (x) => x.t,
  )
  assert.equal(cs.length, 2)
  assert.equal(cs.find((c) => c.length === 2).length, 2)
})
