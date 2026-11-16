/**
 * 快讯提醒：关键字命中 → 桌面通知（经 rndSources.notify，与时段快报同一通道）。
 *
 * - 关键词持久化在 <dataDir>/alerts.json；UI 经 /dsh-news-kuaixun/api/alerts 读写
 *   （不能放 localStorage——匹配发生在插件进程的抓取 handler 里）。
 * - 去重：每源在 methodState kv 记已见 id 集（kxSeen）。handler 每轮返回的是
 *   「最新 N 条」全量而非增量，必须自己判新；首跑只建基线（kxSeenInit）不告警，
 *   防止装包/重启后历史条目一次性刷屏。
 * - 聚合：一轮抓取（六源并行 handler）内的所有命中先进 buffer，windowMs 后
 *   合并成一条通知——「命中 N 条」，不逐条弹。
 */
import type { MethodHandler } from 'dsh-rss-news-daily';
export interface AlertStore {
    keywords(): string[];
    setKeywords(kws: string[]): void;
}
/** 关键字解析：空白/中英文逗号顿号分隔，去重、小写化比较由调用方做；上限 20 个、单条 30 字。 */
export declare function parseKeywords(input: string | string[]): string[];
/** 文本命中了哪些关键字（大小写不敏感、子串匹配；返回原始关键字供展示）。 */
export declare function matchKeywords(text: string, kws: string[]): string[];
export declare function openAlertStore(dir?: string): AlertStore;
export interface AlertHit {
    src: string;
    title: string;
    kws: string[];
}
export interface Alerter {
    /** 包装一个 MethodHandler：抓取成功后做新条目匹配（失败静默——告警不挡抓取）。 */
    wrap(h: MethodHandler): MethodHandler;
    dispose(): void;
}
export declare function createAlerter(opts: {
    store: AlertStore;
    notify: (title: string, body: string, path?: string) => void;
    log?: {
        warn(msg: string): void;
        info?(msg: string): void;
    };
    windowMs?: number;
}): Alerter;
//# sourceMappingURL=alerts.d.ts.map