import { createCommandService } from "../lib/command-runtime.js";

export const name = "rss-add";
export const description = "Add an RSS or Atom feed: /rss-add <url>";

export async function execute(args, cmdCtx) {
  const url = String(args || "").trim();
  if (!url) {
    return "用法：/rss-add <feed-url>";
  }

  const result = await createCommandService(cmdCtx).addFeed({ url });
  const title = result.feed?.title || url;
  if (result.action === "existing") {
    return `Feed 已存在：${title} (${result.feed.id})`;
  }
  return `已添加 feed：${title} (${result.feed.id})，本次抓取新增 ${result.refresh.insertedCount} 条。`;
}
