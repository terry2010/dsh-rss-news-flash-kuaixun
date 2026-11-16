/**
 * 新浪财经 7×24：GET zhibo.sina.com.cn/api/zhibo/feed。
 * 量大噪音大——is_top/tag 可做底流过滤（当前全量进池，去重管线收口）。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.6（实测 200）。
 */
import type { MethodHandler } from 'dsh-rss-news-daily';
import { type Bf } from '../transport.js';
export declare const sina: (bf: Bf) => MethodHandler;
//# sourceMappingURL=sina.d.ts.map