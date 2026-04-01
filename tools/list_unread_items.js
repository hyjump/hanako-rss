import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "list_unread_items";
export const description = "List unread items globally or from a single feed.";
export const parameters = {
  type: "object",
  properties: {
    feedId: { type: "string", description: "Optional feed ID filter" },
    limit: { type: "number", description: "Maximum number of items to return" },
  },
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).listUnreadItems(input));
  } catch (error) {
    return toToolError(error, { action: "list_unread_items" });
  }
}
