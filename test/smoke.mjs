/** 六个真实端点冒烟：node fetch 全链路（含 cls 签名、jin10 x-app-id 提取）。
 *  用法: node test/smoke.mjs [方法名前缀过滤] */
const { createFetcher } = await import('dsh-rss-news-daily')

const kvStore = new Map()
const ctx = {
  fetch: createFetcher({ timeoutMs: 12_000, retries: 1 }),
  log: { info: (m) => console.log(`  [log] ${m}`), warn: (m) => console.warn(`  [warn] ${m}`), error: (m) => console.error(`  [err] ${m}`) },
  signal: undefined,
  kv: { get: (k) => kvStore.get(k), set: (k, v) => kvStore.set(k, v) },
}
const src = { id: 'smoke', url: '', title: 'smoke', enabled: true, addedAt: '', category: '快讯', tier: 1, lang: 'zh', method: '', builtin: false, weight: 1, summarize: false, health: { ok: 0, fail: 0, failStreak: 0 } }

const methods = {
  'cls-telegraph': (await import('../lib/methods/cls.js')).cls,
  'jin10-flash': (await import('../lib/methods/jin10.js')).jin10,
  'wscn-lives': (await import('../lib/methods/wscn.js')).wscn,
  'em-ajax': (await import('../lib/methods/eastmoney.js')).eastmoney,
  'ths-push': (await import('../lib/methods/ths.js')).ths,
  'sina-zhibo': (await import('../lib/methods/sina.js')).sina,
}

const filter = process.argv[2]
for (const [name, factory] of Object.entries(methods)) {
  if (filter && !name.includes(filter)) continue
  const t0 = Date.now()
  try {
    const items = await factory(() => undefined)(src, ctx)
    console.log(`✓ ${name}: ${items.length} items (${Date.now() - t0}ms)`)
    if (items[0]) console.log(`    ${items[0].publishedAt} | ${items[0].title.slice(0, 60)} | ${items[0].link.slice(0, 60)}`)
  } catch (e) {
    console.log(`✗ ${name}: ${e.message} (${Date.now() - t0}ms)`)
  }
}
