import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "add_feed";
export const description = "Add an RSS or Atom feed by URL and immediately fetch its metadata and items.";
export const parameters = {
  type: "object",
  properties: {
    url: { type: "string", description: "RSS or Atom feed URL" },
    enabled: { type: "boolean", description: "Whether the feed should be enabled after adding it" },
  },
  required: ["url"],
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).addFeed(input));
  } catch (error) {
    return toToolError(error, { action: "add_feed" });
  }
}
