import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "import_opml";
export const description = "Import subscriptions from OPML text or a local OPML file path.";
export const parameters = {
  type: "object",
  properties: {
    opmlText: { type: "string", description: "Raw OPML text to import" },
    filePath: { type: "string", description: "Local path to an OPML file" },
    enabled: { type: "boolean", description: "Enable imported feeds" },
    refreshAfterImport: { type: "boolean", description: "Fetch each imported feed immediately" },
  },
};

export async function execute(input, ctx) {
  try {
    return toToolResult(await createRssService(ctx).importOpml(input));
  } catch (error) {
    return toToolError(error, { action: "import_opml" });
  }
}
