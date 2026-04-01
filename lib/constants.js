export const PLUGIN_ID = "hanako-rss";
export const PLUGIN_VERSION = "0.1.0";

export const DATA_FILES = Object.freeze({
  feeds: "feeds.json",
  items: "items.json",
});

export const DATA_VERSION = 1;

export const DEFAULT_SETTINGS = Object.freeze({
  requestTimeoutMs: 15_000,
  defaultListLimit: 20,
  maxListLimit: 100,
  requestUserAgent: `${PLUGIN_ID}/${PLUGIN_VERSION} (+https://github.com/liliMozi/openhanako)`,
  summaryLength: 280,
  contentSnippetLength: 560,
  exportedOpmlFilePrefix: "subscriptions",
});

export const HTTP_HEADERS = Object.freeze({
  accept: "application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
});
