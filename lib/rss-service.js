import fs from "fs/promises";
import path from "path";
import { PLUGIN_ID } from "./constants.js";
import { loadFeedsState, loadItemsState, saveFeedsState, saveItemsState } from "./data-store.js";
import { RssPluginError, serializeError } from "./errors.js";
import { fetchFeedDocument } from "./fetch.js";
import { buildOpmlDocument, writeOpmlToFile } from "./opml.js";
import { parseFeedDocument, parseOpmlDocument } from "./parser.js";
import { getPluginSettings } from "./settings.js";
import { withDataLock } from "./storage/json-store.js";
import {
  canonicalizeUrl,
  hashText,
  nowIso,
  sortItemsDescending,
  truncateText,
} from "./utils.js";

function log(ctx, level, ...args) {
  const logger = ctx?.log?.[level];
  if (typeof logger === "function") {
    logger(...args);
  }
}

function makeFeedSummary(feed, itemsState) {
  const feedItems = itemsState.items.filter((item) => item.feedId === feed.id);
  const unreadCount = feedItems.filter((item) => !item.read).length;
  return {
    id: feed.id,
    url: feed.url,
    title: feed.title,
    siteUrl: feed.siteUrl,
    description: feed.description,
    enabled: feed.enabled !== false,
    format: feed.raw?.format || null,
    itemCount: feedItems.length,
    unreadCount,
    etag: feed.etag || null,
    lastModified: feed.lastModified || null,
    lastFetchedAt: feed.lastFetchedAt || null,
    lastSuccessAt: feed.lastSuccessAt || null,
    lastError: feed.lastError || null,
  };
}

function makeItemSummary(item, feedsById) {
  return {
    id: item.id,
    feedId: item.feedId,
    feedTitle: feedsById.get(item.feedId)?.title || null,
    title: item.title,
    link: item.link,
    summary: item.summary,
    contentSnippet: item.contentSnippet,
    publishedAt: item.publishedAt,
    author: item.author,
    guid: item.guid,
    read: item.read,
    fetchedAt: item.fetchedAt,
  };
}

function requireFeed(feedsState, feedId) {
  const feed = feedsState.feeds.find((entry) => entry.id === feedId);
  if (!feed) {
    throw new RssPluginError(`Feed not found: ${feedId}`, { code: "FEED_NOT_FOUND" });
  }
  return feed;
}

function countTotals(feedsState, itemsState) {
  const enabledCount = feedsState.feeds.filter((feed) => feed.enabled !== false).length;
  const unreadCount = itemsState.items.filter((item) => !item.read).length;
  return {
    feedCount: feedsState.feeds.length,
    enabledCount,
    disabledCount: feedsState.feeds.length - enabledCount,
    itemCount: itemsState.items.length,
    unreadCount,
  };
}

function makeFeedRecord(existingFeed, normalizedFeed, overrides = {}) {
  return {
    id: existingFeed?.id || normalizedFeed.id,
    url: overrides.url || existingFeed?.url || normalizedFeed.siteUrl || normalizedFeed.raw?.selfLink || null,
    title: overrides.title || normalizedFeed.title || existingFeed?.title || null,
    siteUrl: overrides.siteUrl || normalizedFeed.siteUrl || existingFeed?.siteUrl || null,
    description: overrides.description || normalizedFeed.description || existingFeed?.description || null,
    etag: overrides.etag ?? existingFeed?.etag ?? null,
    lastModified: overrides.lastModified ?? existingFeed?.lastModified ?? null,
    enabled: overrides.enabled ?? existingFeed?.enabled ?? true,
    lastFetchedAt: overrides.lastFetchedAt ?? existingFeed?.lastFetchedAt ?? null,
    lastSuccessAt: overrides.lastSuccessAt ?? existingFeed?.lastSuccessAt ?? null,
    lastError: overrides.lastError ?? existingFeed?.lastError ?? null,
    raw: {
      ...(existingFeed?.raw || {}),
      ...(normalizedFeed.raw || {}),
    },
  };
}

