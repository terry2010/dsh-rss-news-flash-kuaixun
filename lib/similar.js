/**
 * 标题相似度：与 web/index.html 聚类同一套算法——
 * 归一化（去【】/[] 前后缀、标点空白）→ bigram → Dice。
 * 长标题 ≥0.55 即判同；归一化后 <8 字的短标题收紧到 0.72，防泛词误判。
 * 后端「多源快讯」提醒用它判断新条目是否已被其它源报道。
 */
const normTitle = (t) => (t || '').toLowerCase()
    .replace(/【[^】]*】|\[[^\]]*\]|（[^）]*）|\([^)]*\)/g, ' ')
    .replace(/[\s"'“”‘’《》「」『』:：;；,，.。!！?？、·\-—_~|/\\+*=&%$#@^<>]+/g, '');
const bigrams = (s) => {
    const m = new Set();
    for (let i = 0; i + 1 < s.length; i++)
        m.add(s.slice(i, i + 2));
    return m;
};
const SIM_LOOSE = 0.55, SIM_SHORT = 0.72, SHORT_LEN = 8;
const dice = (a, b) => {
    if (!a.size || !b.size)
        return 0;
    let n = 0;
    for (const x of a)
        if (b.has(x))
            n++;
    return (2 * n) / (a.size + b.size);
};
/** 两条标题是否像同一事件（跨源多报）。 */
export function similarTitle(a, b) {
    const na = normTitle(a), nb = normTitle(b);
    if (!na || !nb)
        return false;
    const th = Math.min(na.length, nb.length) < SHORT_LEN ? SIM_SHORT : SIM_LOOSE;
    return dice(bigrams(na), bigrams(nb)) >= th;
}
//# sourceMappingURL=similar.js.map