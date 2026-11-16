/**
 * 快讯视图挂载：静态 ticker 页 /dsh-news-kuaixun/。
 * 数据走主插件 /dsh-rss-news-daily/api/items（category=快讯）——本包不另起 JSON API。
 * 与主插件/browser-fetch 同一套 webServer 路由惯例（kind + sameSite 防护）。
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseKeywords, type AlertStore } from './alerts.js'

const BASE = '/dsh-news-kuaixun'

interface Req {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
  on(event: 'data', cb: (chunk: Buffer | string) => void): unknown
  on(event: 'end', cb: () => void): unknown
}
interface Res {
  statusCode: number
  setHeader(k: string, v: string): void
  end(b?: string | Buffer): void
}
export interface WebServerLike {
  register(opts: { kind: string; path: string; handler: (req: Req, res: Res) => void }): () => void
}
type Log = { info(msg: string): void }

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

function sameSite(req: Req): boolean {
  return String(req.headers?.['sec-fetch-site'] || '').toLowerCase() !== 'cross-site'
}

async function serveStatic(res: Res, rel: string): Promise<void> {
  const webDir = join(fileURLToPath(new URL('.', import.meta.url)), 'web')
  const safe = rel.split('?')[0].replace(/^\/+|\.{2,}/g, '') || 'index.html'
  const file = join(webDir, safe)
  try {
    const body = await readFile(file)
    res.statusCode = 200
    res.setHeader('content-type', MIME[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream')
    res.end(body)
  } catch {
    res.statusCode = 404
    res.end('not found')
  }
}

function readBody(req: Req): Promise<string> {
  return new Promise((resolve, reject) => {
    let s = ''
    req.on('data', (c) => { s += c; if (s.length > 8192) reject(new Error('body too large')) })
    req.on('end', () => resolve(s))
  })
}

const json = (res: Res, code: number, body: unknown) => {
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

/** 注册 ticker 页路由 + 提醒关键字 API；返回 disposer。MOUNT 于 ctx.inject(['webServer']) 内调用。 */
export function mountUi(ws: WebServerLike, log: Log, alerts: AlertStore): () => void {
  const guard = (fn: (req: Req, res: Res) => void | Promise<void>) => (req: Req, res: Res): Promise<void> => {
    if (!sameSite(req)) { res.statusCode = 403; res.end('forbidden'); return Promise.resolve() }
    return Promise.resolve(fn(req, res)).catch(() => { res.statusCode = 500; res.end('error') })
  }
  const disposers = [
    ws.register({ kind: 'exact', path: `${BASE}/`, handler: guard((_q, r) => serveStatic(r, 'index.html')) }),
    ws.register({ kind: 'exact', path: BASE, handler: guard((_q, r) => serveStatic(r, 'index.html')) }),
    ws.register({ kind: 'prefix', path: `${BASE}/web`, handler: guard((q, r) => serveStatic(r, (q.url || '').replace(`${BASE}/web/`, ''))) }),
    // 提醒关键字：GET 读、POST 写（body {"keywords":"a b"} 或 {"keywords":[...]}）
    ws.register({
      kind: 'exact', path: `${BASE}/api/alerts`,
      handler: guard(async (req, res) => {
        if (req.method === 'GET') return json(res, 200, { keywords: alerts.keywords() })
        if (req.method === 'POST') {
          const body = JSON.parse((await readBody(req)) || '{}') as { keywords?: unknown }
          const kws = parseKeywords(
            Array.isArray(body?.keywords) ? (body.keywords as string[]).join(' ') : String(body?.keywords ?? ''),
          )
          alerts.setKeywords(kws)
          log.info(`alerts: ${kws.length} keyword(s) saved`)
          return json(res, 200, { keywords: kws })
        }
        json(res, 405, { error: 'method not allowed' })
      }),
    }),
  ]
  log.info('kuaixun ticker page mounted')
  return () => { for (const d of disposers) d() }
}
