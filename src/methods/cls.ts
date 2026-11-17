/**
 * 财联社电报：GET /v1/roll/get_roll_list，参数签名 = md5(sha1(排序 k=v&...))。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.1（实测 errno:0）。
 * 增量注意：last_time 是「向前翻页」游标（返回 last_time 之前的 50 条历史），
 * 不是正向水位——rt=1&last_time=<旧值> 会一路回溯历史。rt=2 实测恒返回最新页，
 * 新条目靠 items.id（cls_<id>）由 db INSERT OR IGNORE 去重。
 */

import type { MethodHandler } from 'dsh-rss-news-daily'
import { getDoc, looksLikeChallenge, markAuth, type Bf } from '../transport.js'
import { md5, qs, sha1, stripTags } from './util.js'
import { clsMarket, type KxItem } from '../taxonomy.js'

const DOMAIN = 'www.cls.cn'
const API = `https://${DOMAIN}/v1/roll/get_roll_list`
const REFERER = `https://${DOMAIN}/telegraph`

interface ClsItem {
  id: number
  brief?: string
  content: string
  ctime: number          // 秒
  level?: string         // 字母等级：A/B=加红高亮（官网前端 fillStyle 特判），C=普通
  is_ad?: number
  shareurl?: string
  subjects?: Array<{ subject_name?: string }> // 栏目与主题混放（盘面直播/环球市场情报/俄乌冲突快报…）
  tags?: Array<{ name?: string }>
}

export const cls = (bf: Bf): MethodHandler => async (src, ctx) => {
  const p: Record<string, string | number> = {
    refresh_type: 2, // 2=刷新最新页；1 会把 last_time 当历史翻页游标向回溯
    rn: 50,
    last_time: 0,
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
  markAuth(bf(), DOMAIN, false)
  return items.filter((i) => !i.is_ad).map((i): KxItem => {
    const title = stripTags(i.brief || i.content).slice(0, 120)
    const subj = (i.subjects ?? []).map((x) => x.subject_name ?? '').filter(Boolean)
    const tagNames = (i.tags ?? []).map((x) => x.name ?? '').filter(Boolean)
    return {
      id: `cls_${i.id}`,
      title,
      link: i.shareurl || `https://${DOMAIN}/detail/${i.id}`,
      content: stripTags(i.content),
      publishedAt: new Date(i.ctime * 1000).toISOString(),
      hot: i.level === 'A' || i.level === 'B', // 加红/加级电报（level 是字母不是数字）
      tags: [...subj, ...tagNames],
      market: clsMarket(subj, title),
    }
  })
}
