import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "list_feeds";
export const description = "List all subscribed feeds with unread counters and recent sync status.";
export const parameters = {
  type: "object",
  properties: {
    includeDisabled: { type: "boolean", description: "Include disabled feeds" },
  },
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).listFeeds(input));
  } catch (error) {
    return toToolError(error, { action: "list_feeds" });
  }
}