function mergeItems(itemsState, feedId, incomingItems, fetchedAt) {
  const existingByDedupeKey = new Map();
  for (const item of itemsState.items) {
    if (item.feedId === feedId) {
      existingByDedupeKey.set(item.dedupeKey, item);
    }
  }

  let insertedCount = 0;
  let existingCount = 0;
  for (const incomingItem of incomingItems) {
    incomingItem.fetchedAt = fetchedAt;
    const existingItem = existingByDedupeKey.get(incomingItem.dedupeKey);
    if (existingItem) {
      existingItem.title = incomingItem.title;
      existingItem.link = incomingItem.link;
      existingItem.summary = incomingItem.summary;
      existingItem.contentSnippet = incomingItem.contentSnippet;
      existingItem.publishedAt = incomingItem.publishedAt;
      existingItem.author = incomingItem.author;
      existingItem.guid = incomingItem.guid;
      existingItem.fetchedAt = fetchedAt;
      existingItem.raw = incomingItem.raw;
      existingCount += 1;
      continue;
    }

    itemsState.items.push(incomingItem);
    existingByDedupeKey.set(incomingItem.dedupeKey, incomingItem);
    insertedCount += 1;
  }

  itemsState.items = sortItemsDescending(itemsState.items);
  return {
    insertedCount,
    existingCount,
    seenCount: incomingItems.length,
  };
}

function loadStates(ctx) {
  return loadFeedsState(ctx.dataDir).then(async (feedsState) => {
    const itemsState = await loadItemsState(ctx.dataDir);
    return { feedsState, itemsState };
  });
}

async function mutateStates(ctx, mutator) {
  return withDataLock(ctx.dataDir, async () => {
    const { feedsState, itemsState } = await loadStates(ctx);
    const result = await mutator({ feedsState, itemsState });
    const updatedAt = nowIso();
    feedsState.updatedAt = updatedAt;
    itemsState.updatedAt = updatedAt;
    await Promise.all([
      saveFeedsState(ctx.dataDir, feedsState),
      saveItemsState(ctx.dataDir, itemsState),
    ]);
    return result;
  });
}

async function recordFeedError(ctx, feedId, error) {
  const serialized = serializeError(error);
  await mutateStates(ctx, ({ feedsState }) => {
    const feed = requireFeed(feedsState, feedId);
    feed.lastFetchedAt = nowIso();
    feed.lastError = {
      ...serialized,
      at: nowIso(),
    };
    return null;
  });
}

async function readInputText(input) {
  if (typeof input?.opmlText === "string" && input.opmlText.trim()) {
    return input.opmlText;
  }
  if (typeof input?.filePath === "string" && input.filePath.trim()) {
    return fs.readFile(input.filePath.trim(), "utf-8");
  }
  throw new RssPluginError("Either opmlText or filePath is required.", {
    code: "MISSING_OPML_INPUT",
  });
}

