/**
 * 快讯独立库：node:sqlite 单文件，与主插件 store.db 完全隔离。
 *
 * - 路径 <主数据目录>/companions/news-kuaixun/kuaixun.db——放主数据目录下是为了
 *   让主插件备份（companions/ 递归打包）与恢复（整体写回）免费覆盖本库。
 * - journal_mode=DELETE：不用 WAL——备份时整文件拷贝即一致快照，无 -wal 伴生。
 * - 检索：LIKE 兜底（条目是一句话级，2 万条内全扫毫秒级）；不引 FTS 同步复杂度。
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
/** 主插件数据目录解析（与 src/index.ts resolveDataDir 同规则） */
export function resolveMainDataDir() {
    const home = process.env.DSH_HOME;
    if (home)
        return join(home, 'data', 'rss-news-daily');
    return join(process.env.HOME || '.', '.dsh', 'rss-news-daily');
}
/** 本插件数据目录：主数据目录下的 companions 子目录（备份/恢复通道） */
export function resolveDataDir() {
    return join(resolveMainDataDir(), 'companions', 'news-kuaixun');
}
const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, sourceId TEXT NOT NULL,
  title TEXT NOT NULL, link TEXT, summary TEXT, content TEXT,
  publishedAt TEXT, fetchedAt TEXT NOT NULL, hot INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_items_fetched ON items(fetchedAt);
CREATE INDEX IF NOT EXISTS idx_items_source ON items(sourceId);
CREATE INDEX IF NOT EXISTS idx_items_published ON items(publishedAt);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`;
const MAX_ITEMS = 20_000; // 独立库自管上限：快讯滚动窗口，不进主库配额
const itemKey = (it) => String(it.id ?? it.link ?? it.title);
export class KxDb {
    db;
    constructor(dir = resolveDataDir()) {
        mkdirSync(dir, { recursive: true });
        this.db = new DatabaseSync(join(dir, 'kuaixun.db'));
        this.db.exec('PRAGMA journal_mode = DELETE');
        this.db.exec(SCHEMA);
    }
    /** adapter 游标 kv（cls last_time / jin10 appid）：落 meta 表，key 前缀 kv.<srcId>. */
    kv(srcId) {
        const pk = (k) => `kv.${srcId}.${k}`;
        return {
            get: (k) => this.db.prepare('SELECT value FROM meta WHERE key=?').get(pk(k))?.value,
            set: (k, v) => { this.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(pk(k), v); },
        };
    }
    /** 每源首跑基线标记：置位前抓到的条目只入库不告警（防装包/加词历史刷屏） */
    baseline(srcId) {
        return this.db.prepare('SELECT value FROM meta WHERE key=?').get(`baseline.${srcId}`) !== undefined;
    }
    markBaseline(srcId) {
        this.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(`baseline.${srcId}`, '1');
    }
    /** 批量入库；返回真正新插入的行（INSERT OR IGNORE changes>0）——去重+「新条目」判定一体 */
    insert(srcId, title, items) {
        if (!items.length)
            return [];
        const now = new Date().toISOString();
        const ins = this.db.prepare(`INSERT OR IGNORE INTO items
      (id,sourceId,title,link,summary,content,publishedAt,fetchedAt,hot) VALUES (?,?,?,?,?,?,?,?,?)`);
        const fresh = [];
        this.db.exec('BEGIN');
        try {
            for (const it of items) {
                const r = ins.run(itemKey(it), srcId, (it.title || '').slice(0, 500), it.link ?? null, it.summary ?? null, it.content ?? null, it.publishedAt ?? null, now, it.hot ? 1 : 0);
                if (Number(r.changes) > 0)
                    fresh.push({
                        id: itemKey(it), sourceId: srcId, title: (it.title || '').slice(0, 500),
                        link: it.link ?? null, summary: it.summary ?? null, content: it.content ?? null,
                        publishedAt: it.publishedAt ?? null, fetchedAt: now, hot: it.hot ? 1 : 0,
                    });
            }
            this.db.exec('COMMIT');
        }
        catch (e) {
            this.db.exec('ROLLBACK');
            throw e;
        }
        this.prune();
        return fresh;
    }
    prune() {
        this.db.prepare(`DELETE FROM items WHERE id IN
      (SELECT id FROM items ORDER BY fetchedAt DESC, rowid DESC LIMIT -1 OFFSET ?)`).run(MAX_ITEMS);
    }
    /** 列表查询：source 精确 / q LIKE(title+content) / after+before fetchedAt / 排序 / 分页 */
    query(o) {
        const where = [];
        const args = [];
        if (o.source) {
            where.push('sourceId=?');
            args.push(o.source);
        }
        if (o.q) {
            const like = `%${o.q.replace(/[%_]/g, '')}%`;
            where.push('(title LIKE ? OR content LIKE ?)');
            args.push(like, like);
        }
        if (o.after) {
            where.push('fetchedAt>=?');
            args.push(o.after);
        }
        if (o.before) {
            where.push('fetchedAt<=?');
            args.push(o.before);
        }
        const cond = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const sortCol = o.sort === 'fetched' ? 'fetchedAt' : 'COALESCE(publishedAt, fetchedAt)';
        const total = this.db.prepare(`SELECT COUNT(*) n FROM items ${cond}`).get(...args).n;
        const page = Math.max(1, o.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, o.pageSize ?? 50));
        const rows = this.db.prepare(`SELECT * FROM items ${cond} ORDER BY ${sortCol} DESC, fetchedAt DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize);
        return { total, items: rows };
    }
    close() { this.db.close(); }
}
//# sourceMappingURL=db.js.map