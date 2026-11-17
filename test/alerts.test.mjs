/** alerts.ts 单测：关键词解析/匹配、store 读写、三通道聚合通知。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { parseKeywords, matchKeywords, openAlertStore, createAlerter } = await import('../lib/alerts.js')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const mkStore = (cfg) => ({
  config: () => ({ keywords: [], keyword: true, important: false, multi: false, ...cfg }),
  setKeywords: () => {},
  setFlags: () => {},
})

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

test('openAlertStore: 读写往返 + flags + 旧格式迁移', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kx-alert-'))
  try {
    const s = openAlertStore(dir)
    assert.deepEqual(s.config(), { keywords: [], keyword: false, important: false, multi: false })
    s.setKeywords(parseKeywords('降息 美联储'))
    s.setFlags({ important: true })
    const c = openAlertStore(dir).config()
    assert.deepEqual(c.keywords, ['降息', '美联储'])
    assert.equal(c.important, true)
    assert.equal(c.keyword, false) // 新装默认关——开关要显式打开
    assert.equal(c.multi, false)
    // setFlags 不动词表；setKeywords 不动开关
    const s2 = openAlertStore(dir)
    s2.setFlags({ multi: true })
    s2.setKeywords(['a'])
    const c2 = s2.config()
    assert.deepEqual(c2.keywords, ['a'])
    assert.equal(c2.important, true)
    assert.equal(c2.multi, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('openAlertStore: 旧格式（无 keyword 字段）有词即迁移为开', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kx-alert-'))
  try {
    writeFileSync(join(dir, 'alerts.json'), JSON.stringify({ keywords: ['降息'] }))
    const c = openAlertStore(dir).config()
    assert.equal(c.keyword, true) // 旧行为：有词=提醒开
    assert.deepEqual(c.keywords, ['降息'])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('openAlertStore: 显式 keyword=false 覆盖"有词即开"迁移', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kx-alert-'))
  try {
    writeFileSync(join(dir, 'alerts.json'), JSON.stringify({ keywords: ['降息'], keyword: false }))
    const c = openAlertStore(dir).config()
    assert.equal(c.keyword, false)
    assert.deepEqual(c.keywords, ['降息']) // 词保留，只是开关关
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('alerter: 关键字命中聚合成一条通知（分节+汇总数量）', async () => {
  const notes = []
  const alerter = createAlerter({
    store: mkStore({ keywords: ['降息'] }),
    notify: (t, b, p) => notes.push({ t, b, p }),
    windowMs: 5,
  })
  alerter.check([
    { src: '金十', title: '无关新闻', content: '' },
    { src: '金十', title: '美联储降息落地' },
    { src: '财联社', title: '央行降息预期升温' },
    { src: '财联社', title: '降息窗口打开' },
  ])
  await sleep(20)
  assert.equal(notes.length, 1) // 一批合并一条
  assert.match(notes[0].b, /关键字「降息」3 条/)
  assert.match(notes[0].b, /【金十】美联储降息落地/)
  assert.equal(notes[0].p, '/dsh-rss-news-flash-kuaixun/')
  alerter.dispose()
})

test('alerter: 重要通道——hot 条目进「重要」节', async () => {
  const notes = []
  const alerter = createAlerter({
    store: mkStore({ important: true }),
    notify: (t, b) => notes.push({ t, b }),
    windowMs: 5,
  })
  alerter.check([
    { src: '财联社', title: '普通快讯', hot: false },
    { src: '财联社', title: '【加红】证监会重大政策', hot: true },
    { src: '金十', title: '加红：非农爆冷', hot: true },
  ])
  await sleep(20)
  assert.equal(notes.length, 1)
  assert.match(notes[0].b, /重要 2 条/)
  assert.doesNotMatch(notes[0].b, /普通快讯/)
  alerter.dispose()
})

test('alerter: 多源通道——findMulti 命中列出全部源', async () => {
  const notes = []
  const alerter = createAlerter({
    store: mkStore({ multi: true }),
    notify: (t, b) => notes.push({ t, b }),
    findMulti: (it) => (it.title.includes('比特币') ? ['华尔街见闻', '同花顺'] : []),
    windowMs: 5,
  })
  alerter.check([
    { src: '财联社', sourceId: 'cls', title: '比特币跌破62000美元', publishedAt: new Date().toISOString() },
    { src: '金十', sourceId: 'jin10', title: '独家小道消息' },
  ])
  await sleep(20)
  assert.equal(notes.length, 1)
  assert.match(notes[0].b, /多源 1 条/)
  assert.match(notes[0].b, /【财联社\+华尔街见闻\+同花顺】比特币跌破62000美元/)
  alerter.dispose()
})

test('alerter: 开关全关不告警；notify 抛错不外溢', async () => {
  const notes = []
  const off = createAlerter({
    store: mkStore({ keywords: ['降息'], keyword: false, important: false, multi: false }),
    notify: (t, b) => notes.push({ t, b }),
    windowMs: 5,
  })
  off.check([{ src: '金十', title: '降息消息', hot: true }])
  await sleep(15)
  assert.equal(notes.length, 0) // keyword=false 时词表再多也不报

  const bad = createAlerter({
    store: mkStore({ keywords: ['降息'] }),
    notify: () => { throw new Error('no notifier') },
    windowMs: 5,
  })
  bad.check([{ src: '金十', title: '降息' }]) // flush 内 notify 抛错被吞
  await sleep(15)
  off.dispose(); bad.dispose()
})
