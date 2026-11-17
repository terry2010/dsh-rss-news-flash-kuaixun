/**
 * 快讯快报：接入主插件快报产线（rndSources apiVersion≥2）。
 *
 * registerBriefType 注册类型 + items 供给器——槽位调度/AI 概括/落盘/
 * 「全部」合并视图/桌面通知全部复用主插件；条目仍自 KxDb 窗口取，不进主库。
 *
 * 评分：快讯自带重要性信号，免 LLM 评分——多源互证 9 > 源原生 hot 8 > 普通 6；
 * minScore=6 全量入选、排序保秩，条数由 maxItems 截。
 * 去重：窗口内同事件聚类（similar.ts 并查集），非代表条挂 dupOf——
 * 快报节的入选过滤直接吃这个字段。
 */
import type { BriefTypeDef, FeedItem, SourceDef } from 'dsh-rss-news-daily';
import type { KxDb } from './db.js';
/** 注册类型定义：六源 URL 即主库语境下的"源 id"（条目 sourceId 存的就是 url） */
export declare function briefDef(srcs: SourceDef[]): BriefTypeDef;
/** 供 registerBriefType opts.items：窗口取数 → 聚类 → FeedItem（主插件只读字段，评分/查重已过） */
export declare function briefItems(db: KxDb, since: string): FeedItem[];
//# sourceMappingURL=brief.d.ts.map