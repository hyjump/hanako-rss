import { DEFAULT_SETTINGS } from "./constants.js";

function readConfigValue(config, key) {
  if (!config || typeof config.get !== "function") {
    return undefined;
  }

  try {
    return config.get(key);
  } catch {
    return undefined;
  }
}

function asBoundedInteger(value, fallback, min, max) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const integerValue = Math.trunc(value);
  if (integerValue < min) {
    return min;
  }
  if (integerValue > max) {
    return max;
  }
  return integerValue;
}

function asNonEmptyString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function getPluginSettings(ctx = {}) {
  const config = ctx.config;

  return {
    requestTimeoutMs: asBoundedInteger(
      readConfigValue(config, "requestTimeoutMs"),
      DEFAULT_SETTINGS.requestTimeoutMs,
      1_000,
      120_000,
    ),
    defaultListLimit: asBoundedInteger(
      readConfigValue(config, "defaultListLimit"),
      DEFAULT_SETTINGS.defaultListLimit,
      1,
      DEFAULT_SETTINGS.maxListLimit,
    ),
    requestUserAgent: asNonEmptyString(
      readConfigValue(config, "requestUserAgent"),
      DEFAULT_SETTINGS.requestUserAgent,
    ),
    maxListLimit: DEFAULT_SETTINGS.maxListLimit,
    summaryLength: DEFAULT_SETTINGS.summaryLength,
    contentSnippetLength: DEFAULT_SETTINGS.contentSnippetLength,
    exportedOpmlFilePrefix: DEFAULT_SETTINGS.exportedOpmlFilePrefix,
  };
}
