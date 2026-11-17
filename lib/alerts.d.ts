/**
 * 快讯提醒：三通道命中 → 桌面通知（经 rndSources.notify，与时段快报同一通道）。
 *
 * 通道（alerts.json 的 flags 控制，互不影响）：
 *  - keyword  关键字：标题/正文子串命中 alerts.json 里的 keywords
 *  - important 重要：源原生重要标记（财联社红电/金十加红/同花顺标红 → hot）
 *  - multi    多源：同一事件已被其它源报道（similarTitle 判定，findMulti 回调提供）
 *
 * 独立库时代简化了去重：db.insert 的 INSERT OR IGNORE 返回的才是「新条目」，
 * 不再需要 seen-ID kv——库本身就是已见集合。首跑基线由 db.baseline 标记，
 * 置位前抓到的条目只入库不告警（防装包/加词历史刷屏）。
 *
 * 聚合：一轮抓取内的所有命中先进 buffer，windowMs 后合并成一条通知，
 * 按通道分节展示——「重要 N 条 / 多源 N 条 / 关键字「…」N 条」，不逐条弹。
 *
 * alerts.json（dataDir=companions/rss-news-flash-kuaixun，与 kuaixun.db 同目录——
 * 主插件备份 companions/ 时一起带走）：
 *   { keywords: [...], keyword: bool, important: bool, multi: bool }
 * 旧格式只有 keywords 时迁移为 keyword=有词即开，important/multi 默认关。
 */
export interface AlertFlags {
    keyword: boolean;
    important: boolean;
    multi: boolean;
}
export interface AlertConfig extends AlertFlags {
    keywords: string[];
}
export interface AlertStore {
    config(): AlertConfig;
    /** 只写 keywords——开关变化不动词表（用户删词只能自己删）。 */
    setKeywords(kws: string[]): void;
    /** 只写开关——不动词表。 */
    setFlags(f: Partial<AlertFlags>): void;
}
/** 关键字解析：空白/中英文逗号顿号分隔，去重；上限 20 个、单条 30 字。 */
export declare function parseKeywords(input: string | string[]): string[];
/** 文本命中了哪些关键字（大小写不敏感、子串匹配；返回原始关键字供展示）。 */
export declare function matchKeywords(text: string, kws: string[]): string[];
export declare function openAlertStore(dir?: string): AlertStore;
export type AlertKind = 'kw' | 'imp' | 'multi';
export interface AlertHit {
    kind: AlertKind;
    title: string;
    srcs: string[];
    detail?: string;
}
export interface AlertItem {
    src: string;
    sourceId?: string;
    title: string;
    content?: string | null;
    publishedAt?: string | null;
    fetchedAt?: string;
    hot?: boolean;
}
export interface Alerter {
    /** 对一批「新入库」条目做三通道匹配并入聚合窗口。 */
    check(items: AlertItem[]): void;
    dispose(): void;
}
export declare function createAlerter(opts: {
    store: AlertStore;
    notify: (title: string, body: string, path?: string) => void;
    /** 多源检测：返回其它源里报道同一事件的源显示名列表（无则空数组）。 */
    findMulti?: (it: AlertItem) => string[];
    log?: {
        warn(msg: string): void;
        info?(msg: string): void;
    };
    windowMs?: number;
}): Alerter;
//# sourceMappingURL=alerts.d.ts.map