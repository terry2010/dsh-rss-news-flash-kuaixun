/**
 * 依赖提示：主插件缺席时，在 dsh 应用内弹层指路（每个缺席周期各一次）。
 *
 *  - 安装提醒：装插件起就没见过主插件 → kind='install'
 *  - 移除提醒：主插件曾被 bootstrap 见过（seenMain）、后来缺席 → kind='removal'
 * 每类 flag 只挡「本缺席周期」——markSeenMain 在主插件在场时清空，
 * 禁用/启用主插件的每个循环都会重新激活弹层；主插件在则永不弹。
 *
 * 形态：后端只挂两条 API 路由（webServer 是宿主服务，不依赖 rndSources），
 * 交互全在客户端 lib/client.js 的应用内 modal 里完成——复制走
 * navigator.clipboard（用户手势），链接走 <a target>。后端零 spawn、
 * 零 profile 变更、零剪贴板动作。
 *
 * flag 语义：dismiss POST 落 dep-state.json；弹层出现过且用户任一交互
 * （含「稍后」）即写——客户端只在用户点按钮时才发 dismiss，单纯刷新不算。
 */
export interface DepState {
    seenMain?: boolean;
    installPrompted?: boolean;
    removalPrompted?: boolean;
}
type Log = {
    info(msg: string): void;
    warn(msg: string): void;
};
export declare const DEP_PKG = "dsh-rss-news-daily";
export declare const DEP_SELF = "dsh-rss-news-flash-kuaixun";
export declare const DEP_GITHUB = "https://github.com/terry2010/dsh-rss-news-daily";
/** 卸载调查占位：上线前换成正式表单页（卸载教程 + 卸载原因问卷） */
export declare const DEP_UNINSTALL_URL = "https://baidu.com";
export declare const DEP_BASE = "/dsh-rss-news-flash-kuaixun";
export declare function readDepState(dataDir: string): DepState;
/**
 * bootstrap 里调用：主插件在位 → 记 seenMain 并清两类 prompted。
 * flag 语义是「本缺席周期已弹」而非「一生一次」——主插件每次在场都重置，
 * 之后任一禁用/卸载事件重新激活弹层（装过主插件再卸载的场景必须还能提醒）。
 * undefined 键经 JSON.stringify 自动落盘消失。
 */
export declare function markSeenMain(dataDir?: string): void;
/** 解析自己所在的 profile：~/.dsh/profiles/<name>/node_modules/<self>/… */
export declare function resolveProfile(): {
    dir: string;
    name: string;
} | undefined;
export declare function marketInstalled(profileDir: string): boolean;
interface Req {
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
    url?: string;
}
interface Res {
    writeHead(code: number, headers?: Record<string, string>): void;
    end(body?: string): void;
}
interface WebServerLike {
    register(opts: {
        kind: string;
        path: string;
        handler: (req: Req, res: Res) => void | Promise<void>;
    }): () => void;
}
/**
 * 服务探测。cordis 里 ctx.inject 声明在【子插件 fiber】上——外层 ctx.<svc>
 * 永远抛 without inject（与服务是否在场无关），不能靠属性访问。
 * ctx.reflect.get(name) 是官方无 inject 要求的读法（strict 默认只认 ACTIVE
 * 提供者：禁用/卸载 → undefined）。测试假 ctx 没有 reflect → 退回直接访问。
 */
export declare function hasService(ctx: unknown, name: string): boolean;
export interface DepStatusDeps {
    dataDir: string;
    /** 现场探测服务（默认看捕获的 ctx） */
    mainPresent?: () => boolean;
    /** 启动宽限毫秒数内缺席视为 pending（主插件可能还在 compose 中） */
    pending?: boolean;
    profile?: {
        dir: string;
        name: string;
    };
}
export declare function depStatus(deps: DepStatusDeps): Record<string, unknown>;
/**
 * 挂依赖提示路由（apply 阶段即挂，不依赖 rndSources）：
 *  GET  /dep          → 状态 JSON（跨源页面可读但 JS 拿不到——无 CORS 头）
 *  POST /dep/dismiss  → 写 flag；要求 JSON content-type（非简单请求，
 *                       跨站页面过不了 preflight——天然 CSRF 防护）
 */
/** compose 宽限：主插件可能还没轮到注册，这段时间缺席报 pending 不报 missing */
export declare const DEP_GRACE_MS = 15000;
export declare function mountDepRoutes(ws: WebServerLike, ctx: unknown, log: Log, dataDir: string): () => void;
export {};
//# sourceMappingURL=dep-prompt.d.ts.map