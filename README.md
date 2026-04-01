# hanako-rss

`hanako-rss` 是一个面向 OpenHanako 的 **community plugin**，用于在 Hanako 中管理 RSS / Atom 订阅，并把这些能力暴露给 agent 调用。

设计目标：

- **MVP 优先**：能装、能用、好维护
- **默认 restricted plugin**：不需要 `full-access`
- **不做前端 UI / routes / provider / extensions**
- **全部状态写入 `ctx.dataDir`**
- **兼容 RSS 2.0、Atom、OPML**
- **支持 ETag / Last-Modified 增量刷新**
- **无外部数据库依赖**

> 运行时依赖使用 [`fast-xml-parser` 5.5.9](https://www.npmjs.com/package/fast-xml-parser)。
>
> 该版本是我在 **2026-03-31** 通过 npm registry 确认的 latest 版本。

---

## 安装方法

### 方式 1：作为源码插件开发/调试

先在插件目录安装依赖：

```bash
cd hanako-rss
npm install --omit=dev
```

然后把整个 `hanako-rss/` 文件夹拖入 Hanako：

- Hanako → 设置 → 插件
- 拖拽 `hanako-rss/` 文件夹，或先压成 zip 再拖入

### 方式 2：做成可直接拖拽安装的发布包

如果你要给别人分发，建议这样准备：

1. 进入 `hanako-rss/`
2. 执行 `npm install --omit=dev`
3. 将 **包含 `node_modules/` 的整个目录** 压缩成 zip
4. 在 Hanako 的“设置 → 插件”页面拖入该 zip

> OpenHanako 当前插件管理器会直接复制插件目录，不会自动执行 `npm install`。因此要想实现“拖拽即装”，发布包里需要带上运行时依赖。

### 方式 3：一键生成 release zip（推荐）

插件内置了打包脚本，会在**临时 staging 目录**里安装运行时依赖，然后生成可直接拖拽安装的 zip，不会污染你当前源码目录。

WSL / Linux 下：

```bash
cd /path/to/hanako-rss
python3 ./scripts/package_release.py
```

如果你想在打包前顺手做一次 smoke 校验：

```bash
python3 ./scripts/package_release.py --smoke
```

也可以通过 `package.json` 的脚本入口运行：

```bash
npm run package-release
npm run package-release:smoke
```

打包结果默认输出到：

```text
dist/hanako-rss-0.1.0.zip
dist/hanako-rss-0.1.0.sha256.txt
```

脚本行为：

- 复制插件源码到临时目录
- 在临时目录内执行 `npm install --omit=dev --ignore-scripts`
- 可选执行 `tests/smoke.mjs`
- 生成带根目录 `hanako-rss/` 的发布 zip

> 说明：在当前这种 **Windows + WSL** 混合环境里，脚本会优先复用 **Windows 侧的 `npm.cmd` / `node`** 来完成 staging 安装与 smoke 测试。若你的插件目录位于 **Windows 路径含空格** 的位置，建议先移动到不含空格的目录再打包。

这样生成的 zip 可以直接拖进 Hanako 的“设置 → 插件”页面安装。

---

## 目录结构

```text
hanako-rss/
├── manifest.json
├── package.json
├── README.md
├── lib/
│   ├── command-runtime.js
│   ├── constants.js
│   ├── data-store.js
│   ├── errors.js
│   ├── fetch.js
│   ├── opml.js
│   ├── parser.js
│   ├── rss-service.js
│   ├── settings.js
│   ├── tool-output.js
│   ├── utils.js
│   └── storage/
│       └── json-store.js
├── tools/
│   ├── feeds.js
│   ├── items.js
│   ├── sync.js
│   └── opml.js
├── commands/
│   ├── rss-add.js
│   ├── rss-list.js
│   ├── rss-refresh.js
│   ├── rss-unread.js
│   └── rss-remove.js
├── skills/
│   └── rss-manager/
│       └── SKILL.md
├── fixtures/
│   ├── sample-rss.xml
│   ├── sample-atom.xml
│   └── sample.opml
└── tests/
    └── smoke.mjs
```

---

## 工具（tools）

> Hanako 会根据插件规范自动给工具加命名空间；这里 **只导出裸 tool name**，不硬编码完整调用名。

这版插件把 agent-facing tools 从 14 个收敛成 4 个，减少上下文占用，同时保留原有 service 层逻辑。

- `feeds`：添加、列出、更新、删除 feed，或启用 / 禁用 feed
- `items`：列出未读 / 最近条目，或标记 item / feed 已读
- `sync`：刷新一个 feed 或全部 feed
- `opml`：导入或导出 OPML

### `feeds`

- `action=add`：通过 URL 添加 RSS / Atom feed，并立刻抓取一次
- `action=list`：列出 feed，附带未读数、最近刷新状态
- `action=update`：修改 feed 元信息
- `action=remove`：删除 feed，并可删除其缓存条目
- `action=set_enabled`：启用或禁用 feed

### `items`

- `action=list, mode=unread`：查看未读条目
- `action=list, mode=recent`：查看最近条目
- `action=mark, targetType=item`：标记单条已读 / 未读
- `action=mark, targetType=feed`：标记某个 feed 全部已读 / 未读

### `sync`

- `scope=one`：刷新单个 feed
- `scope=all`：刷新全部 feed

### `opml`

- `action=import`：导入 OPML
- `action=export`：导出 OPML 到文件

---

## 命令（commands）

- `/rss-add <url>`：添加 feed
- `/rss-list`：列出订阅
- `/rss-refresh [feedId]`：刷新一个 feed 或全部 feed
- `/rss-unread [feedId]`：查看未读条目
- `/rss-remove <feedId>`：删除订阅

> 这些命令文件已按 OpenHanako 文档中的命令接口实现。当前它们通过标准 Hanako 目录结构推导插件数据目录，适合默认安装布局。

---

## 数据文件格式

所有状态都保存在插件私有目录 `ctx.dataDir` 中。

### `feeds.json`

结构示例：

```json
{
  "version": 1,
  "updatedAt": "2026-03-31T10:00:00.000Z",
  "feeds": [
    {
      "id": "feed_1234567890ab",
      "url": "https://example.com/feed.xml",
      "title": "Example Feed",
      "siteUrl": "https://example.com/",
      "description": "Example description",
      "etag": "\"abc\"",
      "lastModified": "Tue, 31 Mar 2026 10:00:00 GMT",
      "enabled": true,
      "lastFetchedAt": "2026-03-31T10:00:00.000Z",
      "lastSuccessAt": "2026-03-31T10:00:00.000Z",
      "lastError": null,
      "raw": {
        "format": "rss"
      }
    }
  ]
}
```

### `items.json`

结构示例：

```json
{
  "version": 1,
  "updatedAt": "2026-03-31T10:00:00.000Z",
  "items": [
    {
      "id": "item_abcdef1234567890",
      "feedId": "feed_1234567890ab",
      "title": "Hello World",
      "link": "https://example.com/post/1",
      "summary": "Short summary",
      "contentSnippet": "Longer plain-text snippet",
      "publishedAt": "2026-03-31T09:00:00.000Z",
      "author": "Alice",
      "guid": "post-1",
      "read": false,
      "fetchedAt": "2026-03-31T10:00:00.000Z",
      "dedupeKey": "guid:post-1",
      "raw": {
        "format": "rss"
      }
    }
  ]
}
```

### 去重策略

内部去重键优先级：

1. `guid`
2. Atom `id`
3. `link`
4. `title + publishedAt` 的 hash

插件会在 **同一 feed 内** 做增量去重；已有条目不会重复入库。

---

## 设计说明

### 1. 存储层

`lib/storage/json-store.js` 提供：

- JSON 原子写入（先写临时文件，再 rename）
- 文件初始化
- 简单的按 `dataDir` 串行锁，避免并发写坏数据

### 2. 抓取层

`lib/fetch.js` 封装：

- `fetch`
- 超时控制
- `User-Agent`
- `If-None-Match` / `If-Modified-Since`
- 错误分类（HTTP、超时、网络）

### 3. 解析层

`lib/parser.js` 负责：

- RSS / Atom XML 解析
- RSS / Atom 统一归一化
- OPML 解析
- 日期格式归一
- HTML/summary 清洗为纯文本片段

### 4. 服务层

`lib/rss-service.js` 负责：

- 订阅增删改查
- 刷新与增量入库
- 未读统计
- OPML 导入导出

### 5. 工具层

`tools/*.js` 只做两件事：

- 调用 service
- 把结果包装成对 LLM 友好的结构化 JSON 文本

---

## 与 Hanako 的定时任务配合

Hanako 可以用 cron / heartbeat 定期触发 agent。你可以在 agent 的自动任务里明确写：

> 定时调用 `sync(scope=all)`，然后检查 `items(action=list, mode=unread)` 是否有新内容，再按需要整理摘要。

例如一个简单策略：

1. 每小时运行一次
2. 调用 `sync` 且 `scope=all`
3. 若失败 feed 存在，则记录错误摘要
4. 若未读条目 > 0，再继续阅读或总结

这样就能把 RSS 拉取能力变成 Hanako 的“后台巡检”能力。

---

## 基本测试 / fixtures

仓库已附带：

- `fixtures/sample-rss.xml`
- `fixtures/sample-atom.xml`
- `fixtures/sample.opml`
- `tests/smoke.mjs`

本地安装依赖后可运行：

```bash
npm run smoke
```

`smoke.mjs` 会：

- 解析 RSS / Atom / OPML fixtures
- 启动一个本地 HTTP server
- 测试 `addFeed` / `refreshFeed` / `listUnreadItems` / `exportOpml`
- 覆盖 304 增量刷新路径

---

## 最小使用示例

### 作为 agent 工具使用

1. 调用 `feeds` 且 `action=list`
2. 若没有订阅，则调用 `feeds` 且 `action=add`
3. 再调用 `sync` 刷新一个或全部 feed
4. 用 `items` 且 `action=list` 获取未读或最近条目
5. 读完后用 `items` 且 `action=mark` 更新阅读状态

示例：

```json
{
  "tool": "feeds",
  "input": {
    "action": "add",
    "url": "https://example.com/feed.xml"
  }
}
```

### 作为 OPML 导入使用

```json
{
  "tool": "opml",
  "input": {
    "action": "import",
    "filePath": "/absolute/path/to/subscriptions.opml",
    "refreshAfterImport": true
  }
}
```

### 作为导出使用

```json
{
  "tool": "opml",
  "input": {
    "action": "export"
  }
}
```

返回结果里会包含导出的 `filePath`。
