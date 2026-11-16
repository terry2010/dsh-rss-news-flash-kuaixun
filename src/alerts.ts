/**
 * 快讯提醒：关键字命中 → 桌面通知（经 rndSources.notify，与时段快报同一通道）。
 *
 * - 关键词持久化在 <dataDir>/alerts.json；UI 经 /dsh-news-kuaixun/api/alerts 读写
 *   （不能放 localStorage——匹配发生在插件进程的抓取 handler 里）。
 * - 去重：每源在 methodState kv 记已见 id 集（kxSeen）。handler 每轮返回的是
 *   「最新 N 条」全量而非增量，必须自己判新；首跑只建基线（kxSeenInit）不告警，
 *   防止装包/重启后历史条目一次性刷屏。
 * - 聚合：一轮抓取（六源并行 handler）内的所有命中先进 buffer，windowMs 后
 *   合并成一条通知——「命中 N 条」，不逐条弹。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MethodCtx, MethodHandler, RawItem } from 'dsh-rss-news-daily'

export interface AlertStore {
  keywords(): string[]
  setKeywords(kws: string[]): void
}

function resolveDataDir(): string {
  const home = process.env.DSH_HOME
  if (home) return join(home, 'data', 'news-kuaixun')
  return join(process.env.HOME || '.', '.dsh', 'news-kuaixun')
}

/** 关键字解析：空白/中英文逗号顿号分隔，去重、小写化比较由调用方做；上限 20 个、单条 30 字。 */
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

const itemKey = (it: RawItem): string => String(it.id ?? it.link ?? it.title)
const itemText = (it: RawItem): string => `${it.title ?? ''} ${it.content ?? it.summary ?? ''}`
const SEEN_CAP = 400

export function openAlertStore(dir = resolveDataDir()): AlertStore {
  const file = join(dir, 'alerts.json')
  const read = (): string[] => {
    try {
      const j = JSON.parse(readFileSync(file, 'utf8')) as { keywords?: unknown }
      return parseKeywords(Array.isArray(j?.keywords) ? (j.keywords as string[]).join(' ') : '')
    } catch { return [] }
  }
  return {
    keywords: read,
    setKeywords(kws) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, JSON.stringify({ keywords: kws }, null, 2))
    },
  }
}

export interface AlertHit { src: string; title: string; kws: string[] }

export interface Alerter {
  /** 包装一个 MethodHandler：抓取成功后做新条目匹配（失败静默——告警不挡抓取）。 */
  wrap(h: MethodHandler): MethodHandler
  dispose(): void
}

export function createAlerter(opts: {
  store: AlertStore
  notify: (title: string, body: string, path?: string) => void
  log?: { warn(msg: string): void; info?(msg: string): void }
  windowMs?: number
}): Alerter {
  const windowMs = opts.windowMs ?? 2500
  const buffer: AlertHit[] = []
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    timer = undefined
    if (!buffer.length) return
    const hits = buffer.splice(0)
    const kwList = [...new Set(hits.flatMap((h) => h.kws))].join('、')
    const lines = hits.slice(0, 3).map((h) => `【${h.src}】${h.title}`)
    const more = hits.length > 3 ? ` 等 ${hits.length} 条` : ''
    const body = `命中 ${hits.length} 条「${kwList}」：${lines.join('；')}${more}`
    try {
      opts.notify('⚡ 快讯提醒', body.replace(/\s+/g, ' ').slice(0, 400), '/dsh-news-kuaixun/')
    } catch (e) {
      opts.log?.warn?.(`alert notify failed: ${(e as Error).message}`)
    }
  }

  const ingest = (src: { id: string; title?: string }, items: RawItem[], ctx: MethodCtx) => {
    // seen 基线每轮都维护（关键词为空也要跟上），否则用户加词瞬间把积压全弹出来
    const ids = items.map(itemKey)
    let seen: string[] | null = null
    try { seen = ctx.kv.get('kxSeen') ? (JSON.parse(ctx.kv.get('kxSeen')!) as string[]) : null } catch { seen = null }
    const fresh = seen === null ? [] : ids.filter((id) => !seen!.includes(id))
    ctx.kv.set('kxSeen', JSON.stringify([...new Set([...ids, ...(seen ?? [])])].slice(0, SEEN_CAP)))
    if (ctx.kv.get('kxSeenInit') !== '1') { ctx.kv.set('kxSeenInit', '1'); return } // 首跑基线

    const kws = opts.store.keywords()
    if (!kws.length) return
    for (const it of items) {
      if (!fresh.includes(itemKey(it))) continue
      const hit = matchKeywords(itemText(it), kws)
      if (hit.length) buffer.push({ src: src.title || src.id, title: (it.title || '').slice(0, 80), kws: hit })
    }
    if (buffer.length && !timer) {
      timer = setTimeout(flush, windowMs)
      ;(timer as { unref?: () => void }).unref?.()
    }
  }

  return {
    wrap(h) {
      return async (src, ctx) => {
        const items = await h(src, ctx)
        try { ingest(src, items, ctx) } catch (e) { opts.log?.warn?.(`alert ingest failed: ${(e as Error).message}`) }
        return items
      }
    },
    dispose() { if (timer) clearTimeout(timer); buffer.length = 0 },
  }
}
