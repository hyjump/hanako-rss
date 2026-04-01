import { RssPluginError } from "../lib/errors.js";
import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "items";
export const description = "List or mark feed items.";
export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "mark"],
    },
    mode: {
      type: "string",
      enum: ["unread", "recent"],
    },
    targetType: {
      type: "string",
      enum: ["item", "feed"],
    },
    itemId: { type: "string" },
    feedId: { type: "string" },
    limit: { type: "number" },
    read: { type: "boolean" },
    unreadOnly: { type: "boolean" },
  },
  required: ["action"],
};

export async function execute(input = {}, ctx) {
  const service = createRssService(ctx);

  try {
    switch (input.action) {
      case "list":
        if (!input.mode) {
          throw new RssPluginError("mode is required when action=list.", { code: "MISSING_MODE" });
        }
        if (input.mode === "unread") {
          return toToolResult(await service.listUnreadItems({ feedId: input.feedId, limit: input.limit }));
        }
        if (input.mode === "recent") {
          return toToolResult(await service.readFeedItems({
            feedId: input.feedId,
            limit: input.limit,
            unreadOnly: input.unreadOnly === true,
          }));
        }
        throw new RssPluginError("Unsupported mode for items list.", {
          code: "INVALID_MODE",
          details: { mode: input.mode },
        });
      case "mark":
        if (!input.targetType) {
          throw new RssPluginError("targetType is required when action=mark.", { code: "MISSING_TARGET_TYPE" });
        }
        if (input.targetType === "item") {
          if (!input.itemId) {
            throw new RssPluginError("itemId is required when targetType=item.", { code: "MISSING_ITEM_ID" });
          }
          return toToolResult(await service.markItemRead({ itemId: input.itemId, read: input.read }));
        }
        if (input.targetType === "feed") {
          if (!input.feedId) {
            throw new RssPluginError("feedId is required when targetType=feed.", { code: "MISSING_FEED_ID" });
          }
          return toToolResult(await service.markFeedRead({ feedId: input.feedId, read: input.read }));
        }
        throw new RssPluginError("Unsupported targetType for items mark.", {
          code: "INVALID_TARGET_TYPE",
          details: { targetType: input.targetType },
        });
      default:
        throw new RssPluginError("Unsupported action for items.", {
          code: "INVALID_ACTION",
          details: { action: input.action },
        });
    }
  } catch (error) {
    return toToolError(error, { action: "items", requestedAction: input.action || null });
  }
}
