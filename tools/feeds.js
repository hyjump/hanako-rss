import { RssPluginError } from "../lib/errors.js";
import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "feeds";
export const description = "Manage RSS/Atom feeds.";
export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["add", "list", "update", "remove", "set_enabled"],
    },
    feedId: { type: "string" },
    url: { type: "string" },
    title: { type: "string" },
    siteUrl: { type: "string" },
    description: { type: "string" },
    enabled: { type: "boolean" },
    includeDisabled: { type: "boolean" },
    deleteItems: { type: "boolean" },
  },
  required: ["action"],
};

function buildUpdateInput(input) {
  const payload = { feedId: input.feedId };
  for (const key of ["url", "title", "siteUrl", "description", "enabled"]) {
    if (input[key] !== undefined) {
      payload[key] = input[key];
    }
  }
  return payload;
}

export async function execute(input = {}, ctx) {
  const service = createRssService(ctx);

  try {
    switch (input.action) {
      case "add":
        if (!input.url) {
          throw new RssPluginError("url is required when action=add.", { code: "MISSING_URL" });
        }
        return toToolResult(await service.addFeed({ url: input.url, enabled: input.enabled }));
      case "list":
        return toToolResult(await service.listFeeds({ includeDisabled: input.includeDisabled === true }));
      case "update":
        if (!input.feedId) {
          throw new RssPluginError("feedId is required when action=update.", { code: "MISSING_FEED_ID" });
        }
        return toToolResult(await service.updateFeed(buildUpdateInput(input)));
      case "remove":
        if (!input.feedId) {
          throw new RssPluginError("feedId is required when action=remove.", { code: "MISSING_FEED_ID" });
        }
        return toToolResult(await service.removeFeed({ feedId: input.feedId, deleteItems: input.deleteItems }));
      case "set_enabled":
        if (!input.feedId) {
          throw new RssPluginError("feedId is required when action=set_enabled.", { code: "MISSING_FEED_ID" });
        }
        if (typeof input.enabled !== "boolean") {
          throw new RssPluginError("enabled must be true or false when action=set_enabled.", { code: "MISSING_ENABLED" });
        }
        return toToolResult(
          input.enabled
            ? await service.enableFeed({ feedId: input.feedId })
            : await service.disableFeed({ feedId: input.feedId }),
        );
      default:
        throw new RssPluginError("Unsupported action for feeds.", {
          code: "INVALID_ACTION",
          details: { action: input.action },
        });
    }
  } catch (error) {
    return toToolError(error, { action: "feeds", requestedAction: input.action || null });
  }
}
