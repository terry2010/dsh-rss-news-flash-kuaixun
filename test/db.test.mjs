/** db.ts 单测：入库去重、查询过滤、kv、基线标记。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { KxDb } = await import('../lib/db.js')

const SRC = 'https://www.jin10.com/'
const it = (id, title, extra = {}) => ({ id, title, link: `https://x/${id}`, content: `${title} 正文`, publishedAt: '2026-11-17T01:00:00.000Z', ...extra })

test('db: insert 去重——同 id 二次插入不算新条目', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kx-db-'))
  try {
    const db = new KxDb(dir)
    const a = db.insert(SRC, [it('j1', '第一条'), it('j2', '第二条')])
    assert.equal(a.length, 2)
    const b = db.insert(SRC, [it('j1', '第一条'), it('j3', '第三条')])
    assert.equal(b.length, 1) // j1 重复被 IGNORE，只有 j3 是新的
    assert.equal(b[0].id, 'j3')
    db.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('db: query——source/q/after/before/分页', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kx-db-'))
  try {
    const db = new KxDb(dir)
    db.insert(SRC, [it('j1', '美联储降息'), it('j2', '港股收评')])
    db.insert('https://www.cls.cn/telegraph', [it('c1', '降息预期升温')])
    await new Promise((r) => setTimeout(r, 5)) // fetchedAt 区分度
    db.insert(SRC, [it('j3', '英伟达新品')])

    assert.equal(db.query({}).total, 4)
    assert.equal(db.query({ source: SRC }).total, 3)
    assert.equal(db.query({ q: '降息' }).total, 2) // j1 + c1
    assert.equal(db.query({ source: SRC, q: '降息' }).total, 1)
    const page1 = db.query({ sort: 'fetched', page: 1, pageSize: 2 })
    assert.equal(page1.items.length, 2)
    assert.equal(page1.items[0].id, 'j3') // 最新在前
    db.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('db: kv 持久化 + baseline 标记', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kx-db-'))
  try {
    const db = new KxDb(dir)
    db.kv(SRC).set('last', '12345')
    assert.equal(db.kv(SRC).get('last'), '12345')
    assert.equal(db.kv('other').get('last'), undefined) // 按源隔离
    assert.equal(db.baseline(SRC), false)
    db.markBaseline(SRC)
    assert.equal(db.baseline(SRC), true)
    db.close()
    const db2 = new KxDb(dir) // 重开仍在
    assert.equal(db2.kv(SRC).get('last'), '12345')
    assert.equal(db2.baseline(SRC), true)
    db2.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