export function createRssService(ctx) {
  const settings = getPluginSettings(ctx);

  async function listFeeds(input = {}) {
    const { feedsState, itemsState } = await loadStates(ctx);
    const feeds = feedsState.feeds
      .filter((feed) => input.includeDisabled || feed.enabled !== false)
      .map((feed) => makeFeedSummary(feed, itemsState));

    return {
      ok: true,
      pluginId: PLUGIN_ID,
      totals: countTotals(feedsState, itemsState),
      feeds,
    };
  }

  async function addFeed(input) {
    const requestedUrl = canonicalizeUrl(input?.url);
    if (!requestedUrl) {
      throw new RssPluginError("Feed URL is required.", { code: "MISSING_URL" });
    }

    const fetched = await fetchFeedDocument(requestedUrl, {
      timeoutMs: settings.requestTimeoutMs,
      userAgent: settings.requestUserAgent,
    });

    const normalized = parseFeedDocument(fetched.bodyText, fetched.finalUrl || requestedUrl, settings);
    const candidateUrls = new Set([requestedUrl, canonicalizeUrl(fetched.finalUrl)]);

    return mutateStates(ctx, ({ feedsState, itemsState }) => {
      const existingFeed = feedsState.feeds.find((feed) => candidateUrls.has(canonicalizeUrl(feed.url)));
      if (existingFeed) {
        return {
          ok: true,
          action: "existing",
          feed: makeFeedSummary(existingFeed, itemsState),
          refresh: {
            status: "skipped",
            reason: "Feed already exists.",
          },
        };
      }

      const feedRecord = makeFeedRecord(null, normalized.feed, {
        url: canonicalizeUrl(fetched.finalUrl) || requestedUrl,
        enabled: input?.enabled !== false,
        etag: fetched.etag || null,
        lastModified: fetched.lastModified || null,
        lastFetchedAt: fetched.fetchedAt,
        lastSuccessAt: fetched.fetchedAt,
        lastError: null,
      });

      feedsState.feeds.push(feedRecord);
      const mergeResult = mergeItems(itemsState, feedRecord.id, normalized.items, fetched.fetchedAt);
      return {
        ok: true,
        action: "added",
        feed: makeFeedSummary(feedRecord, itemsState),
        refresh: {
          status: "updated",
          httpStatus: fetched.status,
          fetchedAt: fetched.fetchedAt,
          insertedCount: mergeResult.insertedCount,
          existingCount: mergeResult.existingCount,
          seenCount: mergeResult.seenCount,
        },
      };
    });
  }

  async function updateFeed(input) {
    if (!input?.feedId) {
      throw new RssPluginError("feedId is required.", { code: "MISSING_FEED_ID" });
    }

    const nextUrl = input.url ? canonicalizeUrl(input.url) : null;
    if (input.url && !nextUrl) {
      throw new RssPluginError("Provided url is invalid.", { code: "INVALID_URL" });
    }

    return mutateStates(ctx, ({ feedsState, itemsState }) => {
      const feed = requireFeed(feedsState, input.feedId);
      if (nextUrl) {
        feed.url = nextUrl;
        feed.etag = null;
        feed.lastModified = null;
      }
      if (typeof input.title === "string") {
        feed.title = input.title.trim() || feed.title;
      }
      if (typeof input.siteUrl === "string") {
        feed.siteUrl = input.siteUrl.trim() || null;
      }
      if (typeof input.description === "string") {
        feed.description = input.description.trim() || null;
      }
      if (typeof input.enabled === "boolean") {
        feed.enabled = input.enabled;
      }

      return {
        ok: true,
        action: "updated",
        feed: makeFeedSummary(feed, itemsState),
      };
    });
  }

  async function removeFeed(input) {
    if (!input?.feedId) {
      throw new RssPluginError("feedId is required.", { code: "MISSING_FEED_ID" });
    }

    return mutateStates(ctx, ({ feedsState, itemsState }) => {
      const feed = requireFeed(feedsState, input.feedId);
      feedsState.feeds = feedsState.feeds.filter((entry) => entry.id !== input.feedId);
      const deleteItems = input.deleteItems !== false;
      const removedItemCount = itemsState.items.filter((item) => item.feedId === input.feedId).length;
      if (deleteItems) {
        itemsState.items = itemsState.items.filter((item) => item.feedId !== input.feedId);
      }

      return {
        ok: true,
        action: "removed",
        removedFeed: {
          id: feed.id,
          title: feed.title,
          url: feed.url,
        },
        removedItemCount: deleteItems ? removedItemCount : 0,
      };
    });
  }

  async function setFeedEnabled(feedId, enabled) {
    return mutateStates(ctx, ({ feedsState, itemsState }) => {
      const feed = requireFeed(feedsState, feedId);
      feed.enabled = enabled;
      return {
        ok: true,
        action: enabled ? "enabled" : "disabled",
        feed: makeFeedSummary(feed, itemsState),
      };
    });
  }

  async function enableFeed(input) {
    if (!input?.feedId) {
      throw new RssPluginError("feedId is required.", { code: "MISSING_FEED_ID" });
    }
    return setFeedEnabled(input.feedId, true);
  }

  async function disableFeed(input) {
    if (!input?.feedId) {
      throw new RssPluginError("feedId is required.", { code: "MISSING_FEED_ID" });
    }
    return setFeedEnabled(input.feedId, false);
  }

  async function refreshFeed(input) {
    if (!input?.feedId) {
      throw new RssPluginError("feedId is required.", { code: "MISSING_FEED_ID" });
    }

    const { feedsState } = await loadStates(ctx);
    const feed = requireFeed(feedsState, input.feedId);

    try {
      const fetched = await fetchFeedDocument(feed.url, {
        timeoutMs: settings.requestTimeoutMs,
        userAgent: settings.requestUserAgent,
        etag: input.force ? null : feed.etag,
        lastModified: input.force ? null : feed.lastModified,
      });

      if (fetched.notModified) {
        return mutateStates(ctx, ({ feedsState: mutableFeedsState, itemsState }) => {
          const mutableFeed = requireFeed(mutableFeedsState, input.feedId);
          mutableFeed.lastFetchedAt = fetched.fetchedAt;
          mutableFeed.lastSuccessAt = fetched.fetchedAt;
          mutableFeed.lastError = null;
          return {
            ok: true,
            action: "refreshed",
            refresh: {
              status: "not_modified",
              httpStatus: fetched.status,
              fetchedAt: fetched.fetchedAt,
            },
            feed: makeFeedSummary(mutableFeed, itemsState),
          };
        });
      }

      const normalized = parseFeedDocument(fetched.bodyText, fetched.finalUrl || feed.url, settings);
      return mutateStates(ctx, ({ feedsState: mutableFeedsState, itemsState }) => {
        const mutableFeed = requireFeed(mutableFeedsState, input.feedId);
        mutableFeed.url = canonicalizeUrl(fetched.finalUrl) || mutableFeed.url;
        mutableFeed.title = normalized.feed.title || mutableFeed.title;
        mutableFeed.siteUrl = normalized.feed.siteUrl || mutableFeed.siteUrl;
        mutableFeed.description = normalized.feed.description || mutableFeed.description;
        mutableFeed.etag = fetched.etag || mutableFeed.etag || null;
        mutableFeed.lastModified = fetched.lastModified || mutableFeed.lastModified || null;
        mutableFeed.lastFetchedAt = fetched.fetchedAt;
        mutableFeed.lastSuccessAt = fetched.fetchedAt;
        mutableFeed.lastError = null;
        mutableFeed.raw = {
          ...(mutableFeed.raw || {}),
          ...(normalized.feed.raw || {}),
        };

        const mergeResult = mergeItems(itemsState, mutableFeed.id, normalized.items, fetched.fetchedAt);
        return {
          ok: true,
          action: "refreshed",
          refresh: {
            status: "updated",
            httpStatus: fetched.status,
            fetchedAt: fetched.fetchedAt,
            insertedCount: mergeResult.insertedCount,
            existingCount: mergeResult.existingCount,
            seenCount: mergeResult.seenCount,
          },
          feed: makeFeedSummary(mutableFeed, itemsState),
        };
      });
    } catch (error) {
      await recordFeedError(ctx, input.feedId, error);
      throw error;
    }
  }

  async function refreshAllFeeds(input = {}) {
    const { feedsState } = await loadStates(ctx);
    const targetFeeds = feedsState.feeds.filter((feed) => input.includeDisabled || feed.enabled !== false);
    const results = [];

    for (const feed of targetFeeds) {
      try {
        const result = await refreshFeed({ feedId: feed.id, force: input.force === true });
        results.push({
          feedId: feed.id,
          title: feed.title,
          ok: true,
          refresh: result.refresh,
        });
      } catch (error) {
        results.push({
          feedId: feed.id,
          title: feed.title,
          ok: false,
          error: serializeError(error),
        });
      }
    }

    return {
      ok: true,
      action: "refresh_all",
      requestedCount: targetFeeds.length,
      succeededCount: results.filter((item) => item.ok).length,
      failedCount: results.filter((item) => !item.ok).length,
      results,
    };
  }

  async function listUnreadItems(input = {}) {
    const limit = Math.min(
      Number.isFinite(input.limit) ? Math.trunc(input.limit) : settings.defaultListLimit,
      settings.maxListLimit,
    );
    const { feedsState, itemsState } = await loadStates(ctx);
    if (input.feedId) {
      requireFeed(feedsState, input.feedId);
    }
    const feedsById = new Map(feedsState.feeds.map((feed) => [feed.id, feed]));
    const items = sortItemsDescending(itemsState.items)
      .filter((item) => !item.read)
      .filter((item) => !input.feedId || item.feedId === input.feedId)
      .slice(0, limit)
      .map((item) => makeItemSummary(item, feedsById));

    return {
      ok: true,
      action: "list_unread",
      totalUnread: itemsState.items.filter((item) => !item.read).length,
      returnedCount: items.length,
      items,
    };
  }

  async function readFeedItems(input = {}) {
    const limit = Math.min(
      Number.isFinite(input.limit) ? Math.trunc(input.limit) : settings.defaultListLimit,
      settings.maxListLimit,
    );
    const { feedsState, itemsState } = await loadStates(ctx);
    if (input.feedId) {
      requireFeed(feedsState, input.feedId);
    }
    const feedsById = new Map(feedsState.feeds.map((feed) => [feed.id, feed]));
    const items = sortItemsDescending(itemsState.items)
      .filter((item) => !input.feedId || item.feedId === input.feedId)
      .filter((item) => !input.unreadOnly || !item.read)
      .slice(0, limit)
      .map((item) => makeItemSummary(item, feedsById));

    return {
      ok: true,
      action: "read_feed_items",
      returnedCount: items.length,
      items,
    };
  }

  async function markItemRead(input) {
    if (!input?.itemId) {
      throw new RssPluginError("itemId is required.", { code: "MISSING_ITEM_ID" });
    }

    return mutateStates(ctx, ({ feedsState, itemsState }) => {
      const item = itemsState.items.find((entry) => entry.id === input.itemId);
      if (!item) {
        throw new RssPluginError(`Item not found: ${input.itemId}`, { code: "ITEM_NOT_FOUND" });
      }
      item.read = input.read !== false;
      const feedsById = new Map(feedsState.feeds.map((feed) => [feed.id, feed]));
      return {
        ok: true,
        action: item.read ? "marked_read" : "marked_unread",
        item: makeItemSummary(item, feedsById),
      };
    });
  }

  async function markFeedRead(input) {
    if (!input?.feedId) {
      throw new RssPluginError("feedId is required.", { code: "MISSING_FEED_ID" });
    }

    return mutateStates(ctx, ({ feedsState, itemsState }) => {
      requireFeed(feedsState, input.feedId);
      let changedCount = 0;
      for (const item of itemsState.items) {
        if (item.feedId !== input.feedId) {
          continue;
        }
        const nextRead = input.read !== false;
        if (item.read !== nextRead) {
          item.read = nextRead;
          changedCount += 1;
        }
      }

      return {
        ok: true,
        action: input.read === false ? "feed_marked_unread" : "feed_marked_read",
        feedId: input.feedId,
        changedCount,
      };
    });
  }

  async function importOpml(input = {}) {
    const xmlText = await readInputText(input);
    const opml = parseOpmlDocument(xmlText);
    const added = [];
    const existing = [];
    const failed = [];

    for (const subscription of opml.subscriptions) {
      if (!subscription.xmlUrl) {
        failed.push({
          title: subscription.title || subscription.text || "Untitled",
          error: {
            message: "Missing xmlUrl",
            code: "MISSING_XML_URL",
          },
        });
        continue;
      }

      try {
        if (input.refreshAfterImport === false) {
          const result = await mutateStates(ctx, ({ feedsState, itemsState }) => {
            const normalizedUrl = canonicalizeUrl(subscription.xmlUrl);
            const existingFeed = feedsState.feeds.find((feed) => canonicalizeUrl(feed.url) === normalizedUrl);
            if (existingFeed) {
              if (input.enabled !== undefined) {
                existingFeed.enabled = input.enabled;
              }
              existingFeed.title = subscription.title || existingFeed.title;
              existingFeed.siteUrl = subscription.htmlUrl || existingFeed.siteUrl;
              existingFeed.description = subscription.description || existingFeed.description;
              return {
                type: "existing",
                feed: makeFeedSummary(existingFeed, itemsState),
              };
            }

            const feedId = `feed_${hashText(normalizedUrl).slice(0, 12)}`;
            const feedRecord = {
              id: feedId,
              url: normalizedUrl,
              title: subscription.title || subscription.text || normalizedUrl,
              siteUrl: subscription.htmlUrl || null,
              description: subscription.description || null,
              etag: null,
              lastModified: null,
              enabled: input.enabled !== false,
              lastFetchedAt: null,
              lastSuccessAt: null,
              lastError: null,
              raw: {
                format: null,
                importedFromOpml: true,
                categoryPath: subscription.categoryPath || [],
              },
            };
            feedsState.feeds.push(feedRecord);
            return {
              type: "added",
              feed: makeFeedSummary(feedRecord, itemsState),
            };
          });

          if (result.type === "added") {
            added.push(result.feed);
          } else {
            existing.push(result.feed);
          }
          continue;
        }

        const result = await addFeed({ url: subscription.xmlUrl, enabled: input.enabled !== false });
        if (result.action === "existing") {
          existing.push(result.feed);
        } else {
          added.push(result.feed);
        }
      } catch (error) {
        failed.push({
          title: subscription.title || subscription.text || subscription.xmlUrl,
          url: subscription.xmlUrl,
          error: serializeError(error),
        });
      }
    }

    return {
      ok: true,
      action: "import_opml",
      documentTitle: opml.title,
      totalSubscriptions: opml.subscriptions.length,
      addedCount: added.length,
      existingCount: existing.length,
      failedCount: failed.length,
      added,
      existing,
      failed,
    };
  }

  async function exportOpml(input = {}) {
    const { feedsState } = await loadStates(ctx);
    const feeds = feedsState.feeds.filter((feed) => input.includeDisabled || feed.enabled !== false);
    const opmlText = buildOpmlDocument(feeds, {
      title: input.title || "Hanako RSS subscriptions",
      createdAt: feedsState.updatedAt || nowIso(),
      modifiedAt: nowIso(),
    });

    const suggestedFileName = `${settings.exportedOpmlFilePrefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.opml`;
    const outputFilePath = input.filePath
      ? path.resolve(input.filePath)
      : path.join(ctx.dataDir, "exports", suggestedFileName);

    await writeOpmlToFile(outputFilePath, opmlText);
    return {
      ok: true,
      action: "export_opml",
      feedCount: feeds.length,
      filePath: outputFilePath,
      preview: truncateText(opmlText, 800),
    };
  }

  return {
    listFeeds,
    addFeed,
    updateFeed,
    removeFeed,
    enableFeed,
    disableFeed,
    refreshFeed,
    refreshAllFeeds,
    listUnreadItems,
    readFeedItems,
    markItemRead,
    markFeedRead,
    importOpml,
    exportOpml,
  };
}
