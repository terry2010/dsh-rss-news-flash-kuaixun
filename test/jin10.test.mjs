// jin10：各形态条目 → 展示文本（type0 快讯 / type1 财经数据 / type2 xnews / 锁定 VIP·PLUS）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { j10Text } from '../lib/methods/jin10.js'

test('j10Text: type0 普通快讯', () => {
  const r = j10Text({ id: '1', time: '', type: 0, data: { content: '美联储宣布降息25个基点' } })
  assert.equal(r.title, '美联储宣布降息25个基点')
  assert.equal(r.content, '美联储宣布降息25个基点')
})

test('j10Text: type1 财经数据——结构化字段拼文', () => {
  const r = j10Text({
    id: '1', time: '', type: 1,
    data: { country: '欧元区', name: '11月ZEW经济现况指数', actual: -14.7, consensus: null, previous: -9.8 },
  })
  assert.equal(r.title, '欧元区11月ZEW经济现况指数 公布-14.7，前值-9.8')
  assert.equal(r.content, r.title)
})

test('j10Text: type1 无 name 兜底财经数据', () => {
  const r = j10Text({ id: '1', time: '', type: 1, data: { actual: 100 } })
  assert.equal(r.title, '财经数据 公布100')
})

test('j10Text: 锁定 VIP/PLUS——vip_title 是真标题', () => {
  const v = j10Text({ id: '1', time: '', type: 0, data: { lock: true, exclusive_to: ['vip'], vip_title: '荷银：原油多头撤退', vip_desc: 'VIP专享快讯，解锁直达', content: '' } })
  assert.equal(v.title, '【VIP】荷银：原油多头撤退')
  const p = j10Text({ id: '2', time: '', type: 0, data: { lock: true, exclusive_to: ['plus'], vip_title: '', vip_desc: 'PLUS专享快讯，解锁直达', content: '' } })
  assert.equal(p.title, '【PLUS】PLUS专享快讯，解锁直达')
})

test('j10Text: type2 xnews——data.title 优先 + tag 透出', () => {
  const r = j10Text({ id: '1', time: '', type: 2, data: { title: '黄仁勋离职后首份财报', content: '长文摘要…', tag: '财报前瞻' } })
  assert.equal(r.title, '黄仁勋离职后首份财报')
  assert.equal(r.tag, '财报前瞻')
  assert.equal(r.content, '长文摘要…')
})
