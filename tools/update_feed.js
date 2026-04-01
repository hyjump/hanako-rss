import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "update_feed";
export const description = "Update stored feed metadata such as title, source URL, description, or enabled state.";
export const parameters = {
  type: "object",
  properties: {
    feedId: { type: "string", description: "Feed ID" },
    url: { type: "string", description: "Override the stored feed URL" },
    title: { type: "string", description: "Override the stored feed title" },
    siteUrl: { type: "string", description: "Override the feed website URL" },
    description: { type: "string", description: "Override the feed description" },
    enabled: { type: "boolean", description: "Set whether the feed is enabled" },
  },
  required: ["feedId"],
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).updateFeed(input));
  } catch (error) {
    return toToolError(error, { action: "update_feed" });
  }
}
