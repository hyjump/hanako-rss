import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "refresh_feed";
export const description = "Refresh one feed using conditional HTTP requests with ETag and Last-Modified support.";
export const parameters = {
  type: "object",
  properties: {
    feedId: { type: "string", description: "Feed ID" },
    force: { type: "boolean", description: "Ignore cached ETag / Last-Modified headers for this refresh" },
  },
  required: ["feedId"],
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).refreshFeed(input));
  } catch (error) {
    return toToolError(error, { action: "refresh_feed" });
  }
}
