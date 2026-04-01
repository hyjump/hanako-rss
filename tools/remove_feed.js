import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "remove_feed";
export const description = "Remove a feed subscription and optionally delete all cached items from that feed.";
export const parameters = {
  type: "object",
  properties: {
    feedId: { type: "string", description: "Feed ID" },
    deleteItems: { type: "boolean", description: "Whether to also delete stored feed items" },
  },
  required: ["feedId"],
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).removeFeed(input));
  } catch (error) {
    return toToolError(error, { action: "remove_feed" });
  }
}
