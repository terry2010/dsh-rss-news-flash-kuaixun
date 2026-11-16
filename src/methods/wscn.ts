/**
 * 华尔街见闻：GET api-one-wscn.awtmt.com/apiv1/content/lives。裸调即通。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.3（实测 200）。
 */

import type { MethodHandler, RawItem } from 'dsh-rss-news-daily'
import { getDoc, looksLikeChallenge, markAuth, type Bf } from '../transport.js'
import { stripTags } from './util.js'

const DOMAIN = 'api-one-wscn.awtmt.com'
const API = `https://${DOMAIN}/apiv1/content/lives?channel=global-channel&client=pc&limit=50`

interface WscnItem {
  id: number
  title?: string
  content?: string      // HTML
  content_text?: string
  display_time?: number // 秒
  uri?: string
}

export const wscn = (bf: Bf): MethodHandler => async (src, ctx) => {
  const doc = await getDoc(ctx, bf(), DOMAIN, API, { accept: 'application/json' })
  if ('error' in doc) throw new Error(doc.error)
  if (looksLikeChallenge(doc.body, doc.status)) { markAuth(bf(), DOMAIN); throw new Error(`auth-required: HTTP ${doc.status}`) }
  const data = JSON.parse(doc.body) as { data?: { items?: WscnItem[] } }
  const items = data.data?.items ?? []
  markAuth(bf(), DOMAIN, false)
  return items.map((i): RawItem => {
    const text = stripTags(i.content_text || i.content || i.title || '')
    const link = i.uri
      ? (i.uri.startsWith('http') ? i.uri : `https://wallstreetcn.com/${i.uri.replace(/^\/+/, '')}`)
      : `https://wallstreetcn.com/livenews/${i.id}`
    return {
      id: `wscn_${i.id}`,
      title: (i.title ? stripTags(i.title) : text).slice(0, 120),
      link,
      content: text,
      publishedAt: i.display_time ? new Date(i.display_time * 1000).toISOString() : new Date().toISOString(),
    }
  })
}
