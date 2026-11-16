/**
 * 快讯视图挂载：静态 ticker 页 /dsh-news-kuaixun/。
 * 数据走主插件 /dsh-rss-news-daily/api/items（category=快讯）——本包不另起 JSON API。
 * 与主插件/browser-fetch 同一套 webServer 路由惯例（kind + sameSite 防护）。
 */
import { type AlertStore } from './alerts.js';
interface Req {
    method?: string;
    url?: string;
    headers?: Record<string, string | string[] | undefined>;
    on(event: 'data', cb: (chunk: Buffer | string) => void): unknown;
    on(event: 'end', cb: () => void): unknown;
}
interface Res {
    statusCode: number;
    setHeader(k: string, v: string): void;
    end(b?: string | Buffer): void;
}
export interface WebServerLike {
    register(opts: {
        kind: string;
        path: string;
        handler: (req: Req, res: Res) => void;
    }): () => void;
}
type Log = {
    info(msg: string): void;
};
/** 注册 ticker 页路由 + 提醒关键字 API；返回 disposer。MOUNT 于 ctx.inject(['webServer']) 内调用。 */
export declare function mountUi(ws: WebServerLike, log: Log, alerts: AlertStore): () => void;
export {};
//# sourceMappingURL=ui.d.ts.map