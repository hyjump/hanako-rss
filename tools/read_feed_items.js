import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "read_feed_items";
export const description = "Read recent items from one feed or across all feeds.";
export const parameters = {
  type: "object",
  properties: {
    feedId: { type: "string", description: "Optional feed ID filter" },
    limit: { type: "number", description: "Maximum number of items to return" },
    unreadOnly: { type: "boolean", description: "Only return unread items" },
  },
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).readFeedItems(input));
  } catch (error) {
    return toToolError(error, { action: "read_feed_items" });
  }
}
