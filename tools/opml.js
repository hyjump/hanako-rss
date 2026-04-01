import { RssPluginError } from "../lib/errors.js";
import { createRssService } from "../lib/rss-service.js";
import { toToolError, toToolResult } from "../lib/tool-output.js";

export const name = "opml";
export const description = "Import or export OPML.";
export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["import", "export"],
    },
    filePath: { type: "string" },
    opmlText: { type: "string" },
    enabled: { type: "boolean" },
    refreshAfterImport: { type: "boolean" },
    includeDisabled: { type: "boolean" },
    title: { type: "string" },
  },
  required: ["action"],
};

export async function execute(input = {}, ctx) {
  const service = createRssService(ctx);

  try {
    switch (input.action) {
      case "import":
        return toToolResult(await service.importOpml({
          filePath: input.filePath,
          opmlText: input.opmlText,
          enabled: input.enabled,
          refreshAfterImport: input.refreshAfterImport,
        }));
      case "export":
        return toToolResult(await service.exportOpml({
          filePath: input.filePath,
          includeDisabled: input.includeDisabled === true,
          title: input.title,
        }));
      default:
        throw new RssPluginError("Unsupported action for opml.", {
          code: "INVALID_ACTION",
          details: { action: input.action },
        });
    }
  } catch (error) {
    return toToolError(error, { action: "opml", requestedAction: input.action || null });
  }
}
