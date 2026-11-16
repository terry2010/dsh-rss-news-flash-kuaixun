/**
 * 快讯视图挂载：静态 ticker 页 /dsh-news-kuaixun/。
 * 数据走主插件 /dsh-rss-news-daily/api/items（category=快讯）——本包不另起 JSON API。
 * 与主插件/browser-fetch 同一套 webServer 路由惯例（kind + sameSite 防护）。
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const BASE = '/dsh-news-kuaixun';
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
};
function sameSite(req) {
    return String(req.headers?.['sec-fetch-site'] || '').toLowerCase() !== 'cross-site';
}
async function serveStatic(res, rel) {
    const webDir = join(fileURLToPath(new URL('.', import.meta.url)), 'web');
    const safe = rel.split('?')[0].replace(/^\/+|\.{2,}/g, '') || 'index.html';
    const file = join(webDir, safe);
    try {
        const body = await readFile(file);
        res.statusCode = 200;
        res.setHeader('content-type', MIME[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream');
        res.end(body);
    }
    catch {
        res.statusCode = 404;
        res.end('not found');
    }
}
/** 注册 ticker 页路由；返回 disposer。MOUNT 于 ctx.inject(['webServer']) 内调用。 */
export function mountUi(ws, log) {
    const guard = (fn) => (req, res) => {
        if (!sameSite(req)) {
            res.statusCode = 403;
            res.end('forbidden');
            return Promise.resolve();
        }
        return Promise.resolve(fn(req, res)).catch(() => { res.statusCode = 500; res.end('error'); });
    };
    const disposers = [
        ws.register({ kind: 'exact', path: `${BASE}/`, handler: guard((_q, r) => serveStatic(r, 'index.html')) }),
        ws.register({ kind: 'exact', path: BASE, handler: guard((_q, r) => serveStatic(r, 'index.html')) }),
        ws.register({ kind: 'prefix', path: `${BASE}/web`, handler: guard((q, r) => serveStatic(r, (q.url || '').replace(`${BASE}/web/`, ''))) }),
    ];
    log.info('kuaixun ticker page mounted');
    return () => { for (const d of disposers)
        d(); };
}
//# sourceMappingURL=ui.js.map