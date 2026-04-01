import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "mark_item_read";
export const description = "Mark one cached feed item as read (or unread).";
export const parameters = {
  type: "object",
  properties: {
    itemId: { type: "string", description: "Item ID" },
    read: { type: "boolean", description: "Set to false to mark the item unread again" },
  },
  required: ["itemId"],
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).markItemRead(input));
  } catch (error) {
    return toToolError(error, { action: "mark_item_read" });
  }
}
