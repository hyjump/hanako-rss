import fs from "fs";
import os from "os";
import path from "path";
import { PLUGIN_ID } from "./constants.js";
import { createRssService } from "./rss-service.js";

function hasDirectory(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export function resolvePluginDataDirFromCommand(cmdCtx = {}) {
  const explicitDataDir = process.env.HANAKO_PLUGIN_DATA_DIR;
  if (explicitDataDir) {
    return explicitDataDir;
  }

  if (cmdCtx.sessionPath) {
    const sessionPath = path.resolve(cmdCtx.sessionPath);
    const segments = sessionPath.split(path.sep);
    const agentsIndex = segments.lastIndexOf("agents");
    if (agentsIndex > 0) {
      const baseDir = segments.slice(0, agentsIndex).join(path.sep) || path.sep;
      return path.join(baseDir, "plugin-data", PLUGIN_ID);
    }
  }

  const home = os.homedir();
  const candidates = [
    path.join(home, ".hanako-dev", "plugin-data", PLUGIN_ID),
    path.join(home, ".hanako", "plugin-data", PLUGIN_ID),
  ];

  return candidates.find(hasDirectory) || candidates[0];
}

export function createCommandService(cmdCtx = {}) {
  const ctx = {
    pluginId: PLUGIN_ID,
    dataDir: resolvePluginDataDirFromCommand(cmdCtx),
    config: cmdCtx.config || { get: () => undefined, set: () => undefined },
    bus: cmdCtx.bus,
    log: cmdCtx.log || console,
    agentId: cmdCtx.agentId || null,
  };

  return createRssService(ctx);
}
