/**
 * 快讯分类归一：两条轴——
 * - tags：源原生栏目/主题/实体名，原样存原样显示（CLS subjects、金十 channel、
 *   见闻 channels、同花顺 tag/tagInfo、新浪 tag；东财 column 无命名不给）
 * - market：归一市场域（A股/港股/美股/商品/外汇/加密/国际/其他），筛选轴
 * 源原生信号优先，不足时标题关键词兜底，最后回源默认值。
 */

import type { RawItem } from 'dsh-rss-news-daily'

export type Market = 'A股' | '港股' | '美股' | '商品' | '外汇' | '加密' | '国际' | '其他'

export const MARKETS: Market[] = ['A股', '港股', '美股', '商品', '外汇', '加密', '国际', '其他']

/** 条目带分类的扩展项——MethodHandler 契约仍是 RawItem[]，扩展字段走结构兼容 */
export interface KxItem extends RawItem {
  tags?: string[]
  market?: Market
}

const PATTERNS: Array<[Market, RegExp]> = [
  ['加密', /比特币|以太坊|加密|稳定币|代币|区块链|BTC|ETH|Solana|SOL币|币安|Coinbase|狗狗币|瑞波|Circle/i],
  ['美股', /美股|纳指|道指|标普|纳斯达克|美联储|美国财政|特朗普|川普|英伟达|特斯拉|苹果|微软|Meta|亚马逊|谷歌|波音|OpenAI|华尔街/],
  ['港股', /港股|恒生|恒指|南向资金|南向通|港交所|香港股市|H股/],
  ['商品', /原油|布伦特|WTI|欧佩克|OPEC|黄金|白银|现货金|现货银|伦敦金|金价|铜价|有色|铁矿|螺纹|焦煤|生猪|棉花|玉米|大豆|棕榈油|天然气|大宗|期货|铂|钯/i],
  ['外汇', /人民币|汇率|美元指数|欧元|日元|英镑|澳元|加元|瑞郎|离岸|在岸|外汇/],
  ['国际', /俄乌|中东|伊朗|以色列|乌克兰|俄罗斯|加沙|红海|朝鲜|欧盟|欧洲|日本|韩国|印度|关税|制裁|地缘|北约|联合国|海外/],
]

/** 标题关键词兜底——各源原生分类不足时按内容猜市场域（顺序即优先级） */
export function marketFromText(text: string, fallback: Market = '其他'): Market {
  for (const [m, re] of PATTERNS) if (re.test(text)) return m
  return fallback
}

/** 金十 channel id → 栏目名/市场（§1.2 文档 1速报/2A股/3商品/5国际 + 4=外汇补齐） */
export const JIN10_CHANNEL: Record<number, string> = { 1: '速报', 2: 'A股', 3: '商品', 4: '外汇', 5: '国际' }
const JIN10_MARKET: Record<number, Market> = { 2: 'A股', 3: '商品', 4: '外汇', 5: '国际' }

export function jin10Market(channels: number[] | undefined, text: string): Market {
  for (const c of channels ?? []) if (JIN10_MARKET[c]) return JIN10_MARKET[c]
  return marketFromText(text, '国际') // 金十主体是全球宏观速报
}

export const jin10TagNames = (channels: number[] | undefined): string[] =>
  (channels ?? []).map((c) => JIN10_CHANNEL[c]).filter(Boolean)

/** 见闻 channel slug → 栏目名/市场 */
export const WSCN_CHANNEL: Record<string, string> = {
  'global-channel': '全球', 'us-stock-channel': '美股', 'hk-stock-channel': '港股',
  'a-stock-channel': 'A股', 'forex-channel': '外汇', 'commodity-channel': '商品',
  'crypto-channel': '加密', 'bond-channel': '债券',
}
const WSCN_MARKET: Record<string, Market> = {
  'us-stock-channel': '美股', 'hk-stock-channel': '港股', 'a-stock-channel': 'A股',
  'forex-channel': '外汇', 'commodity-channel': '商品', 'crypto-channel': '加密',
}

export function wscnMarket(channels: string[] | undefined, text: string): Market {
  for (const c of channels ?? []) if (WSCN_MARKET[c]) return WSCN_MARKET[c]
  return marketFromText(text, '国际')
}

export const wscnTagNames = (channels: string[] | undefined): string[] =>
  (channels ?? []).map((c) => WSCN_CHANNEL[c] ?? c.replace(/-channel$/, '')).filter(Boolean)

