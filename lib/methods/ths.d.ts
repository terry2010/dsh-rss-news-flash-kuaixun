/**
 * 同花顺 7×24：GET news.10jqka.com.cn/tapp/news/push/stock。
 * 裸调偶发挂起——带 Referer + fetcher 超时重试兜底。color=2 为重要。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.5（实测 200）。
 */
import type { MethodHandler } from 'dsh-rss-news-daily';
import { type Bf } from '../transport.js';
export declare const ths: (bf: Bf) => MethodHandler;
//# sourceMappingURL=ths.d.ts.map