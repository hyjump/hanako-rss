import { RssPluginError } from "../lib/errors.js";
import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "sync";
export const description = "Refresh one or all feeds.";
export const parameters = {
  type: "object",
  properties: {
    scope: {
      type: "string",
      enum: ["one", "all"],
    },
    feedId: { type: "string" },
    force: { type: "boolean" },
    includeDisabled: { type: "boolean" },
  },
  required: ["scope"],
};

export async function execute(input = {}, ctx) {
  const service = createRssService(ctx);

  try {
    switch (input.scope) {
      case "one":
        if (!input.feedId) {
          throw new RssPluginError("feedId is required when scope=one.", { code: "MISSING_FEED_ID" });
        }
        return toToolResult(await service.refreshFeed({ feedId: input.feedId, force: input.force === true }));
      case "all":
        return toToolResult(await service.refreshAllFeeds({
          includeDisabled: input.includeDisabled === true,
          force: input.force === true,
        }));
      default:
        throw new RssPluginError("Unsupported scope for sync.", {
          code: "INVALID_SCOPE",
          details: { scope: input.scope },
        });
    }
  } catch (error) {
    return toToolError(error, { action: "sync", requestedScope: input.scope || null });
  }
}
