<p align="center">
  <img src="https://raw.githubusercontent.com/terry2010/dsh-rss-news-flash-kuaixun/master/assets/banner.svg" alt="快讯" width="760">
</p>

# dsh-rss-news-flash-kuaixun

**财经快讯 60 秒一轮直达 dsh 新闻面板——财联社、金十、华尔街见闻等六源聚合，AI 快报与桌面通知开箱即用。**

[![npm version](https://img.shields.io/npm/v/dsh-rss-news-flash-kuaixun)](https://www.npmjs.com/package/dsh-rss-news-flash-kuaixun)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

「快讯」—— [dsh-rss-news-daily](https://github.com/terry2010/dsh-rss-news-daily)（RSS 每日精选）的伴随插件：为主插件注入一条 **60 秒轮询的实时财经快讯流**，并复用主插件的 AI 快报产线、桌面通知与阅读器界面。

> 伴随插件（companion plugin）：不能独立运行，需要主插件 `dsh-rss-news-daily ≥ 1.1.0`（rndSources API v1+；完整功能需 v2+，推荐 v3）。缺失主插件时插件会弹层提示而不会静默失效。

## 功能

- **六源快讯聚合**：财联社电报 / 金十数据 / 华尔街见闻 / 东方财富 / 同花顺 / 新浪财经 7×24，60 秒一轮轻量 JSON 端点轮询，写入本地 SQLite
- **「快讯」阅读器 tab**：经 `registerView` 挂进主插件阅读器，密排时序 ticker 视图，独立于普通订阅列表
- **多源互证标记**：同一条新闻被多个源报道时自动聚类并标注源数——互证越多越重要
- **三通道提醒 + 桌面通知**：关键词命中 / 源标重要 / 多源互证，命中即经主插件通道弹桌面通知并跳快讯页
- **每小时「快讯快报」**：经 `registerBriefType` 注册条目供给器，由主插件的 LLM 产线整点生成 AI 摘要（≤12 条，互证优先）；评分免 LLM——多源互证 9 > 源原生热度 8 > 普通 6
- **数据全本地**：`companions/rss-news-flash-kuaixun/` 下的 `kuaixun.db` / `alerts.json`，随主插件完整备份覆盖

## 安装

```bash
dsh plugin --profile <你的profile> add dsh-rss-news-flash-kuaixun
```

或经 dshmarket 插件市场安装。装完重启 dsh 生效；首次加载若未检测到主插件会弹层指引。

## 依赖

| 依赖 | 说明 |
|---|---|
| `dsh-rss-news-daily ≥ 1.1.0` | 宿主：提供 rndSources 服务（源注册 / 视图注册 / 快报产线 / 桌面通知） |
| Node ≥ 22.18 | dsh 运行环境要求 |

内部标识：cordis entry id 为 `rss-news-flash-kuaixun`（去 `dsh-` 前缀的惯例，同主插件 `rss-news-daily`）；数据目录 `companions/rss-news-flash-kuaixun/`，旧名 `news-kuaixun` 的目录与 provider 源行在首次启动时自动迁移。

<a id="browser-fetch"></a>
## 为什么建议安装 browser-fetch

**一句话：装上它，六个源一个不少；不装，同花顺和金十会悄悄缺席。**

快讯插件平时自己联网就够用。但同花顺和金十比较「挑客户端」——它们只愿意把数据交给一个真正的浏览器，程序直接联网会被晾在一边：要么一直没回应，要么直接报错。

[browser-fetch](https://github.com/terry2010/dsh-rss-news-browser-fetch) 解决的就是这件事：它在你的电脑里起一个**专用的 Chrome**，替你以「正常浏览网页」的方式取这两个源的数据——和你自己点开网页看到的一模一样，只是不用你动手。

**装上之后你会看到什么？**

- 一个独立的 Chrome 窗口会偶尔自己打开、切换标签页——那是它在替你取数，属正常工作状态
- 标签页平时停在各网站的 `robots.txt` 页面上待命，不代表有人在浏览奇怪的页面
- 它的登录状态和你的日常浏览器完全隔离，互不干扰；数据只留在你自己电脑里

**不装可以吗？** 可以。财联社、华尔街见闻、东方财富、新浪四个源照常工作，只是同花顺和金十会一直空着；设置面板顶部会提示你这个状态。哪天想补全，装上插件即可，**零配置**。

<details>
<summary>技术细节（好奇可展开）</summary>

传输层 node fetch 优先、浏览器回落：

| 源 | 直连表现 | 机制 |
|---|---|---|
| 同花顺（10jqka） | node 请求连接挂起（tarpit） | 标记 `preferBrowser`，每轮直接走浏览器通道 |
| 金十（jin10） | 5xx / 网络错误 | node 失败后自动回落 `bf.fetch`；缺席则持续失败、退避拉长轮询 |

浏览器通道请求发自用户本机浏览器会话（同源页内 fetch、自动携带该域 cookie）；若专用 Chrome 被关闭/退出，同花顺与金十断供，其余四源照常。

</details>

```bash
dsh plugin --profile <你的profile> add dsh-rss-news-browser-fetch
```

## 声明

- 本插件仅从各源**公开可访问的端点**读取快讯标题与摘要，全部数据保存在用户本地，不提供转发、再分发或商用数据服务
- 浏览器通道访问的是你本可在浏览器中手动打开的公开页面，请求发自你自己的浏览器会话；请自行确认并遵守目标站点的访问条款
- 快讯原文版权归源站所有，点击条目跳转原站阅读；内容仅供参考，不构成任何投资建议

## 开发

```bash
npm test                                # tsc 构建 + copy-assets + node --test
node scripts/install-to-profile.mjs desktop   # 装进本地 dsh profile 验证（需重启 dsh）
```

开发前需把主插件 clone 到同级目录（devDep `file:` 引用 + 类型契约来源）：

```bash
git clone https://github.com/terry2010/dsh-rss-news-daily ../dsh-rss-news-daily
```

技术栈：TypeScript / cordis / rndSources API v3 / better-sqlite3。主插件接口契约见主仓库 `docs/PLUGINS.md`。

## 相关插件

- **[dsh-rss-news-daily](https://github.com/terry2010/dsh-rss-news-daily)** —— 主插件（必需）：RSS 订阅 + AI 每日精选/时段快报 + 侧栏新闻阅读器，本插件的快报产线/通知/界面均由它提供
- **[dsh-rss-news-browser-fetch](https://github.com/terry2010/dsh-rss-news-browser-fetch)** —— browserFetch 浏览器传输服务（可选）：node fetch 响应不稳定时自动回落用户本机浏览器会话取数

## License

Apache-2.0
