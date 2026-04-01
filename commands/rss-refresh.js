import { createCommandService } from "../lib/command-runtime.js";

export const name = "rss-refresh";
export const description = "Refresh one feed or all feeds: /rss-refresh [feedId]";

export async function execute(args, cmdCtx) {
  const feedId = String(args || "").trim();
  const service = createCommandService(cmdCtx);
  if (!feedId) {
    const result = await service.refreshAllFeeds({});
    return `已刷新 ${result.succeededCount}/${result.requestedCount} 个 feed，失败 ${result.failedCount} 个。`;
  }

  const result = await service.refreshFeed({ feedId });
  return `${result.feed.title} 刷新完成：状态=${result.refresh.status}，新增 ${result.refresh.insertedCount || 0} 条。`;
}
