/**
 * 快讯分类归一：两条轴——
 * - tags：源原生栏目/主题/实体名，原样存原样显示（CLS subjects、金十 channel、
 *   见闻 channels、同花顺 tag/tagInfo、新浪 tag；东财 column 无命名不给）
 * - market：归一市场域（A股/港股/美股/商品/外汇/加密/国际/其他），筛选轴
 * 源原生信号优先，不足时标题关键词兜底，最后回源默认值。
 */
export const MARKETS = ['A股', '港股', '美股', '商品', '外汇', '加密', '国际', '其他'];
const PATTERNS = [
    ['加密', /比特币|以太坊|加密|稳定币|代币|区块链|BTC|ETH|Solana|SOL币|币安|Coinbase|狗狗币|瑞波|Circle/i],
    ['美股', /美股|纳指|道指|标普|纳斯达克|美联储|美国财政|特朗普|川普|英伟达|特斯拉|苹果|微软|Meta|亚马逊|谷歌|波音|OpenAI|华尔街/],
    ['港股', /港股|恒生|恒指|南向资金|南向通|港交所|香港股市|H股/],
    ['商品', /原油|布伦特|WTI|欧佩克|OPEC|黄金|白银|现货金|现货银|伦敦金|金价|铜价|有色|铁矿|螺纹|焦煤|生猪|棉花|玉米|大豆|棕榈油|天然气|大宗|期货|铂|钯/i],
    ['外汇', /人民币|汇率|美元指数|欧元|日元|英镑|澳元|加元|瑞郎|离岸|在岸|外汇/],
    ['国际', /俄乌|中东|伊朗|以色列|乌克兰|俄罗斯|加沙|红海|朝鲜|欧盟|欧洲|日本|韩国|印度|关税|制裁|地缘|北约|联合国|海外/],
];
/** 标题关键词兜底——各源原生分类不足时按内容猜市场域（顺序即优先级） */
export function marketFromText(text, fallback = '其他') {
    for (const [m, re] of PATTERNS)
        if (re.test(text))
            return m;
    return fallback;
}
/** 金十 channel id → 栏目名/市场（§1.2 文档 1速报/2A股/3商品/5国际 + 4=外汇补齐） */
export const JIN10_CHANNEL = { 1: '速报', 2: 'A股', 3: '商品', 4: '外汇', 5: '国际' };
const JIN10_MARKET = { 2: 'A股', 3: '商品', 4: '外汇', 5: '国际' };
export function jin10Market(channels, text) {
    for (const c of channels ?? [])
        if (JIN10_MARKET[c])
            return JIN10_MARKET[c];
    return marketFromText(text, '国际'); // 金十主体是全球宏观速报
}
export const jin10TagNames = (channels) => (channels ?? []).map((c) => JIN10_CHANNEL[c]).filter(Boolean);
/** 见闻 channel slug → 栏目名/市场 */
export const WSCN_CHANNEL = {
    'global-channel': '全球', 'us-stock-channel': '美股', 'hk-stock-channel': '港股',
    'a-stock-channel': 'A股', 'forex-channel': '外汇', 'commodity-channel': '商品',
    'crypto-channel': '加密', 'bond-channel': '债券',
};
const WSCN_MARKET = {
    'us-stock-channel': '美股', 'hk-stock-channel': '港股', 'a-stock-channel': 'A股',
    'forex-channel': '外汇', 'commodity-channel': '商品', 'crypto-channel': '加密',
};
export function wscnMarket(channels, text) {
    for (const c of channels ?? [])
        if (WSCN_MARKET[c])
            return WSCN_MARKET[c];
    return marketFromText(text, '国际');
}
export const wscnTagNames = (channels) => (channels ?? []).map((c) => WSCN_CHANNEL[c] ?? c.replace(/-channel$/, '')).filter(Boolean);
/** 财联社 subjects 栏目名 → 市场（subjects 数组里栏目与主题混放，按名称模式判） */
export function clsMarket(subjects, text) {
    const j = subjects.join(' ');
    if (/美股|美国|美联储|纳指|标普|道指|华尔街/.test(j))
        return '美股';
    if (/港股|恒生|沪深港通|南向/.test(j))
        return '港股';
    if (/期货|商品|贵金属|黄金|有色|原油|农产品|生猪|橡胶|化工|动力煤|玻璃/.test(j))
        return '商品';
    if (/比特币|加密|稳定币|代币|区块链/.test(j))
        return '加密';
    if (/环球|国际|海外|俄乌|中东|地缘|欧洲|欧盟|日本|韩国|印度|联合国|北约/.test(j))
        return '国际';
    if (subjects.length)
        return 'A股'; // 财联社主体是境内股市电报，subjects 无海外信号即境内
    return marketFromText(text, 'A股');
}
/** 同花顺 tag 名 → 市场（'美股,港股,A股' 市场标签直达） */
export function thsMarket(tagNames, text) {
    if (tagNames.includes('美股'))
        return '美股';
    if (tagNames.includes('港股'))
        return '港股';
    if (tagNames.includes('A股'))
        return 'A股';
    return marketFromText(text, 'A股');
}
/** 回填兜底：sourceId → 缺省市场（无原生信号的存量条目按标题+源气质估） */
const SRC_FALLBACK = [
    [/cls\.cn/, 'A股'], [/jin10/, '国际'], [/awtmt|wallstreetcn/, '国际'],
    [/eastmoney/, 'A股'], [/10jqka/, 'A股'], [/sina/, '国际'],
];
export function marketGuess(sourceId, title) {
    const fb = SRC_FALLBACK.find(([re]) => re.test(sourceId))?.[1] ?? '其他';
    return marketFromText(title, fb);
}
//# sourceMappingURL=taxonomy.js.map