/**
 * 快讯提醒：三通道命中 → 桌面通知（经 rndSources.notify，与时段快报同一通道）。
 *
 * 通道（alerts.json 的 flags 控制，互不影响）：
 *  - keyword  关键字：标题/正文子串命中 alerts.json 里的 keywords
 *  - important 重要：源原生重要标记（财联社红电/金十加红/同花顺标红 → hot）
 *  - multi    多源：同一事件已被其它源报道（similarTitle 判定，findMulti 回调提供）
 *
 * 独立库时代简化了去重：db.insert 的 INSERT OR IGNORE 返回的才是「新条目」，
 * 不再需要 seen-ID kv——库本身就是已见集合。首跑基线由 db.baseline 标记，
 * 置位前抓到的条目只入库不告警（防装包/加词历史刷屏）。
 *
 * 聚合：一轮抓取内的所有命中先进 buffer，windowMs 后合并成一条通知，
 * 按通道分节展示——「重要 N 条 / 多源 N 条 / 关键字「…」N 条」，不逐条弹。
 *
 * alerts.json（dataDir=companions/rss-news-flash-kuaixun，与 kuaixun.db 同目录——
 * 主插件备份 companions/ 时一起带走）：
 *   { keywords: [...], keyword: bool, important: bool, multi: bool }
 * 旧格式只有 keywords 时迁移为 keyword=有词即开，important/multi 默认关。
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
            const keywords = parseKeywords(Array.isArray(j?.keywords) ? j.keywords.join(' ') : '');
            return {
                keywords,
                // 旧文件无 keyword 字段：有词即视为开启（保持旧行为）；新装默认关
                keyword: typeof j?.keyword === 'boolean' ? j.keyword : keywords.length > 0,
                important: j?.important === true,
                multi: j?.multi === true,
            };
        }
        catch {
            return { keywords: [], keyword: false, important: false, multi: false };
        }
    };
    const write = (c) => {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, JSON.stringify(c, null, 2));
    };
    return {
        config: read,
        setKeywords(kws) { const c = read(); c.keywords = kws; write(c); },
        setFlags(f) { const c = read(); Object.assign(c, f); write(c); },
    };
}
export function createAlerter(opts) {
    const windowMs = opts.windowMs ?? 2500;
    const buffer = [];
    let timer;
    const section = (title, hits) => {
        const lines = hits.slice(0, 3).map((h) => `【${h.srcs.join('+')}】${h.title}`);
        if (hits.length > 3)
            lines.push(`…等 ${hits.length} 条`);
        return `${title}\n${lines.join('\n')}`;
    };
    const flush = () => {
        timer = undefined;
        if (!buffer.length)
            return;
        const hits = buffer.splice(0);
        const parts = [];
        const imp = hits.filter((h) => h.kind === 'imp');
        const mul = hits.filter((h) => h.kind === 'multi');
        const kw = hits.filter((h) => h.kind === 'kw');
        if (imp.length)
            parts.push(section(`重要 ${imp.length} 条：`, imp));
        if (mul.length)
            parts.push(section(`多源 ${mul.length} 条：`, mul));
        if (kw.length) {
            const kws = [...new Set(kw.flatMap((h) => (h.detail ?? '').split('、')).filter(Boolean))].join('、');
            parts.push(section(`关键字「${kws}」${kw.length} 条：`, kw));
        }
        try {
            opts.notify('⚡ 快讯提醒', parts.join('\n').slice(0, 600), '/dsh-rss-news-flash-kuaixun/');
        }
        catch (e) {
            opts.log?.warn?.(`alert notify failed: ${e.message}`);
        }
    };
    return {
        check(items) {
            if (!items.length)
                return;
            const cfg = opts.store.config();
            const kwOn = cfg.keyword && cfg.keywords.length > 0;
            if (!kwOn && !cfg.important && !cfg.multi)
                return;
            for (const it of items) {
                const title = (it.title || '').slice(0, 80);
                if (cfg.important && it.hot)
                    buffer.push({ kind: 'imp', title, srcs: [it.src] });
                if (cfg.multi && opts.findMulti) {
                    const others = opts.findMulti(it);
                    if (others.length)
                        buffer.push({ kind: 'multi', title, srcs: [it.src, ...others] });
                }
                if (kwOn) {
                    const hit = matchKeywords(`${it.title ?? ''} ${it.content ?? ''}`, cfg.keywords);
                    if (hit.length)
                        buffer.push({ kind: 'kw', title, srcs: [it.src], detail: hit.join('、') });
                }
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