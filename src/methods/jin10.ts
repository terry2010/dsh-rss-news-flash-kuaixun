/**
 * 金十数据：GET flash-api.jin10.com/get_flash_list，需 x-app-id 头。
 * x-app-id 自助提取：jin10.com 首页 → index.*.js bundle → "x-app-id":"…"，kv 缓存失效重提。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.2（实测 200）。
 */

import type { MethodHandler, RawItem } from 'dsh-rss-news-daily'
import { getDoc, looksLikeChallenge, markAuth, type Bf, type Doc } from '../transport.js'
import { cst, stripTags } from './util.js'

const DOMAIN = 'flash-api.jin10.com'
const SITE = 'https://www.jin10.com'
const API = `https://${DOMAIN}/get_flash_list?channel=-8200&limit=50`

interface J10Item {
  id: string
  time: string                  // 'YYYY-MM-DD HH:mm:ss' 北京时间
  important?: number            // 1=加红
  channel?: number[]
  data?: { content?: string; source_link?: string; link?: string }
}

async function extractAppId(ctx: Parameters<MethodHandler>[1], bf: Bf): Promise<string | undefined> {
  const cached = ctx.kv.get('appid')
  if (cached) return cached
  const home = await getDoc(ctx, bf(), 'www.jin10.com', `${SITE}/`, { headers: { Referer: SITE } })
  if ('error' in home) throw new Error(`jin10 home: ${home.error}`)
  const jsPath = /["']([^"']*index\.[a-zA-Z0-9_-]+\.js)["']/.exec(home.body)?.[1]
  if (!jsPath) throw new Error('jin10 appid: index js not found in home page')
  const js = await getDoc(ctx, bf(), 'www.jin10.com', new URL(jsPath, `${SITE}/`).toString(), {})
  if ('error' in js) throw new Error(`jin10 bundle: ${js.error}`)
  const id = /"x-app-id"\s*:\s*"([^"]+)"/.exec(js.body)?.[1]
  if (!id) throw new Error('jin10 appid: not found in bundle')
  ctx.kv.set('appid', id)
  ctx.log.info(`jin10 x-app-id extracted`)
  return id
}

async function flashList(ctx: Parameters<MethodHandler>[1], bf: Bf, appId: string): Promise<Doc> {
  return getDoc(ctx, bf(), DOMAIN, API, {
    headers: {
      'x-app-id': appId,
      'x-version': '1.0.0',
      Referer: `${SITE}/`,
      Origin: SITE,
    },
    accept: 'application/json',
  })
}

export const jin10 = (bf: Bf): MethodHandler => async (src, ctx) => {
  let appId = await extractAppId(ctx, bf)
  let doc = appId ? await flashList(ctx, bf, appId) : ({ url: API, status: 0, error: 'no appid' } as Doc)
  if (('error' in doc || doc.status !== 200) && ctx.kv.get('appid')) {
    // appid 失效：清缓存重提一次
    ctx.kv.set('appid', '')
    appId = await extractAppId(ctx, bf)
    doc = appId ? await flashList(ctx, bf, appId) : doc
  }
  if ('error' in doc) throw new Error(doc.error)
  if (looksLikeChallenge(doc.body, doc.status)) { markAuth(bf(), DOMAIN); throw new Error(`auth-required: HTTP ${doc.status}`) }
  const data = JSON.parse(doc.body) as { status?: number; data?: J10Item[] }
  const items = Array.isArray(data.data) ? data.data : []
  markAuth(bf(), DOMAIN, false)
  return items.map((i): RawItem => ({
    id: `j10_${i.id}`,
    title: stripTags(i.data?.content ?? '').slice(0, 120),
    // data.link=xnews 长文详情（type2）；source_link=外部原文；兜底=金十自家快讯详情页
    link: i.data?.link || i.data?.source_link || `${SITE}/flash/detail/${i.id}`,
    content: stripTags(i.data?.content ?? ''),
    publishedAt: cst(i.time),
    hot: i.important === 1, // 加红
  }))
}
