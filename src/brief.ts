/**
 * 快讯快报：接入主插件快报产线（rndSources apiVersion≥2）。
 *
 * registerBriefType 注册类型 + items 供给器——槽位调度/AI 概括/落盘/
 * 「全部」合并视图/桌面通知全部复用主插件；条目仍自 KxDb 窗口取，不进主库。
 *
 * 评分：快讯自带重要性信号，免 LLM 评分——多源互证 9 > 源原生 hot 8 > 普通 6；
 * minScore=6 全量入选、排序保秩，条数由 maxItems 截。
 * 去重：窗口内同事件聚类（similar.ts 并查集），非代表条挂 dupOf——
 * 快报节的入选过滤直接吃这个字段。
 */

import type { BriefTypeDef, FeedItem, SourceDef } from 'dsh-rss-news-daily'
import type { KxDb, StoredItem } from './db.js'
import { clusterTitles } from './similar.js'

const SCORE_NORMAL = 6
const SCORE_HOT = 8
const SCORE_MULTI = 9
/** 槽位窗口（正常一小时）远小于此；重启大窗口/异常积压时截断保供给器有界 */
const MAX_WINDOW = 300

/** 注册类型定义：六源 URL 即主库语境下的"源 id"（条目 sourceId 存的就是 url） */
export function briefDef(srcs: SourceDef[]): BriefTypeDef {
  return {
    id: 'kx-flash',
    name: '快讯快报',
    schedule: { kind: 'hourly', minute: 0 },
    // sourceIds 对供给器类型是「允许名单」：appendHourlyBrief 对空 sourceIds 的类型
    // 按 stream 剔除条目，而供给器源全部标 stream——必须显式点名放行
    sourceIds: srcs.map((s) => s.url),
    sourceNames: Object.fromEntries(srcs.map((s) => [s.url, s.title])),
    minScore: SCORE_NORMAL,
    maxItems: 40,
    itemTime: true, // 同小时内分钟级时序是快讯的信息本身
    prompt: '概括本时段快讯：先一句总起（本时段主线/最大事件），再逐行列出事件，'
      + '每行一条以 - 开头、至多 12 条，挑最重要或最多源互证的；'
      + '数据发布注明「公布/预期/前值」差异，数字必须照抄原文不得换算；'
      + '不同事件不得合并；多源互证的事件标注源数。'
      + '只摆事实，禁止任何评论、预测、褒贬判断及操作暗示'
      + '（不出现利好/利空/关注/买入/卖出等词）。',
  }
}

/** 簇代表：hot > 标题更长 > 更晚（与 web/index.html 成员排序同规则） */
const repOf = (a: StoredItem, b: StoredItem): StoredItem =>
  a.hot !== b.hot ? (a.hot ? a : b)
    : a.title.length !== b.title.length ? (a.title.length > b.title.length ? a : b)
      : (a.publishedAt ?? a.fetchedAt) >= (b.publishedAt ?? b.fetchedAt) ? a : b

/** 供 registerBriefType opts.items：窗口取数 → 聚类 → FeedItem（主插件只读字段，评分/查重已过） */
export function briefItems(db: KxDb, since: string): FeedItem[] {
  const items: StoredItem[] = []
  for (let page = 1; items.length < MAX_WINDOW; page++) {
    const r = db.query({ after: since, page, pageSize: 100, sort: 'published' })
    items.push(...r.items)
    if (items.length >= r.total || !r.items.length) break
  }
  const clusters = clusterTitles(items, (it) => it.title || (it.content ?? '').replace(/<[^>]+>/g, ''))
  const out: FeedItem[] = []
  for (const members of clusters) {
    const rep = members.reduce(repOf)
    const srcs = new Set(members.map((m) => m.sourceId))
    const multi = srcs.size >= 2
    for (const m of members) {
      const isRep = m === rep
      out.push({
        id: m.id,
        sourceId: m.sourceId,
        title: m.title,
        link: m.link || '#',
        summary: m.summary ?? '',
        content: m.content ?? '',
        publishedAt: m.publishedAt ?? m.fetchedAt,
        fetchedAt: m.fetchedAt,
        hash: '',
        digestedDay: '',
        topic: m.market && m.market !== '其他' ? m.market : '综合',
        score: 0,
        reasons: [],
        llmScore: isRep && multi ? SCORE_MULTI : m.hot ? SCORE_HOT : SCORE_NORMAL,
        ...(isRep && multi ? { llmReason: `×${srcs.size}源互证`, dupCount: members.length - 1 } : {}),
        tags: m.tags,
        ...(!isRep ? { dupOf: rep.id } : {}),
        state: { read: false, hidden: false, liked: 0, hot: m.hot === 1 },
      })
    }
  }
  return out
}
