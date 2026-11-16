/**
 * dsh-news-kuaixun 插件入口（私有包）。
 *
 * 契约（cordis bundle）：
 *  - name    'news-kuaixun'（cordis.patch.yml 里 id 必须一致）
 *  - inject  ['rndSources']（静态依赖：主插件服务未就位不执行）
 *  - apply   registerMethod×6 + addSources(六条快讯源)
 *
 * browserFetch 为可选依赖（ctx.inject 动态）——装了 dsh-rss-news-browser-fetch 时
 * node fetch 失败的请求自动回落专用 Chrome 页面内 fetch；未装则纯 node。
 *
 * 本包只含「端点知识」：URL/签名/字段映射/源定义。调度/去重/存储归主插件，
 * 浏览器传输归 browser-fetch 包。
 */

import { readFileSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import type { SourceDef } from 'dsh-rss-news-daily'

import { mountUi, type WebServerLike } from './ui.js'
import { createAlerter, openAlertStore } from './alerts.js'
import type { BrowserFetchLike } from './transport.js'
import { cls } from './methods/cls.js'
import { jin10 } from './methods/jin10.js'
import { wscn } from './methods/wscn.js'
import { eastmoney } from './methods/eastmoney.js'
import { ths } from './methods/ths.js'
import { sina } from './methods/sina.js'

export const name = 'news-kuaixun'
export const inject = ['rndSources']

/** 源定义：method 名 = 'news-kuaixun:<方法>'，与下方 registerMethod 一一对应。 */
const sources = JSON.parse(
  readFileSync(new URL('./sources.flash.json', import.meta.url), 'utf8'),
) as { sources: SourceDef[] }

/** 声明给 browserFetch 的域并集（API 所在源，不是站点源）。 */
const DOMAINS = [
  'cls.cn', 'www.cls.cn',
  'jin10.com', 'www.jin10.com', 'flash-api.jin10.com',
  'awtmt.com', 'api-one-wscn.awtmt.com',
  'eastmoney.com', 'newsapi.eastmoney.com', 'np-weblist.eastmoney.com',
  '10jqka.com.cn', 'news.10jqka.com.cn',
  'sina.com.cn', 'zhibo.sina.com.cn',
]

export function apply(ctx: Context) {
  const log = ctx.logger('kuaixun')
  if (ctx.rndSources.apiVersion < 1) {
    log.warn('rndSources apiVersion < 1; kuaixun inert (upgrade dsh-rss-news-daily)')
    return
  }
  let bf: BrowserFetchLike | undefined
  ctx.inject(['browserFetch'], (c) => {
    bf = (c as unknown as { browserFetch: BrowserFetchLike }).browserFetch
    bf.declareDomains(name, DOMAINS)
    log.info('browserFetch attached: node-first with browser fallback enabled')
  })
  const get = () => bf
  // 快讯提醒：关键词命中 → rndSources.notify（与快报同一桌面通知通道）。
  // handler 包装层做 seen-ID 去重 + 窗口聚合（一轮多条合并成一条通知）。
  const alerts = openAlertStore()
  const alerter = createAlerter({
    store: alerts,
    notify: (t, b, p) => ctx.rndSources.notify(t, b, p),
    log,
  })
  ctx.effect(() => () => alerter.dispose())
  ctx.rndSources.registerMethod('news-kuaixun:cls-telegraph', alerter.wrap(cls(get)))
  ctx.rndSources.registerMethod('news-kuaixun:jin10-flash', alerter.wrap(jin10(get)))
  ctx.rndSources.registerMethod('news-kuaixun:wscn-lives', alerter.wrap(wscn(get)))
  ctx.rndSources.registerMethod('news-kuaixun:em-ajax', alerter.wrap(eastmoney(get)))
  ctx.rndSources.registerMethod('news-kuaixun:ths-push', alerter.wrap(ths(get)))
  ctx.rndSources.registerMethod('news-kuaixun:sina-zhibo', alerter.wrap(sina(get)))
  ctx.rndSources.addSources(name, sources.sources)

  // 快讯快报：独立于普通快报的默认类型——只收六条 stream 源（主流 wildcard 不收 stream）
  ctx.rndSources.registerBriefType(name, {
    id: 'kuaixun',
    name: '快讯快报',
    enabled: true,
    schedule: { kind: 'minutes', everyMinutes: 30 },
    sourceIds: sources.sources.map((s) => s.url),
    minScore: 0,
    maxItems: 100,
    focus: '财经快讯流：按时间归纳市场/宏观/公司要闻要点，同类快讯合并，不需要分析展开',
  })
  // 阅读器「快讯」tab：ticker 视图（密排时序流）
  ctx.rndSources.registerView(name, { id: 'kuaixun', title: '快讯', url: '/dsh-news-kuaixun/' })
  ctx.inject(['webServer'], (c) => {
    const dispose = mountUi((c as unknown as { webServer: WebServerLike }).webServer, log, alerts)
    c.effect(() => dispose)
  })
  log.info(`kuaixun: 6 methods, ${sources.sources.length} sources, browser=${!!bf}`)
}
