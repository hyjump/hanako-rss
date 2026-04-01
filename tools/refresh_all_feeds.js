import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "refresh_all_feeds";
export const description = "Refresh all enabled feeds sequentially and report success/failure per feed.";
export const parameters = {
  type: "object",
  properties: {
    includeDisabled: { type: "boolean", description: "Also refresh disabled feeds" },
    force: { type: "boolean", description: "Ignore cached ETag / Last-Modified headers for all feeds" },
  },
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).refreshAllFeeds(input));
  } catch (error) {
    return toToolError(error, { action: "refresh_all_feeds" });
  }
}
