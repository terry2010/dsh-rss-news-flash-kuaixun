/**
 * 金十数据：GET flash-api.jin10.com/get_flash_list，需 x-app-id 头。
 * x-app-id 自助提取：jin10.com 首页 → index.*.js bundle → "x-app-id":"…"，kv 缓存失效重提。
 * 接口/字段见 docs/SOURCES-FLASH-NEWS.md §1.2（实测 200）。
 */
import { getDoc, looksLikeChallenge, markAuth } from '../transport.js';
import { cst, stripTags } from './util.js';
import { jin10Market, jin10TagNames } from '../taxonomy.js';
const DOMAIN = 'flash-api.jin10.com';
const SITE = 'https://www.jin10.com';
const API = `https://${DOMAIN}/get_flash_list?channel=-8200&limit=50`;
/** 各形态条目 → 展示文本。导出给测试 */
export function j10Text(i) {
    const d = i.data ?? {};
    const html = stripTags(d.content ?? '');
    if (d.lock) {
        const tier = d.exclusive_to?.includes('plus') ? 'PLUS' : 'VIP';
        const t = (d.vip_title ?? '').trim();
        const text = `【${tier}】${t || d.vip_desc || '专享快讯'}`;
        return { title: text.slice(0, 120), content: text };
    }
    if (html)
        return { title: (i.type === 2 ? stripTags(d.title ?? '') : '') || html.slice(0, 120), content: html, tag: d.tag };
    if (i.type === 1) {
        const seg = [
            d.actual != null && `公布${d.actual}${d.unit ?? ''}`,
            d.consensus != null && `预期${d.consensus}`,
            d.previous != null && `前值${d.previous}`,
            d.revision != null && `修正${d.revision}`,
        ].filter(Boolean).join('，');
        const head = `${d.country ?? ''}${d.name ?? d.dataname ?? ''}`.trim() || '财经数据';
        const text = seg ? `${head} ${seg}` : head;
        return { title: text.slice(0, 120), content: text };
    }
    return { title: '', content: '' };
}
async function extractAppId(ctx, bf) {
    const cached = ctx.kv.get('appid');
    if (cached)
        return cached;
    const home = await getDoc(ctx, bf(), 'www.jin10.com', `${SITE}/`, { headers: { Referer: SITE } });
    if ('error' in home)
        throw new Error(`jin10 home: ${home.error}`);
    const jsPath = /["']([^"']*index\.[a-zA-Z0-9_-]+\.js)["']/.exec(home.body)?.[1];
    if (!jsPath)
        throw new Error('jin10 appid: index js not found in home page');
    const js = await getDoc(ctx, bf(), 'www.jin10.com', new URL(jsPath, `${SITE}/`).toString(), {});
    if ('error' in js)
        throw new Error(`jin10 bundle: ${js.error}`);
    const id = /"x-app-id"\s*:\s*"([^"]+)"/.exec(js.body)?.[1];
    if (!id)
        throw new Error('jin10 appid: not found in bundle');
    ctx.kv.set('appid', id);
    ctx.log.info(`jin10 x-app-id extracted`);
    return id;
}
async function flashList(ctx, bf, appId) {
    return getDoc(ctx, bf(), DOMAIN, API, {
        headers: {
            'x-app-id': appId,
            'x-version': '1.0.0',
            Referer: `${SITE}/`,
            Origin: SITE,
        },
        accept: 'application/json',
    });
}
export const jin10 = (bf) => async (src, ctx) => {
    let appId = await extractAppId(ctx, bf);
    let doc = appId ? await flashList(ctx, bf, appId) : { url: API, status: 0, error: 'no appid' };
    if (('error' in doc || doc.status !== 200) && ctx.kv.get('appid')) {
        // appid 失效：清缓存重提一次
        ctx.kv.set('appid', '');
        appId = await extractAppId(ctx, bf);
        doc = appId ? await flashList(ctx, bf, appId) : doc;
    }
    if ('error' in doc)
        throw new Error(doc.error);
    if (looksLikeChallenge(doc.body, doc.status)) {
        markAuth(bf(), DOMAIN);
        throw new Error(`auth-required: HTTP ${doc.status}`);
    }
    const data = JSON.parse(doc.body);
    const items = Array.isArray(data.data) ? data.data : [];
    markAuth(bf(), DOMAIN, false);
    return items.filter((i) => !i.extras?.ad).map((i) => {
        const { title, content, tag } = j10Text(i);
        return {
            id: `j10_${i.id}`,
            title,
            // data.link=xnews 长文详情（type2）；source_link=外部原文；兜底=金十自家快讯详情页
            // （官网现跳 flash.jin10.com/detail/<id>，直写新域省一次 301）
            link: i.data?.link || i.data?.source_link || `https://flash.jin10.com/detail/${i.id}`,
            content,
            publishedAt: cst(i.time),
            hot: i.important === 1, // 加红
            tags: [...jin10TagNames(i.channel), ...(tag ? [tag] : [])],
            market: jin10Market(i.channel, title),
        };
    }).filter((i) => i.title !== '');
};
//# sourceMappingURL=jin10.js.map