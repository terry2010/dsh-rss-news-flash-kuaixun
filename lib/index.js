/**
 * dsh-news-kuaixun 插件入口（私有包）。
 *
 * 契约（cordis bundle）：
 *  - name    'news-kuaixun'（cordis.patch.yml 里 id 必须一致）
 *  - inject  ['rndSources']（静态依赖：主插件服务未就位不执行）
 *  - apply   独立抓取管线（自有 fetcher/kv/轮询/SQLite）+ 提醒 + 视图注册
 *
 * 存储完全独立：条目/源定义/游标全在 companions/news-kuaixun/kuaixun.db，
 * 不进主插件 store.db。启动时调 rndSources.removeSources 清掉历史注入数据。
 * 仍消费 rndSources 的 notify（桌面通知）与 registerView（阅读器 tab）；
 * apiVersion≥2 时另经 registerBriefType 挂「快讯快报」条目供给器，
 * 让主插件快报产线（调度/AI概括/落盘/合并视图）直接吃 KxDb 窗口数据。
 *
 * browserFetch 为可选依赖（ctx.inject 动态）——装了 dsh-rss-news-browser-fetch 时
 * node fetch 失败的请求自动回落专用 Chrome 页面内 fetch；未装则纯 node。
 */
import { readFileSync } from 'node:fs';
import { createFetcher } from 'dsh-rss-news-daily';
import { KxDb, resolveDataDir } from './db.js';
import { mountUi } from './ui.js';
import { createAlerter, openAlertStore } from './alerts.js';
import { briefDef, briefItems } from './brief.js';
import { similarTitle } from './similar.js';
import { cls } from './methods/cls.js';
import { jin10 } from './methods/jin10.js';
import { wscn } from './methods/wscn.js';
import { eastmoney } from './methods/eastmoney.js';
import { ths } from './methods/ths.js';
import { sina } from './methods/sina.js';
export const name = 'news-kuaixun';
export const inject = ['rndSources'];
/** 源定义：method 名 = 'news-kuaixun:<方法>'，与下方 handlers 一一对应。 */
const sources = JSON.parse(readFileSync(new URL('./sources.flash.json', import.meta.url), 'utf8'));
/** 声明给 browserFetch 的域并集（API 所在源，不是站点源）。 */
const DOMAINS = [
    'cls.cn', 'www.cls.cn',
    'jin10.com', 'www.jin10.com', 'flash-api.jin10.com',
    'awtmt.com', 'api-one-wscn.awtmt.com',
    'eastmoney.com', 'newsapi.eastmoney.com', 'np-weblist.eastmoney.com',
    '10jqka.com.cn', 'news.10jqka.com.cn',
    'sina.com.cn', 'zhibo.sina.com.cn',
];
/** 抓取周期：六源都是轻量 JSON/列表端点，60s 一轮足够快讯时效 */
const POLL_MS = 60_000;
export function apply(ctx) {
    const log = ctx.logger('kuaixun');
    if (ctx.rndSources.apiVersion < 1) {
        log.warn('rndSources apiVersion < 1; kuaixun inert (upgrade dsh-rss-news-daily)');
        return;
    }
    let bf;
    ctx.inject(['browserFetch'], (c) => {
        bf = c.browserFetch;
        bf.declareDomains(name, DOMAINS);
        log.info('browserFetch attached: node-first with browser fallback enabled');
    });
    const get = () => bf;
    // ---- 独立存储 + 自有抓取管线 ----
    const db = new KxDb();
    const alerts = openAlertStore();
    // 多源检测：新条目 ±3h 内是否已有其它源报道同一事件（标题相似度同前端聚类）
    const findMulti = (it) => {
        if (!it.sourceId)
            return []; // 缺 sourceId 无法排除自身——宁可不报也不错报
        const t = Date.parse(it.publishedAt || it.fetchedAt || '');
        if (!Number.isFinite(t))
            return [];
        const after = new Date(t - 3 * 3600e3).toISOString();
        const before = new Date(t + 3 * 3600e3).toISOString();
        const out = [];
        for (const d of sources.sources) {
            if (d.url === it.sourceId)
                continue;
            const r = db.query({ source: d.url, after, before, pageSize: 50, sort: 'published' });
            if (r.items.some((c) => similarTitle(it.title, c.title)))
                out.push(d.title);
        }
        return out;
    };
    const alerter = createAlerter({
        store: alerts,
        notify: (t, b, p) => ctx.rndSources.notify(t, b, p),
        findMulti,
        log,
    });
    // 主插件策略 fetcher（SSRF/超时/大小限制）；proxy 沿用主插件缺省（伴随插件拿不到 prefs）
    const fetcher = createFetcher({ timeoutMs: 12_000, retries: 1 });
    const handlers = new Map([
        ['news-kuaixun:cls-telegraph', cls(get)],
        ['news-kuaixun:jin10-flash', jin10(get)],
        ['news-kuaixun:wscn-lives', wscn(get)],
        ['news-kuaixun:em-ajax', eastmoney(get)],
        ['news-kuaixun:ths-push', ths(get)],
        ['news-kuaixun:sina-zhibo', sina(get)],
    ]);
    const feedSrc = (d) => ({
        id: d.url, url: d.url, title: d.title, category: d.category ?? '快讯',
        tier: d.tier ?? 1, lang: d.lang ?? 'zh', method: d.method ?? '',
        enabled: d.enabled !== false, builtin: false, provider: name, weight: 1,
        summarize: false, stream: true, addedAt: '', cooldownHours: d.cooldownHours,
        health: { ok: 0, fail: 0, failStreak: 0 },
    });
    const mctx = (d) => ({
        fetch: fetcher, log, signal: undefined, kv: db.kv(d.url),
    });
    let running = false;
    const poll = async () => {
        if (running)
            return;
        running = true;
        try {
            // 各源新条目先全部入库，再统一过提醒——同批跨源报道才能互相命中「多源」
            const batch = [];
            await Promise.allSettled(sources.sources.map(async (d) => {
                const h = handlers.get(d.method ?? '');
                if (!h) {
                    log.warn(`no handler for ${d.method}`);
                    return;
                }
                const items = await h(feedSrc(d), mctx(d));
                const fresh = db.insert(d.url, d.title, items);
                if (!db.baseline(d.url)) {
                    db.markBaseline(d.url);
                    return;
                } // 首跑基线：只入库不告警
                for (const it of fresh) {
                    batch.push({
                        src: d.title, sourceId: d.url, title: it.title, content: it.content,
                        publishedAt: it.publishedAt, fetchedAt: it.fetchedAt, hot: it.hot === 1,
                    });
                }
            }));
            alerter.check(batch);
        }
        finally {
            running = false;
        }
    };
    // 历史清理：早期版本把六源注入主库（sources+items+methodState）——转独立存储后清掉
    void ctx.rndSources.removeSources(name).then((n) => {
        if (n)
            log.info(`cleaned ${n} legacy source(s) + items from main store`);
    });
    void poll();
    const timer = setInterval(() => { void poll(); }, POLL_MS);
    timer.unref?.();
    // 阅读器「快讯」tab：ticker 视图（密排时序流，数据走本插件 /api/items）
    ctx.rndSources.registerView(name, { id: 'kuaixun', title: '快讯', url: '/dsh-news-kuaixun/' });
    // 「快讯快报」类型：条目供给器挂 KxDb 窗口——调度/AI概括/落盘/合并视图/通知全走主插件产线
    if (ctx.rndSources.apiVersion >= 2) {
        ctx.rndSources.registerBriefType(name, briefDef(sources.sources), { items: async (since) => briefItems(db, since) });
    }
    else {
        log.warn('rndSources apiVersion < 2: 快讯快报未注册（升级 dsh-rss-news-daily）');
    }
    ctx.inject(['webServer'], (c) => {
        const dispose = mountUi(c.webServer, log, alerts, db);
        c.effect(() => dispose);
    });
    ctx.effect(() => () => {
        clearInterval(timer);
        alerter.dispose();
        db.close();
    });
    log.info(`kuaixun: independent pipeline, ${sources.sources.length} sources @${POLL_MS / 1000}s, db=${resolveDataDir()}`);
}
//# sourceMappingURL=index.js.map