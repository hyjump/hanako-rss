import path from "path";
import { DATA_FILES, DATA_VERSION } from "./constants.js";
import { ensureJsonFile, readJsonFile, writeJsonAtomic } from "./storage/json-store.js";
import { sortFeeds, sortItemsDescending } from "./utils.js";

function defaultFeedsState() {
  return {
    version: DATA_VERSION,
    feeds: [],
    updatedAt: null,
  };
}

function defaultItemsState() {
  return {
    version: DATA_VERSION,
    items: [],
    updatedAt: null,
  };
}

export function resolveFeedsFilePath(dataDir) {
  return path.join(dataDir, DATA_FILES.feeds);
}

export function resolveItemsFilePath(dataDir) {
  return path.join(dataDir, DATA_FILES.items);
}

export async function ensureDataFiles(dataDir) {
  await ensureJsonFile(resolveFeedsFilePath(dataDir), defaultFeedsState);
  await ensureJsonFile(resolveItemsFilePath(dataDir), defaultItemsState);
}

function normalizeFeedsState(state) {
  const base = state && typeof state === "object" ? state : defaultFeedsState();
  return {
    version: Number.isFinite(base.version) ? base.version : DATA_VERSION,
    feeds: Array.isArray(base.feeds) ? base.feeds : [],
    updatedAt: base.updatedAt || null,
  };
}

function normalizeItemsState(state) {
  const base = state && typeof state === "object" ? state : defaultItemsState();
  return {
    version: Number.isFinite(base.version) ? base.version : DATA_VERSION,
    items: Array.isArray(base.items) ? base.items : [],
    updatedAt: base.updatedAt || null,
  };
}

export async function loadFeedsState(dataDir) {
  await ensureDataFiles(dataDir);
  const state = await readJsonFile(resolveFeedsFilePath(dataDir), defaultFeedsState);
  return normalizeFeedsState(state);
}

export async function loadItemsState(dataDir) {
  await ensureDataFiles(dataDir);
  const state = await readJsonFile(resolveItemsFilePath(dataDir), defaultItemsState);
  return normalizeItemsState(state);
}

export async function saveFeedsState(dataDir, feedsState) {
  const payload = normalizeFeedsState(feedsState);
  payload.feeds = sortFeeds(payload.feeds);
  await writeJsonAtomic(resolveFeedsFilePath(dataDir), payload);
}

export async function saveItemsState(dataDir, itemsState) {
  const payload = normalizeItemsState(itemsState);
  payload.items = sortItemsDescending(payload.items);
  await writeJsonAtomic(resolveItemsFilePath(dataDir), payload);
}
