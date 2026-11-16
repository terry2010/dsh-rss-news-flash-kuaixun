/**
 * 快讯独立库：node:sqlite 单文件，与主插件 store.db 完全隔离。
 *
 * - 路径 <主数据目录>/companions/news-kuaixun/kuaixun.db——放主数据目录下是为了
 *   让主插件备份（companions/ 递归打包）与恢复（整体写回）免费覆盖本库。
 * - journal_mode=DELETE：不用 WAL——备份时整文件拷贝即一致快照，无 -wal 伴生。
 * - 检索：LIKE 兜底（条目是一句话级，2 万条内全扫毫秒级）；不引 FTS 同步复杂度。
 */
import type { RawItem } from 'dsh-rss-news-daily';
/** 主插件数据目录解析（与 src/index.ts resolveDataDir 同规则） */
export declare function resolveMainDataDir(): string;
/** 本插件数据目录：主数据目录下的 companions 子目录（备份/恢复通道） */
export declare function resolveDataDir(): string;
export interface StoredItem {
    id: string;
    sourceId: string;
    title: string;
    link: string | null;
    summary: string | null;
    content: string | null;
    publishedAt: string | null;
    fetchedAt: string;
    hot: number;
}
export interface ItemQuery {
    source?: string;
    q?: string;
    after?: string;
    before?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
}
export declare class KxDb {
    private readonly db;
    constructor(dir?: string);
    /** adapter 游标 kv（cls last_time / jin10 appid）：落 meta 表，key 前缀 kv.<srcId>. */
    kv(srcId: string): {
        get(k: string): string | undefined;
        set(k: string, v: string): void;
    };
    /** 每源首跑基线标记：置位前抓到的条目只入库不告警（防装包/加词历史刷屏） */
    baseline(srcId: string): boolean;
    markBaseline(srcId: string): void;
    /** 批量入库；返回真正新插入的行（INSERT OR IGNORE changes>0）——去重+「新条目」判定一体 */
    insert(srcId: string, title: string, items: RawItem[]): StoredItem[];
    private prune;
    /** 列表查询：source 精确 / q LIKE(title+content) / after+before 按 COALESCE(publishedAt,fetchedAt) / 排序 / 分页 */
    query(o: ItemQuery): {
        total: number;
        items: StoredItem[];
    };
    close(): void;
}
//# sourceMappingURL=db.d.ts.map