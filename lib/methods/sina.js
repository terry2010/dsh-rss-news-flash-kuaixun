/**
 * 新浪财经 7×24：GET zhibo.sina.com.cn/api/zhibo/feed。
 * 量大噪音大——is_top/tag 可做底流过滤（当前全量进池，去重管线收口）。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.6（实测 200）。
 */
import { getDoc, looksLikeChallenge, markAuth } from '../transport.js';
import { cst, stripTags } from './util.js';
const DOMAIN = 'zhibo.sina.com.cn';
const API = `https://${DOMAIN}/api/zhibo/feed?page=1&page_size=50&zhibo_id=152&tag_id=0&type=0`;
export const sina = (bf) => async (src, ctx) => {
    const doc = await getDoc(ctx, bf(), DOMAIN, API, {
        headers: { Referer: 'https://finance.sina.com.cn/7x24/' },
        accept: 'application/json',
    });
    if ('error' in doc)
        throw new Error(doc.error);
    if (looksLikeChallenge(doc.body, doc.status)) {
        markAuth(bf(), DOMAIN);
        throw new Error(`auth-required: HTTP ${doc.status}`);
    }
    const data = JSON.parse(doc.body);
    const items = data.result?.data?.feed?.list ?? [];
    markAuth(bf(), DOMAIN, false);
    return items.map((i) => {
        const text = stripTags(i.rich_text ?? '');
        return {
            id: `sina_${i.id ?? i.docurl ?? i.link ?? text.slice(0, 30)}`,
            title: text.slice(0, 120),
            link: i.docurl || i.link || 'https://finance.sina.com.cn/7x24/',
            content: text,
            publishedAt: i.create_time ? cst(i.create_time) : new Date().toISOString(),
        };
    }).filter((i) => i.title.length > 0);
};
//# sourceMappingURL=sina.js.map