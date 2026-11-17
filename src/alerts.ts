/**
 * 快讯提醒：三通道命中 → 桌面通知（经 rndSources.notify，与时段快报同一通道）。
 *
 * 通道（alerts.json 的 flags 控制，互不影响）：
 *  - keyword  关键字：标题/正文子串命中 alerts.json 里的 keywords
 *  - important 重要：源原生重要标记（财联社红电/金十加红/同花顺标红 → hot）
 *  - multi    多源：同一事件已被其它源报道（similarTitle 判定，findMulti 回调提供）
 *
 * 独立库时代简化了去重：db.insert 的 INSERT OR IGNORE 返回的才是「新条目」，
 * 不再需要 seen-ID kv——库本身就是已见集合。首跑基线由 db.baseline 标记，
 * 置位前抓到的条目只入库不告警（防装包/加词历史刷屏）。
 *
 * 聚合：一轮抓取内的所有命中先进 buffer，windowMs 后合并成一条通知，
 * 按通道分节展示——「重要 N 条 / 多源 N 条 / 关键字「…」N 条」，不逐条弹。
 *
 * alerts.json（dataDir=companions/news-kuaixun，与 kuaixun.db 同目录——
 * 主插件备份 companions/ 时一起带走）：
 *   { keywords: [...], keyword: bool, important: bool, multi: bool }
 * 旧格式只有 keywords 时迁移为 keyword=有词即开，important/multi 默认关。
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDataDir } from './db.js'

export interface AlertFlags { keyword: boolean; important: boolean; multi: boolean }
export interface AlertConfig extends AlertFlags { keywords: string[] }

export interface AlertStore {
  config(): AlertConfig
  /** 只写 keywords——开关变化不动词表（用户删词只能自己删）。 */
  setKeywords(kws: string[]): void
  /** 只写开关——不动词表。 */
  setFlags(f: Partial<AlertFlags>): void
}

/** 关键字解析：空白/中英文逗号顿号分隔，去重；上限 20 个、单条 30 字。 */
export function parseKeywords(input: string | string[]): string[] {
  const parts = (Array.isArray(input) ? input.join(' ') : input)
    .split(/[\s,，、;；]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const k = p.slice(0, 30)
    const key = k.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(k)
    if (out.length >= 20) break
  }
  return out
}

/** 文本命中了哪些关键字（大小写不敏感、子串匹配；返回原始关键字供展示）。 */
export function matchKeywords(text: string, kws: string[]): string[] {
  if (!kws.length) return []
  const lower = text.toLowerCase()
  return kws.filter((k) => lower.includes(k.toLowerCase()))
}

interface FileShape {
  keywords?: unknown
  keyword?: unknown
  important?: unknown
  multi?: unknown
}

export function openAlertStore(dir = resolveDataDir()): AlertStore {
  const file = join(dir, 'alerts.json')
  // 旧位置 ~/.dsh/news-kuaixun/alerts.json → 迁到 companions 目录（备份通道覆盖）
  const legacy = join(process.env.HOME || '.', '.dsh', 'news-kuaixun', 'alerts.json')
  try {
    if (!existsSync(file) && existsSync(legacy)) {
      mkdirSync(dir, { recursive: true })
      renameSync(legacy, file)
    }
  } catch { /* 迁移失败不阻塞——当无配置处理 */ }
  const read = (): AlertConfig => {
    try {
      const j = JSON.parse(readFileSync(file, 'utf8')) as FileShape
      const keywords = parseKeywords(Array.isArray(j?.keywords) ? (j.keywords as string[]).join(' ') : '')
      return {
        keywords,
        // 旧文件无 keyword 字段：有词即视为开启（保持旧行为）；新装默认关
        keyword: typeof j?.keyword === 'boolean' ? j.keyword : keywords.length > 0,
        important: j?.important === true,
        multi: j?.multi === true,
      }
    } catch {
      return { keywords: [], keyword: false, important: false, multi: false }
    }
  }
  const write = (c: AlertConfig) => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, JSON.stringify(c, null, 2))
  }
  return {
    config: read,
    setKeywords(kws) { const c = read(); c.keywords = kws; write(c) },
    setFlags(f) { const c = read(); Object.assign(c, f); write(c) },
  }
}

