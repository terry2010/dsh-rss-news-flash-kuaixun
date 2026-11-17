/**
 * 金十数据：GET flash-api.jin10.com/get_flash_list，需 x-app-id 头。
 * x-app-id 自助提取：jin10.com 首页 → index.*.js bundle → "x-app-id":"…"，kv 缓存失效重提。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.2（实测 200）。
 */
import type { MethodHandler } from 'dsh-rss-news-daily';
import { type Bf } from '../transport.js';
interface J10Data {
    content?: string;
    source_link?: string;
    link?: string;
    title?: string;
    tag?: string;
    pic?: string;
    lock?: boolean;
    exclusive_to?: string[];
    vip_title?: string;
    vip_desc?: string;
    country?: string;
    name?: string;
    dataname?: string;
    actual?: number | string | null;
    consensus?: number | string | null;
    previous?: number | string | null;
    revision?: number | string | null;
    unit?: string;
}
interface J10Item {
    id: string;
    time: string;
    type?: number;
    important?: number;
    channel?: number[];
    extras?: {
        ad?: boolean;
    };
    data?: J10Data;
}
/** 各形态条目 → 展示文本。导出给测试 */
export declare function j10Text(i: J10Item): {
    title: string;
    content: string;
    tag?: string;
};
export declare const jin10: (bf: Bf) => MethodHandler;
export {};
//# sourceMappingURL=jin10.d.ts.map