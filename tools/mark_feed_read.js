import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "mark_feed_read";
export const description = "Mark every cached item from one feed as read (or unread).";
export const parameters = {
  type: "object",
  properties: {
    feedId: { type: "string", description: "Feed ID" },
    read: { type: "boolean", description: "Set to false to mark the entire feed unread again" },
  },
  required: ["feedId"],
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).markFeedRead(input));
  } catch (error) {
    return toToolError(error, { action: "mark_feed_read" });
  }
}