export type AlertKind = 'kw' | 'imp' | 'multi'
export interface AlertHit { kind: AlertKind; title: string; srcs: string[]; detail?: string }
export interface AlertItem {
  src: string          // 源显示名（通知里用）
  sourceId?: string    // 源 id（多源匹配排除自身用）
  title: string
  content?: string | null
  publishedAt?: string | null
  fetchedAt?: string
  hot?: boolean        // 源原生重要标记
}

export interface Alerter {
  /** 对一批「新入库」条目做三通道匹配并入聚合窗口。 */
  check(items: AlertItem[]): void
  dispose(): void
}

export function createAlerter(opts: {
  store: AlertStore
  notify: (title: string, body: string, path?: string) => void
  /** 多源检测：返回其它源里报道同一事件的源显示名列表（无则空数组）。 */
  findMulti?: (it: AlertItem) => string[]
  log?: { warn(msg: string): void; info?(msg: string): void }
  windowMs?: number
}): Alerter {
  const windowMs = opts.windowMs ?? 2500
  const buffer: AlertHit[] = []
  let timer: ReturnType<typeof setTimeout> | undefined

  const section = (title: string, hits: AlertHit[]): string => {
    const lines = hits.slice(0, 3).map((h) => `【${h.srcs.join('+')}】${h.title}`)
    if (hits.length > 3) lines.push(`…等 ${hits.length} 条`)
    return `${title}\n${lines.join('\n')}`
  }

  const flush = () => {
    timer = undefined
    if (!buffer.length) return
    const hits = buffer.splice(0)
    const parts: string[] = []
    const imp = hits.filter((h) => h.kind === 'imp')
    const mul = hits.filter((h) => h.kind === 'multi')
    const kw = hits.filter((h) => h.kind === 'kw')
    if (imp.length) parts.push(section(`重要 ${imp.length} 条：`, imp))
    if (mul.length) parts.push(section(`多源 ${mul.length} 条：`, mul))
    if (kw.length) {
      const kws = [...new Set(kw.flatMap((h) => (h.detail ?? '').split('、')).filter(Boolean))].join('、')
      parts.push(section(`关键字「${kws}」${kw.length} 条：`, kw))
    }
    try {
      opts.notify('⚡ 快讯提醒', parts.join('\n').slice(0, 600), '/dsh-rss-news-flash-kuaixun/')
    } catch (e) {
      opts.log?.warn?.(`alert notify failed: ${(e as Error).message}`)
    }
  }

  return {
    check(items) {
      if (!items.length) return
      const cfg = opts.store.config()
      const kwOn = cfg.keyword && cfg.keywords.length > 0
      if (!kwOn && !cfg.important && !cfg.multi) return
      for (const it of items) {
        const title = (it.title || '').slice(0, 80)
        if (cfg.important && it.hot) buffer.push({ kind: 'imp', title, srcs: [it.src] })
        if (cfg.multi && opts.findMulti) {
          const others = opts.findMulti(it)
          if (others.length) buffer.push({ kind: 'multi', title, srcs: [it.src, ...others] })
        }
        if (kwOn) {
          const hit = matchKeywords(`${it.title ?? ''} ${it.content ?? ''}`, cfg.keywords)
          if (hit.length) buffer.push({ kind: 'kw', title, srcs: [it.src], detail: hit.join('、') })
        }
      }
      if (buffer.length && !timer) {
        timer = setTimeout(flush, windowMs)
        ;(timer as { unref?: () => void }).unref?.()
      }
    },
    dispose() { if (timer) clearTimeout(timer); buffer.length = 0 },
  }
}
