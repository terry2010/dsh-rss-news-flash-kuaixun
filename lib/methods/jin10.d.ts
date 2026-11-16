/**
 * 金十数据：GET flash-api.jin10.com/get_flash_list，需 x-app-id 头。
 * x-app-id 自助提取：jin10.com 首页 → index.*.js bundle → "x-app-id":"…"，kv 缓存失效重提。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.2（实测 200）。
 */
import type { MethodHandler } from 'dsh-rss-news-daily';
import { type Bf } from '../transport.js';
export declare const jin10: (bf: Bf) => MethodHandler;
//# sourceMappingURL=jin10.d.ts.map