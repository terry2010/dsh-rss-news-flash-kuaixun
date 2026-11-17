# 待上报：dsh-market toggle 竞态误报「需重启」横幅（未发送）

> 状态：**草稿，未上报**。市场（dshmarket）非本项目组件，且「插件依赖插件」场景罕见——
> 等本项目正式发布后再提。以下为可直接粘贴的 issue 正文，附调查上下文。

## 调查上下文（2026-11-17 实测）

- 环境：dsh-market v1.73.20 / DeepSeek Harness Desktop (Electron, macOS) / profile `desktop`
- 场景：快讯插件（bundle 层，纯 `insert` 行 patch）禁用 → 重启 dsh → 启用
- 结果：插件实际**已热生效**（宿主 profile watcher 回放 manifest 挂载，db 持续写入、
  dep 路由可访问、`GET /dsh-news-kuaixun/api/dep` 返回 `mainPresent:true`），
  但市场横幅「1 项变更需重启 DeepSeek Harness 后生效」整个会话不消失
- 关键证据：`~/.dsh/profiles/desktop/.dsh-market/log.ndjson` 中 enable 序列
  `no loader entry matched` → `re-added to dsh.profile.bundles` → `on ok=true`，
  **无任何 hot-mount 事件**——插件由宿主回放挂活，非市场挂载

---

# Issue 正文（可直接上报）

## 标题

启用「启动时已禁用」的 bundle 插件后误报「1 项变更需重启 DeepSeek Harness 后生效」——toggle 响应的 liveAfter 判定与宿主回放存在竞态

## 环境

- dsh-market v1.73.20
- DeepSeek Harness Desktop（Electron，macOS），profile: desktop
- 复现插件：任意 bundle 层插件（实测 dsh-news-kuaixun，纯 insert 行 bundle patch）

## 复现步骤

1. 在市场里**禁用**一个 bundle 插件
2. **完全退出并重启** dsh（此时该插件未被装载）
3. 在市场里**启用**该插件
4. 观察：插件实际上已经热生效（后端在跑、API 可访问），但页面顶部横幅显示
   「1 项变更需重启 DeepSeek Harness 后生效」，且**整个会话期间不会消失**（刷新页面也还在）

## 期望行为

插件已 live 时不应提示需要重启；或至少后续 activation 复查能自动撤下误报。

## 实际行为与证据

市场自身日志（`~/.dsh/profiles/desktop/.dsh-market/log.ndjson`）显示 enable 的真实路径：

```json
{"event":"toggle","detail":"dsh-news-kuaixun: no loader entry matched"}
{"event":"toggle","detail":"dsh-news-kuaixun: re-added to dsh.profile.bundles, which nothing was composing (#696)"}
{"event":"patch","detail":"enabled row news-kuaixun in cordis.patch.yml"}
{"event":"toggle","detail":"dsh-news-kuaixun: patch layer enabled rows news-kuaixun"}
{"event":"toggle","detail":"dsh-news-kuaixun: on ok=true"}
```

注意三点：

- **`no loader entry matched`**：启动时 patch 行是 `disabled: true`，loader 没有为它建
  entry，`themes.setEntryDisabled(name, false)` 找不到可翻转的对象，返回 false。
- **没有任何 `hot-mount` 事件**：说明 `setPluginEnabled` 里也没走到 `hotMount` 分支，
  实际让插件活过来的是**宿主自己的 profile watcher 回放 manifest/patch 变更**——异步的。
- 但 toggle 响应在 `lib/routes.js` 约 4156 行同步计算：

  ```js
  const liveAfter = liveNow.has(name);
  const restart = !(enabled && reported.state === 'failed')
      && (isCarrier || staleModule || (enabled ? !liveAfter : liveAfter));
  ```

  宿主回放还没落定 → `liveAfter = false` → `restart: true` 回给前端。

- 前端 `client.js` 约 14606 行 `body.restart === true → setToggleRestart(n+1)`，
  计数写入 `sessionStorage` 的 `dshm-restart`（按 bootId 锁定，约 12660-12695 行），
  整个会话无法自我纠正。
- 矛盾点：几分钟后查 `GET /dsh-market/installed`，同一插件的 activation 已是
  `{"state":"live","reasons":["已热加载(bundle patch)/ live via its bundle patch"],"hot":true}`
  ——**activation 判定和横幅互相打架**。

## 根因分析

`liveAfter` 在响应时一次性快照，而「禁用态启动 → loader 无 entry → 只能靠宿主 watcher
回放挂载」这条路径天然晚到几百毫秒。市场的 **install 流程已经意识到这个竞态**：
`routes.js` 约 8090 行有 `hostReplayWaitMs` / `PROFILE_HMR_REPLAY_WAIT_MS` 等待循环
（注释原文 "give a host that replays on its own the time to do it"，#814/#827），
但 **toggle 路径没有复用这段等待**。

## 修复建议（三选一或组合）

**A. toggle 路由补齐回放等待（推荐，对齐 install 路径）**
在计算 `liveAfter` 前，若 `declaresBundle(activeProfileDir, name) &&
liveNames().has(PROFILE_HMR_ENTRY)`，按 `hostReplayWaitMs`（或同一
`PROFILE_HMR_REPLAY_WAIT_MS` 常量）以 ~250ms 间隔短轮询 `liveNames().has(name)`，
落定后再算 `restart`。

**B. 客户端撤下误报**
`pendingRestart` 用最新 `activations` 复查：`activations[name]?.state === 'live'` 的
名字不应计入已锁存的 `toggleRestart`——比如收到 activation 快照时把 live 的名字从
sessionStorage 的计数里剔除。这层兜底也能覆盖其他「慢一拍才 live」的路径。

**C. 服务端补一次延迟复查**
`restart: true` 响应发出后，对该 name 安排一次（如 2s 后）activation 复查并写一条
诊断事件，至少让 Diagnostics/日志里能区分「真需重启」和「回放竞态」。

## 补充

- 该误报只影响 UX，插件功能无损；重启 dsh 后横幅消失（sessionStorage 按 bootId 失效）。
- 如果维护者需要，我可以提供完整的 log.ndjson 片段和当时的 `/dsh-market/installed`
  activation 响应。
