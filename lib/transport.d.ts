/**
 * 传输层：node fetch 优先，失败自动回落 browserFetch（专用 Chrome 页面内 fetch）。
 * adapter 拿到的返回形态与 MethodCtx.fetch 一致（FetchedDocument | FetchFailure）。
 */
import type { MethodCtx } from 'dsh-rss-news-daily';
/** browserFetch 服务的结构类型——本地声明即可，不给 dsh-rss-news-browser-fetch 挂依赖。 */
export interface BrowserFetchLike {
    declareDomains(caller: string, domains: string[]): void;
    fetch(domain: string, url: string, init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        credentials?: 'omit' | 'same-origin' | 'include';
        referrer?: string;
    }): Promise<{
        status: number;
        body: string;
    }>;
    authRequired?(domain: string): boolean;
    markAuthRequired?(domain: string, on?: boolean): void;
    openForAuth?(domain: string, url?: string): Promise<boolean>;
}
export type Bf = () => BrowserFetchLike | undefined;
export type Doc = Awaited<ReturnType<MethodCtx['fetch']>>;
export type Init = {
    headers?: Record<string, string>;
    accept?: string;
    proxy?: string | boolean;
};
/** node 优先；网络层/WAF 失败自动回落 browser（未装 browserFetch 则纯 node）。 */
export declare function getDoc(ctx: MethodCtx, bf: BrowserFetchLike | undefined, domain: string, url: string, init?: Init & {
    preferBrowser?: boolean;
}): Promise<Doc>;
export declare function looksLikeChallenge(body: string, status: number): boolean;
export declare function markAuth(bf: BrowserFetchLike | undefined, domain: string, on?: boolean): void;
//# sourceMappingURL=transport.d.ts.map