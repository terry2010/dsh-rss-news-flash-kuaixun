/**
 * 快讯提醒：关键字命中 → 桌面通知（经 rndSources.notify，与时段快报同一通道）。
 *
 * 独立库时代简化了去重：db.insert 的 INSERT OR IGNORE 返回的才是「新条目」，
 * 不再需要 seen-ID kv——库本身就是已见集合。首跑基线由 db.baseline 标记，
 * 置位前抓到的条目只入库不告警（防装包/加词历史刷屏）。
 *
 * 聚合：一轮抓取内的所有命中先进 buffer，windowMs 后合并成一条通知——
 * 「命中 N 条」，不逐条弹。
 *
 * 关键词持久化在 <dataDir>/alerts.json（dataDir=companions/news-kuaixun，
 * 与 kuaixun.db 同目录——主插件备份 companions/ 时一起带走）。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveDataDir } from './db.js';
/** 关键字解析：空白/中英文逗号顿号分隔，去重；上限 20 个、单条 30 字。 */
export function parseKeywords(input) {
    const parts = (Array.isArray(input) ? input.join(' ') : input)
        .split(/[\s,，、;；]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    const seen = new Set();
    const out = [];
    for (const p of parts) {
        const k = p.slice(0, 30);
        const key = k.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(k);
        if (out.length >= 20)
            break;
    }
    return out;
}
/** 文本命中了哪些关键字（大小写不敏感、子串匹配；返回原始关键字供展示）。 */
export function matchKeywords(text, kws) {
    if (!kws.length)
        return [];
    const lower = text.toLowerCase();
    return kws.filter((k) => lower.includes(k.toLowerCase()));
}
export function openAlertStore(dir = resolveDataDir()) {
    const file = join(dir, 'alerts.json');
    // 旧位置 ~/.dsh/news-kuaixun/alerts.json → 迁到 companions 目录（备份通道覆盖）
    const legacy = join(process.env.HOME || '.', '.dsh', 'news-kuaixun', 'alerts.json');
    try {
        if (!existsSync(file) && existsSync(legacy)) {
            mkdirSync(dir, { recursive: true });
            renameSync(legacy, file);
        }
    }
    catch { /* 迁移失败不阻塞——当无配置处理 */ }
    const read = () => {
        try {
            const j = JSON.parse(readFileSync(file, 'utf8'));
            return parseKeywords(Array.isArray(j?.keywords) ? j.keywords.join(' ') : '');
        }
        catch {
            return [];
        }
    };
    return {
        keywords: read,
        setKeywords(kws) {
            mkdirSync(dir, { recursive: true });
            writeFileSync(file, JSON.stringify({ keywords: kws }, null, 2));
        },
    };
}
export function createAlerter(opts) {
    const windowMs = opts.windowMs ?? 2500;
    const buffer = [];
    let timer;
    const flush = () => {
        timer = undefined;
        if (!buffer.length)
            return;
        const hits = buffer.splice(0);
        const kwList = [...new Set(hits.flatMap((h) => h.kws))].join('、');
        const lines = hits.slice(0, 3).map((h) => `【${h.src}】${h.title}`);
        const more = hits.length > 3 ? ` 等 ${hits.length} 条` : '';
        const body = `命中 ${hits.length} 条「${kwList}」：${lines.join('；')}${more}`;
        try {
            opts.notify('⚡ 快讯提醒', body.replace(/\s+/g, ' ').slice(0, 400), '/dsh-news-kuaixun/');
        }
        catch (e) {
            opts.log?.warn?.(`alert notify failed: ${e.message}`);
        }
    };
    return {
        check(items) {
            const kws = opts.store.keywords();
            if (!kws.length || !items.length)
                return;
            for (const it of items) {
                const hit = matchKeywords(`${it.title ?? ''} ${it.content ?? ''}`, kws);
                if (hit.length)
                    buffer.push({ src: it.src, title: (it.title || '').slice(0, 80), kws: hit });
            }
            if (buffer.length && !timer) {
                timer = setTimeout(flush, windowMs);
                timer.unref?.();
            }
        },
        dispose() { if (timer)
            clearTimeout(timer); buffer.length = 0; },
    };
}
//# sourceMappingURL=alerts.js.map