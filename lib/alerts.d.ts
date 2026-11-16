/**
 * 快讯提醒：关键字命中 → 桌面通知（经 rndSources.notify，与时段快报同一通道）。
 *
 * 独立库时代简化了去重：db.insert 的 INSERT OR IGNORE 返回的才是「新条目」，
 * 不再需要 seen-ID kv——库本身就是已见集合。首跑基线由 db.baseline 标记，
 * 置位前抓到的条目只入库不告警（防装包/加词历史刷屏）。
 *
 * 聚合：一轮抓取内的所有命中先进 buffer，windowMs 后合并成一条通知——
 * 「命中 N 条」，不逐条弹。
 *
 * 关键词持久化在 <dataDir>/alerts.json（dataDir=companions/news-kuaixun，
 * 与 kuaixun.db 同目录——主插件备份 companions/ 时一起带走）。
 */
export interface AlertStore {
    keywords(): string[];
    setKeywords(kws: string[]): void;
}
/** 关键字解析：空白/中英文逗号顿号分隔，去重；上限 20 个、单条 30 字。 */
export declare function parseKeywords(input: string | string[]): string[];
/** 文本命中了哪些关键字（大小写不敏感、子串匹配；返回原始关键字供展示）。 */
export declare function matchKeywords(text: string, kws: string[]): string[];
export declare function openAlertStore(dir?: string): AlertStore;
export interface AlertHit {
    src: string;
    title: string;
    kws: string[];
}
export interface AlertItem {
    src: string;
    title: string;
    content?: string | null;
}
export interface Alerter {
    /** 对一批「新入库」条目做关键字匹配并入聚合窗口；无关键字直接返回。 */
    check(items: AlertItem[]): void;
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