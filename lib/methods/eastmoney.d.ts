/**
 * 东方财富 7×24：GET newsapi.eastmoney.com/kuaixun/v1/getlist_102_ajaxResult_50_1_.html
 * 返回 'var ajaxResult={...}' JS 前缀，剥壳后 LivesList[]。裸调即通。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.4（实测秒回）。
 */
import type { MethodHandler } from 'dsh-rss-news-daily';
import { type Bf } from '../transport.js';
export declare const eastmoney: (bf: Bf) => MethodHandler;
//# sourceMappingURL=eastmoney.d.ts.map