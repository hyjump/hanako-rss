import { createCommandService } from "../lib/command-runtime.js";

export const name = "rss-remove";
export const description = "Remove a feed: /rss-remove <feedId>";

export async function execute(args, cmdCtx) {
  const feedId = String(args || "").trim();
  if (!feedId) {
    return "用法：/rss-remove <feedId>";
  }

  const result = await createCommandService(cmdCtx).removeFeed({ feedId, deleteItems: true });
  return `已删除订阅：${result.removedFeed.title} (${result.removedFeed.id})。`;
}
