/**
 * 传输层：node fetch 优先，失败自动回落 browserFetch（专用 Chrome 页面内 fetch）。
 * adapter 拿到的返回形态与 MethodCtx.fetch 一致（FetchedDocument | FetchFailure）。
 */
/** node 优先；网络层/WAF 失败自动回落 browser（未装 browserFetch 则纯 node）。 */
export async function getDoc(ctx, bf, domain, url, init) {
    const r = await ctx.fetch(url, ctx.signal, init);
    if (!('error' in r) || !bf)
        return r;
    try {
        const b = await bf.fetch(domain, url, { headers: init?.headers });
        return { url, status: b.status, body: b.body };
    }
    catch {
        return r; // browser 也挂 → 回 node 的原始错误（更准）
    }
}
/** 挑战页/登录墙判定：命中则给域打 auth-required 标（面板「去验证」入口依据）。 */
const CHALLENGE_RE = /captcha|滑块|安全验证|访问验证|challenge|login/i;
export function looksLikeChallenge(body, status) {
    if (status === 401 || status === 403 || status === 429)
        return true;
    return CHALLENGE_RE.test(body.slice(0, 2000));
}
export function markAuth(bf, domain, on = true) {
    bf?.markAuthRequired?.(domain, on);
}
//# sourceMappingURL=transport.js.map