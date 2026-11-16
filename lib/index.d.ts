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
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "news-kuaixun";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map