/**
 * 财联社电报：GET /v1/roll/get_roll_list，参数签名 = md5(sha1(排序 k=v&...))。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.1（实测 errno:0）。
 * 增量注意：last_time 是「向前翻页」游标（返回 last_time 之前的 50 条历史），
 * 不是正向水位——rt=1&last_time=<旧值> 会一路回溯历史。rt=2 实测恒返回最新页，
 * 新条目靠 items.id（cls_<id>）由 db INSERT OR IGNORE 去重。
 */
import type { MethodHandler } from 'dsh-rss-news-daily';
import { type Bf } from '../transport.js';
export declare const cls: (bf: Bf) => MethodHandler;
//# sourceMappingURL=cls.d.ts.map