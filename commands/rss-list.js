import { createCommandService } from "../lib/command-runtime.js";

export const name = "rss-list";
export const description = "List current subscriptions: /rss-list";

export async function execute(_args, cmdCtx) {
  const result = await createCommandService(cmdCtx).listFeeds({ includeDisabled: true });
  if (!result.feeds.length) {
    return "当前还没有任何订阅。";
  }

  return result.feeds
    .map((feed) => `- [${feed.enabled ? "on" : "off"}] ${feed.title} (${feed.id}) unread=${feed.unreadCount} url=${feed.url}`)
    .join("\n");
}
