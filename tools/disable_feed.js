import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "disable_feed";
export const description = "Disable a feed without deleting its stored metadata or items.";
export const parameters = {
  type: "object",
  properties: {
    feedId: { type: "string", description: "Feed ID" },
  },
  required: ["feedId"],
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).disableFeed(input));
  } catch (error) {
    return toToolError(error, { action: "disable_feed" });
  }
}
