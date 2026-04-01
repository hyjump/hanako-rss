import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "enable_feed";
export const description = "Enable a feed so refresh_all_feeds will include it.";
export const parameters = {
  type: "object",
  properties: {
    feedId: { type: "string", description: "Feed ID" },
  },
  required: ["feedId"],
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).enableFeed(input));
  } catch (error) {
    return toToolError(error, { action: "enable_feed" });
  }
}