/** 财联社 subjects 栏目名 → 市场（subjects 数组里栏目与主题混放，按名称模式判） */
export function clsMarket(subjects: string[], text: string): Market {
  const j = subjects.join(' ')
  if (/美股|美国|美联储|纳指|标普|道指|华尔街/.test(j)) return '美股'
  if (/港股|恒生|沪深港通|南向/.test(j)) return '港股'
  if (/期货|商品|贵金属|黄金|有色|原油|农产品|生猪|橡胶|化工|动力煤|玻璃/.test(j)) return '商品'
  if (/比特币|加密|稳定币|代币|区块链/.test(j)) return '加密'
  if (/环球|国际|海外|俄乌|中东|地缘|欧洲|欧盟|日本|韩国|印度|联合国|北约/.test(j)) return '国际'
  if (subjects.length) return 'A股' // 财联社主体是境内股市电报，subjects 无海外信号即境内
  return marketFromText(text, 'A股')
}

/**
 * 东财 column id → 官方栏目名（官网 kuaixun.js `switch(columns)` 反查 + 实测内容验证；
 * 100=全部/132=海外 是隐藏列不在导航；110–131 是「地区/全球央行/经济数据」三个下拉的分项。
 * 第三方文档（OmniData/eastmoney-cli）的 fastColumn 编号是另一套接口的，勿混。
 */
export const EM_COLUMN: Record<number, string> = {
  100: '全部', 101: '焦点', 102: '7×24', 103: '上市公司', 104: '中国股市', 105: '全球股市',
  106: '商品', 107: '外汇', 108: '债券', 109: '基金',
  110: '中国', 111: '美国', 112: '欧元区', 113: '英国', 114: '日本', 115: '加拿大', 116: '澳洲', 117: '新兴市场',
  118: '中国央行', 119: '美联储', 120: '欧洲央行', 121: '英国央行', 122: '日本央行', 123: '加拿大央行', 124: '澳洲联储',
  125: '中国数据', 126: '美国数据', 127: '欧元区数据', 128: '英国数据', 129: '日本数据', 130: '加拿大数据', 131: '澳洲数据',
  132: '海外',
}

/** column → 市场（103上市公司/108债券跨域不给映射；区域列按属地归） */
const EM_MARKET: Record<number, Market> = {
  104: 'A股', 109: 'A股', 110: 'A股', 118: 'A股', 125: 'A股',
  111: '美股', 119: '美股', 126: '美股',
  106: '商品', 107: '外汇',
  105: '国际', 112: '国际', 113: '国际', 114: '国际', 115: '国际', 116: '国际', 117: '国际',
  120: '国际', 121: '国际', 122: '国际', 123: '国际', 124: '国际',
  127: '国际', 128: '国际', 129: '国际', 130: '国际', 131: '国际', 132: '国际',
}

/** 多列共标时按具体度取：港股/商品/外汇等域 &gt; 美股 &gt; A股 &gt; 国际兜底 */
const EM_PRIORITY: Market[] = ['港股', '商品', '外汇', '美股', '加密', 'A股', '国际', '其他']

export function emMarket(cols: number[], text: string): Market {
  const ms = new Set(cols.map((c) => EM_MARKET[c]).filter((m): m is Market => !!m))
  const hit = EM_PRIORITY.find((m) => ms.has(m))
  return hit ?? marketFromText(text, 'A股')
}

/** tags 用栏目名——滤掉无信息量的汇总列（100全部/102主快讯每条都带） */
export const emTagNames = (cols: number[]): string[] =>
  cols.map((c) => EM_COLUMN[c]).filter((n): n is string => !!n && n !== '全部' && n !== '7×24')

/** 同花顺 tag 名 → 市场（'美股,港股,A股' 市场标签直达） */
export function thsMarket(tagNames: string[], text: string): Market {
  if (tagNames.includes('美股')) return '美股'
  if (tagNames.includes('港股')) return '港股'
  if (tagNames.includes('A股')) return 'A股'
  return marketFromText(text, 'A股')
}

/** 回填兜底：sourceId → 缺省市场（无原生信号的存量条目按标题+源气质估） */
const SRC_FALLBACK: Array<[RegExp, Market]> = [
  [/cls\.cn/, 'A股'], [/jin10/, '国际'], [/awtmt|wallstreetcn/, '国际'],
  [/eastmoney/, 'A股'], [/10jqka/, 'A股'], [/sina/, '国际'],
]

export function marketGuess(sourceId: string, title: string): Market {
  const fb = SRC_FALLBACK.find(([re]) => re.test(sourceId))?.[1] ?? '其他'
  return marketFromText(title, fb)
}
