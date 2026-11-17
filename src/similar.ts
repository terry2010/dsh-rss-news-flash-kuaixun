/**
 * 标题相似度：与 web/index.html 聚类同一套算法——
 * 归一化（去【】/[] 前后缀、标点空白）→ bigram → Dice。
 * 长标题 ≥0.55 即判同；归一化后 <8 字的短标题收紧到 0.72，防泛词误判。
 * 后端「多源快讯」提醒用它判断新条目是否已被其它源报道。
 */

const normTitle = (t: string): string => (t || '').toLowerCase()
  .replace(/【[^】]*】|\[[^\]]*\]|（[^）]*）|\([^)]*\)/g, ' ')
  .replace(/[\s"'“”‘’《》「」『』:：;；,，.。!！?？、·\-—_~|/\\+*=&%$#@^<>]+/g, '')

const bigrams = (s: string): Set<string> => {
  const m = new Set<string>()
  for (let i = 0; i + 1 < s.length; i++) m.add(s.slice(i, i + 2))
  return m
}

const SIM_LOOSE = 0.55, SIM_SHORT = 0.72, SHORT_LEN = 8

const dice = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0
  let n = 0
  for (const x of a) if (b.has(x)) n++
  return (2 * n) / (a.size + b.size)
}

/** 两条标题是否像同一事件（跨源多报）。 */
export function similarTitle(a: string, b: string): boolean {
  const na = normTitle(a), nb = normTitle(b)
  if (!na || !nb) return false
  const th = Math.min(na.length, nb.length) < SHORT_LEN ? SIM_SHORT : SIM_LOOSE
  return dice(bigrams(na), bigrams(nb)) >= th
}

/**
 * 窗口内同事件聚类（并查集）——与 web/index.html clusterize 同分组语义、
 * 同阈值同一套归一化/bigram 原语；簇代表由调用方挑（前端 hot>长>晚）。
 */
export function clusterTitles<T>(items: T[], titleOf: (it: T) => string): T[][] {
  const n = items.length
  if (!n) return []
  const norms = items.map((it) => normTitle(titleOf(it)))
  const grams = norms.map(bigrams)
  const parent = items.map((_, i) => i)
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = grams[i], b = grams[j]
      if (!a.size || !b.size) continue
      const th = Math.min(norms[i].length, norms[j].length) < SHORT_LEN ? SIM_SHORT : SIM_LOOSE
      if (dice(a, b) >= th) parent[find(i)] = find(j)
    }
  }
  const groups = new Map<number, T[]>()
  items.forEach((it, i) => {
    const r = find(i)
    const g = groups.get(r)
    if (g) g.push(it)
    else groups.set(r, [it])
  })
  return [...groups.values()]
}
