/**
 * 标题相似度：与 web/index.html 聚类同一套算法——
 * 归一化（去【】/[] 前后缀、标点空白）→ bigram → Dice。
 * 长标题 ≥0.55 即判同；归一化后 <8 字的短标题收紧到 0.72，防泛词误判。
 * 后端「多源快讯」提醒用它判断新条目是否已被其它源报道。
 */
/** 两条标题是否像同一事件（跨源多报）。 */
export declare function similarTitle(a: string, b: string): boolean;
/**
 * 窗口内同事件聚类（并查集）——与 web/index.html clusterize 同分组语义、
 * 同阈值同一套归一化/bigram 原语；簇代表由调用方挑（前端 hot>长>晚）。
 */
export declare function clusterTitles<T>(items: T[], titleOf: (it: T) => string): T[][];
//# sourceMappingURL=similar.d.ts.map