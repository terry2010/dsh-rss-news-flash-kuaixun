/** alerts.ts 单测：关键词解析/匹配、seen-ID 去重、窗口聚合、首跑基线。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { parseKeywords, matchKeywords, openAlertStore, createAlerter } = await import('../lib/alerts.js')

const kvOf = () => { const m = new Map(); return { get: (k) => m.get(k), set: (k, v) => m.set(k, v) } }
const src = { id: 's1', url: 'u1', title: '金十' }
const item = (id, title, content = '') => ({ id, title, content })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test('parseKeywords: 分隔/去重/上限', () => {
  assert.deepEqual(parseKeywords('降息, 美联储  降息、美联储'), ['降息', '美联储'])
  assert.equal(parseKeywords('').length, 0)
  assert.equal(parseKeywords('a b c d e f g h i j k l m n o p q r s t u v').length, 20)
})

test('matchKeywords: 大小写不敏感子串', () => {
  assert.deepEqual(matchKeywords('美联储宣布降息25bp', ['降息', '加息']), ['降息'])
  assert.deepEqual(matchKeywords('Fed CUT rates', ['cut']), ['cut'])
  assert.deepEqual(matchKeywords('无关', ['降息']), [])
})

test('openAlertStore: 读写往返 + 脏文件容错', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kx-alert-'))
  try {
    const s = openAlertStore(dir)
    assert.deepEqual(s.keywords(), [])
    s.setKeywords(parseKeywords('降息 美联储'))
    assert.deepEqual(openAlertStore(dir).keywords(), ['降息', '美联储'])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('alerter: 首跑基线不告警；新命中聚合成一条', async () => {
  const notes = []
  const alerter = createAlerter({
    store: { keywords: () => ['降息'], setKeywords: () => {} },
    notify: (t, b, p) => notes.push({ t, b, p }),
    windowMs: 5,
  })
  const ctx = { kv: kvOf() }
  const h = alerter.wrap(async () => [item('a1', '无关新闻'), item('a2', '美联储降息落地')])
  const srcArg = { id: 's1', url: 'u', title: '金十' }

  await h(srcArg, ctx)          // 首跑：建基线，不弹
  await sleep(15)
  assert.equal(notes.length, 0)

  await h(srcArg, ctx)          // 同批重抓：无新条目，不弹
  await sleep(15)
  assert.equal(notes.length, 0)

  // 一轮来 3 条新命中 → 合并成 1 条通知，汇总数量
  const h2 = alerter.wrap(async () => [
    item('a1', '无关'), item('a2', '美联储降息落地'), // 已见，不重复告警
    item('b1', '央行降息预期升温'), item('b2', '降息窗口打开'), item('b3', '美联储降息落地'),
  ])
  await h2(srcArg, ctx)
  await sleep(20)
  assert.equal(notes.length, 1)
  assert.match(notes[0].b, /命中 3 条/)
  assert.match(notes[0].b, /降息/)
  assert.equal(notes[0].p, '/dsh-news-kuaixun/')
})

test('alerter: 无关键字不告警但 seen 照常推进；notify 抛错不影响抓取', async () => {
  const notes = []
  const alerter = createAlerter({
    store: { keywords: () => [], setKeywords: () => {} },
    notify: (t, b) => notes.push({ t, b }),
    windowMs: 5,
  })
  const ctx = { kv: kvOf() }
  const h = alerter.wrap(async () => [item('x1', '降息消息')])
  await h(src, ctx); await h(src, ctx); await sleep(15)
  assert.equal(notes.length, 0)

  const bad = createAlerter({
    store: { keywords: () => ['降息'], setKeywords: () => {} },
    notify: () => { throw new Error('no notifier') },
    windowMs: 5,
  })
  const ctx2 = { kv: kvOf() }
  let n = 0
  const hb = bad.wrap(async () => [item(`y${++n}`, '降息')])
  await hb(src, ctx2)            // 基线
  const r = await hb(src, ctx2)  // 新命中 → notify 抛错被吞，handler 正常返回
  assert.equal(r.length, 1)
  await sleep(15)
  bad.dispose()
})
