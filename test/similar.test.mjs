/** similar.ts 单测：跨源同标题判定（与前端聚类同阈值）。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { similarTitle } = await import('../lib/similar.js')

test('similarTitle: 同事件不同源措辞 → 判同', () => {
  assert.equal(similarTitle(
    '【财联社11月16日电】美联储宣布降息25个基点，为2025年首次降息',
    '美联社：美联储降息25基点 2025年首次',
  ), true)
})

test('similarTitle: 不同事件 → 判异', () => {
  assert.equal(similarTitle('比特币跌破62000美元', '英伟达发布新一代AI芯片'), false)
  assert.equal(similarTitle('美联储降息25个基点', '日本央行加息25个基点'), false)
})

test('similarTitle: 短标题收紧阈值，泛词不误并', () => {
  assert.equal(similarTitle('收评', '快讯'), false)
  assert.equal(similarTitle('', ' anything '), false)
})
