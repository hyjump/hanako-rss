export class RssPluginError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "RssPluginError";
    this.code = options.code || "RSS_PLUGIN_ERROR";
    this.status = options.status || null;
    this.details = options.details || null;
  }
}

export function serializeError(error) {
  if (!error) {
    return {
      name: "Error",
      message: "Unknown error",
      code: "UNKNOWN_ERROR",
      status: null,
      details: null,
    };
  }

  return {
    name: error.name || "Error",
    message: error.message || String(error),
    code: error.code || "UNKNOWN_ERROR",
    status: error.status || null,
    details: error.details || null,
  };
}
