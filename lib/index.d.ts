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
 * 仍消费 rndSources 的 notify（桌面通知）与 registerView（阅读器 tab）。
 *
 * browserFetch 为可选依赖（ctx.inject 动态）——装了 dsh-rss-news-browser-fetch 时
 * node fetch 失败的请求自动回落专用 Chrome 页面内 fetch；未装则纯 node。
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "news-kuaixun";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map