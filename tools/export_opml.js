import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "export_opml";
export const description = "Export subscriptions to an OPML file inside the plugin data directory or a user-provided path.";
export const parameters = {
  type: "object",
  properties: {
    includeDisabled: { type: "boolean", description: "Include disabled feeds in the exported OPML file" },
    title: { type: "string", description: "Optional OPML document title" },
    filePath: { type: "string", description: "Optional output file path" },
  },
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).exportOpml(input));
  } catch (error) {
    return toToolError(error, { action: "export_opml" });
  }
}
