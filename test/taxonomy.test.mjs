// taxonomy：市场域归一 + 各源原生信号 → market 的判定
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  marketFromText, clsMarket, jin10Market, jin10TagNames,
  wscnMarket, wscnTagNames, thsMarket, marketGuess,
  emMarket, emTagNames, EM_COLUMN,
} from '../lib/taxonomy.js'

test('marketFromText: 标题关键词兜底', () => {
  assert.equal(marketFromText('比特币跌破62000美元'), '加密')
  assert.equal(marketFromText('美联储宣布降息25个基点'), '美股')
  assert.equal(marketFromText('恒生指数收涨1.2%'), '港股')
  assert.equal(marketFromText('现货黄金突破2400美元'), '商品')
  assert.equal(marketFromText('在岸人民币兑美元升破7.10'), '外汇')
  assert.equal(marketFromText('俄乌冲突最新进展'), '国际')
  assert.equal(marketFromText('某公司发布新产品'), '其他')
  assert.equal(marketFromText('普通快讯', 'A股'), 'A股') // fallback 生效
})

test('clsMarket: subjects 原生信号优先于标题', () => {
  assert.equal(clsMarket(['美股动态'], '某公司公告'), '美股')
  assert.equal(clsMarket(['港股动态'], '腾讯公告'), '港股')
  assert.equal(clsMarket(['期货市场情报'], '快讯'), '商品')
  assert.equal(clsMarket(['环球市场情报'], '快讯'), '国际')
  assert.equal(clsMarket(['盘面直播', 'A股资金动向'], '某条'), 'A股') // 无海外信号→境内
  assert.equal(clsMarket([], '比特币暴跌'), '加密') // 无 subjects 走标题
})

test('jin10Market: channel id 映射，无频道走标题', () => {
  assert.equal(jin10Market([2], '某条'), 'A股')
  assert.equal(jin10Market([3], '某条'), '商品')
  assert.equal(jin10Market([4], '某条'), '外汇')
  assert.equal(jin10Market([5], '某条'), '国际')
  assert.equal(jin10Market([1], '比特币大涨'), '加密') // 1=速报无域信号→标题
  assert.deepEqual(jin10TagNames([1, 2, 5]), ['速报', 'A股', '国际'])
  assert.deepEqual(jin10TagNames([99]), []) // 未知 id 不给名
})

test('wscnMarket: channel slug 映射', () => {
  assert.equal(wscnMarket(['us-stock-channel'], '某条'), '美股')
  assert.equal(wscnMarket(['a-stock-channel', 'global-channel'], '某条'), 'A股')
  assert.equal(wscnMarket(['forex-channel'], '某条'), '外汇')
  assert.equal(wscnMarket([], '黄金上涨'), '商品')
  assert.deepEqual(wscnTagNames(['us-stock-channel', 'new-channel']), ['美股', 'new'])
})

test('thsMarket: tag 名直达，缺省 A股', () => {
  assert.equal(thsMarket(['美股', '港股'], '某条'), '美股')
  assert.equal(thsMarket(['港股'], '某条'), '港股')
  assert.equal(thsMarket(['A股'], '某条'), 'A股')
  assert.equal(thsMarket([], '恒指大涨'), '港股')
  assert.equal(thsMarket([], '无信号'), 'A股')
})

test('emMarket/emTagNames: column 对照表（官网 JS 反查）', () => {
  assert.equal(emMarket([100, 102, 104], '某条'), 'A股')   // 中国股市
  assert.equal(emMarket([100, 102, 111], '某条'), '美股')  // 美国
  assert.equal(emMarket([100, 102, 106], '某条'), '商品')
  assert.equal(emMarket([100, 102, 105, 110], '法拍房'), 'A股') // 中国 优先于 全球股市
  assert.equal(emMarket([100, 102, 132, 115], '某条'), '国际') // 海外+加拿大
  assert.equal(emMarket([100, 102], '比特币涨'), '加密')   // 无映射列→标题兜底
  assert.deepEqual(emTagNames([100, 102, 105, 110]), ['全球股市', '中国']) // 滤掉汇总列
  assert.equal(EM_COLUMN[132], '海外')
  assert.equal(EM_COLUMN[119], '美联储')
})

test('marketGuess: 存量回填按源气质+标题', () => {
  assert.equal(marketGuess('https://www.cls.cn/telegraph', '无信号'), 'A股')
  assert.equal(marketGuess('https://www.jin10.com/', '比特币跌'), '加密')
  assert.equal(marketGuess('https://news.10jqka.com.cn/', '恒指跌'), '港股')
  assert.equal(marketGuess('https://unknown.com/', '无信号'), '其他')
})
