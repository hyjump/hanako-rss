import { createCommandService } from "../lib/command-runtime.js";

export const name = "rss-unread";
export const description = "List unread items: /rss-unread [feedId]";

export async function execute(args, cmdCtx) {
  const feedId = String(args || "").trim() || undefined;
  const result = await createCommandService(cmdCtx).listUnreadItems({ feedId, limit: 10 });
  if (!result.items.length) {
    return feedId ? `Feed ${feedId} 当前没有未读条目。` : "当前没有未读条目。";
  }

  return result.items
    .map((item) => `- ${item.feedTitle || item.feedId}: ${item.title}${item.link ? ` -> ${item.link}` : ""}`)
    .join("\n");
}
