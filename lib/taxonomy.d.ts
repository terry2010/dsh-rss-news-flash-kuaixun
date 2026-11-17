/**
 * 快讯分类归一：两条轴——
 * - tags：源原生栏目/主题/实体名，原样存原样显示（CLS subjects、金十 channel、
 *   见闻 channels、同花顺 tag/tagInfo、新浪 tag；东财 column 无命名不给）
 * - market：归一市场域（A股/港股/美股/商品/外汇/加密/国际/其他），筛选轴
 * 源原生信号优先，不足时标题关键词兜底，最后回源默认值。
 */
import type { RawItem } from 'dsh-rss-news-daily';
export type Market = 'A股' | '港股' | '美股' | '商品' | '外汇' | '加密' | '国际' | '其他';
export declare const MARKETS: Market[];
/** 条目带分类的扩展项——MethodHandler 契约仍是 RawItem[]，扩展字段走结构兼容 */
export interface KxItem extends RawItem {
    tags?: string[];
    market?: Market;
}
/** 标题关键词兜底——各源原生分类不足时按内容猜市场域（顺序即优先级） */
export declare function marketFromText(text: string, fallback?: Market): Market;
/** 金十 channel id → 栏目名/市场（§1.2 文档 1速报/2A股/3商品/5国际 + 4=外汇补齐） */
export declare const JIN10_CHANNEL: Record<number, string>;
export declare function jin10Market(channels: number[] | undefined, text: string): Market;
export declare const jin10TagNames: (channels: number[] | undefined) => string[];
/** 见闻 channel slug → 栏目名/市场 */
export declare const WSCN_CHANNEL: Record<string, string>;
export declare function wscnMarket(channels: string[] | undefined, text: string): Market;
export declare const wscnTagNames: (channels: string[] | undefined) => string[];
/** 财联社 subjects 栏目名 → 市场（subjects 数组里栏目与主题混放，按名称模式判） */
export declare function clsMarket(subjects: string[], text: string): Market;
/**
 * 东财 column id → 官方栏目名（官网 kuaixun.js `switch(columns)` 反查 + 实测内容验证；
 * 100=全部/132=海外 是隐藏列不在导航；110–131 是「地区/全球央行/经济数据」三个下拉的分项。
 * 第三方文档（OmniData/eastmoney-cli）的 fastColumn 编号是另一套接口的，勿混。
 */
export declare const EM_COLUMN: Record<number, string>;
export declare function emMarket(cols: number[], text: string): Market;
/** tags 用栏目名——滤掉无信息量的汇总列（100全部/102主快讯每条都带） */
export declare const emTagNames: (cols: number[]) => string[];
/** 同花顺 tag 名 → 市场（'美股,港股,A股' 市场标签直达） */
export declare function thsMarket(tagNames: string[], text: string): Market;
export declare function marketGuess(sourceId: string, title: string): Market;
//# sourceMappingURL=taxonomy.d.ts.map