---
name: rss-manager
description: 用 hanako-rss 管理 RSS / Atom feeds、条目和 OPML。
---
# Hanako RSS 管理技能

用户要管理 RSS / Atom 时，优先使用这 4 个工具：

- `feeds`：添加、列出、更新、删除 feed，或启用 / 禁用 feed
- `items`：列出未读 / 最近条目，或标记 item / feed 已读
- `sync`：刷新一个 feed 或全部 feed
- `opml`：导入或导出 OPML

推荐顺序：

1. 先 `feeds(action=list)` 看现状
2. 需要新内容时先 `sync`
3. 再用 `items(action=list)` 读取结果
4. 只有在用户明确要求时才调用 `items(action=mark)` 改读状态
