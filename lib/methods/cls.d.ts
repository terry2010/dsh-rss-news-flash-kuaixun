/**
 * 财联社电报：GET /v1/roll/get_roll_list，参数签名 = md5(sha1(排序 k=v&...))。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.1（实测 errno:0）。
 * 增量：kv 'last' 记已见最小 ctime 翻页水位。
 */
import type { MethodHandler } from 'dsh-rss-news-daily';
import { type Bf } from '../transport.js';
export declare const cls: (bf: Bf) => MethodHandler;
//# sourceMappingURL=cls.d.ts.map