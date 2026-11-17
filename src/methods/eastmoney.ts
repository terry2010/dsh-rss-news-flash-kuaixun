/**
 * 东方财富 7×24：GET newsapi.eastmoney.com/kuaixun/v1/getlist_102_ajaxResult_50_1_.html
 * 返回 'var ajaxResult={...}' JS 前缀，剥壳后 LivesList[]。裸调即通。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.4（实测秒回）。
 */

import type { MethodHandler } from 'dsh-rss-news-daily'
import { getDoc, looksLikeChallenge, markAuth, type Bf } from '../transport.js'
import { cst, stripTags } from './util.js'
import { marketFromText, type KxItem } from '../taxonomy.js'

const DOMAIN = 'newsapi.eastmoney.com'
const API = `https://${DOMAIN}/kuaixun/v1/getlist_102_ajaxResult_50_1_.html`

interface EmItem {
  newsid: string
  title?: string
  digest?: string
  showtime?: string   // 'YYYY-MM-DD HH:mm:ss'
  url_w?: string
}

export const eastmoney = (bf: Bf): MethodHandler => async (src, ctx) => {
  const doc = await getDoc(ctx, bf(), DOMAIN, API, { accept: '*/*' })
  if ('error' in doc) throw new Error(doc.error)
  if (looksLikeChallenge(doc.body, doc.status)) { markAuth(bf(), DOMAIN); throw new Error(`auth-required: HTTP ${doc.status}`) }
  const body = doc.body.replace(/^var\s+ajaxResult\s*=\s*/, '').replace(/;\s*$/, '')
  const data = JSON.parse(body) as { LivesList?: EmItem[] }
  const items = data.LivesList ?? []
  markAuth(bf(), DOMAIN, false)
  return items.map((i): KxItem => {
    const title = stripTags(i.title || i.digest || '').slice(0, 120)
    return {
      id: `em_${i.newsid}`,
      title,
      link: i.url_w || 'https://kuaixun.eastmoney.com/',
      content: stripTags(i.digest || i.title || ''),
      publishedAt: i.showtime ? cst(i.showtime) : new Date().toISOString(),
      tags: [], // column 是纯数字栏目 id 无命名（102=7×24 主快讯）——不给标签
      market: marketFromText(title, 'A股'),
    }
  })
}
