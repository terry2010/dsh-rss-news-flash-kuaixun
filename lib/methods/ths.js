/**
 * 同花顺 7×24：GET news.10jqka.com.cn/tapp/news/push/stock。
 * 裸调偶发挂起——带 Referer + fetcher 超时重试兜底。color=2 为重要。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.5（实测 200）。
 */
import { getDoc, looksLikeChallenge, markAuth } from '../transport.js';
import { stripTags } from './util.js';
import { thsMarket } from '../taxonomy.js';
const DOMAIN = 'news.10jqka.com.cn';
const API = `https://${DOMAIN}/tapp/news/push/stock?page=1&tag=&track=website&pagesize=50`;
export const ths = (bf) => async (src, ctx) => {
    const doc = await getDoc(ctx, bf(), DOMAIN, API, {
        headers: { Referer: `https://${DOMAIN}/` },
        accept: 'application/json',
        preferBrowser: true, // 端点对 dsh node 运行时稳定挂起（tarpit）——browser 优先跳过超时空等
    });
    if ('error' in doc)
        throw new Error(doc.error);
    if (looksLikeChallenge(doc.body, doc.status)) {
        markAuth(bf(), DOMAIN);
        throw new Error(`auth-required: HTTP ${doc.status}`);
    }
    const data = JSON.parse(doc.body);
    const items = data.data?.list ?? [];
    markAuth(bf(), DOMAIN, false);
    return items.map((i) => {
        const id = i.seq ?? i.id ?? '';
        const ctime = typeof i.ctime === 'string' ? Number(i.ctime) : i.ctime;
        const title = stripTags(i.title || i.digest || '').slice(0, 120);
        const names = (i.tags ?? []).map((t) => t.name ?? '').filter(Boolean);
        const entities = (i.tagInfo ?? []).slice(0, 3).map((t) => t.name ?? '').filter(Boolean);
        return {
            id: `ths_${id}`,
            title,
            link: i.url || `https://${DOMAIN}/`,
            content: stripTags(i.digest || i.title || ''),
            publishedAt: ctime ? new Date(ctime * 1000).toISOString() : new Date().toISOString(),
            hot: i.color === 2, // 重要标红
            tags: [...names, ...entities],
            market: thsMarket(names, title),
        };
    }).filter((i) => i.id !== 'ths_');
};
//# sourceMappingURL=ths.js.map