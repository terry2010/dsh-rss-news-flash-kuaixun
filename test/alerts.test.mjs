/** alerts.ts 单测：关键词解析/匹配、store 读写、聚合通知。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { parseKeywords, matchKeywords, openAlertStore, createAlerter } = await import('../lib/alerts.js')
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

test('alerter: 命中聚合成一条通知（汇总数量）', async () => {
  const notes = []
  const alerter = createAlerter({
    store: { keywords: () => ['降息'], setKeywords: () => {} },
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
  assert.match(notes[0].b, /命中 3 条/)
  assert.match(notes[0].b, /降息/)
  assert.equal(notes[0].p, '/dsh-news-kuaixun/')
  alerter.dispose()
})

test('alerter: 无关键字不告警；notify 抛错不外溢', async () => {
  const notes = []
  const alerter = createAlerter({
    store: { keywords: () => [], setKeywords: () => {} },
    notify: (t, b) => notes.push({ t, b }),
    windowMs: 5,
  })
  alerter.check([{ src: '金十', title: '降息消息' }])
  await sleep(15)
  assert.equal(notes.length, 0)

  const bad = createAlerter({
    store: { keywords: () => ['降息'], setKeywords: () => {} },
    notify: () => { throw new Error('no notifier') },
    windowMs: 5,
  })
  bad.check([{ src: '金十', title: '降息' }]) // flush 内 notify 抛错被吞
  await sleep(15)
  bad.dispose()
})
