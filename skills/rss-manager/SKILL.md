---
name: rss-manager
description: 在 Hanako 中管理 RSS / Atom 订阅、刷新 feed、查看未读与导入导出 OPML。
---
# Hanako RSS 管理技能

当用户提到以下需求时，优先使用 `hanako-rss` 插件工具：

- 添加、删除、启用、禁用 RSS / Atom 订阅
- 手动刷新某个 feed，或批量刷新所有 feed
- 查看未读条目、阅读某个 feed 的最近内容
- 标记某条或某个 feed 的条目为已读
- 导入 / 导出 OPML 订阅列表

## 推荐工作流

1. **先看现状**：先调用 `list_feeds`，确认 feedId、启用状态、未读数。
2. **需要最新内容时先刷新**：
   - 单个源：`refresh_feed`
   - 批量：`refresh_all_feeds`
3. **阅读时优先结构化输出**：
   - 全局未读：`list_unread_items`
   - 某源最近条目：`read_feed_items`
4. **做状态变更后回显结果**：添加、删除、启用/禁用、标记已读后，都向用户复述关键字段（feed 标题、feedId、条目数）。
5. **批量导入导出**：
   - 导入时优先 `import_opml`
   - 导出时优先 `export_opml`

## 具体建议

- 用户只给网站首页、而不是 feed URL 时，仍可先尝试 `add_feed`；若失败，再明确说明需要可用的 RSS / Atom 链接。
- 用户问“有没有新内容”，应先刷新，再看未读。
- 用户没有明确说“标记已读”时，不要擅自批量改动阅读状态。
- 如果 `refresh_feed` / `refresh_all_feeds` 返回错误，优先把错误信息原样说明，并建议稍后重试或检查 feed URL。
- 导出 OPML 后，告诉用户导出文件路径。
