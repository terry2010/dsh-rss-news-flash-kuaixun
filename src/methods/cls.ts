/**
 * 财联社电报：GET /v1/roll/get_roll_list，参数签名 = md5(sha1(排序 k=v&...))。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.1（实测 errno:0）。
 * 增量：kv 'last' 记已见最小 ctime 翻页水位。
 */

import type { MethodHandler, RawItem } from 'dsh-rss-news-daily'
import { getDoc, looksLikeChallenge, markAuth, type Bf } from '../transport.js'
import { md5, qs, sha1, stripTags } from './util.js'

const DOMAIN = 'www.cls.cn'
const API = `https://${DOMAIN}/v1/roll/get_roll_list`
const REFERER = `https://${DOMAIN}/telegraph`

interface ClsItem {
  id: number
  brief?: string
  content: string
  ctime: number          // 秒
  level?: number         // 加红电报 level 更高
  is_ad?: number
  shareurl?: string
}

export const cls = (bf: Bf): MethodHandler => async (src, ctx) => {
  const p: Record<string, string | number> = {
    refresh_type: 1,
    rn: 50,
    last_time: Number(ctx.kv.get('last') ?? 0),
    os: 'web',
    sv: '8.7.9',
    app: 'CailianpressWeb',
  }
  const s = Object.keys(p)
    .sort((a, b) => a.toUpperCase().localeCompare(b.toUpperCase()))
    .map((k) => `${k}=${p[k]}`)
    .join('&')
  const sign = md5(sha1(s))
  const doc = await getDoc(ctx, bf(), DOMAIN, `${API}?${qs({ ...p, sign })}`, {
    headers: { Referer: REFERER },
    accept: 'application/json',
  })
  if ('error' in doc) throw new Error(doc.error)
  if (looksLikeChallenge(doc.body, doc.status)) { markAuth(bf(), DOMAIN); throw new Error(`auth-required: HTTP ${doc.status}`) }
  const data = JSON.parse(doc.body) as { errno?: number; data?: { roll_data?: ClsItem[] } }
  if (data.errno !== 0) throw new Error(`cls errno ${data.errno}`)
  const items = data.data?.roll_data ?? []
  if (items.length) ctx.kv.set('last', String(Math.min(...items.map((i) => i.ctime))))
  markAuth(bf(), DOMAIN, false)
  return items.filter((i) => !i.is_ad).map((i): RawItem => ({
    id: `cls_${i.id}`,
    title: stripTags(i.brief || i.content).slice(0, 120),
    link: i.shareurl || `https://${DOMAIN}/detail/${i.id}`,
    content: stripTags(i.content),
    publishedAt: new Date(i.ctime * 1000).toISOString(),
    hot: (i.level ?? 0) >= 1, // 加红/加级电报
  }))
}
