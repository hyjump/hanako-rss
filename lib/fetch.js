import { HTTP_HEADERS } from "./constants.js";
import { RssPluginError } from "./errors.js";
import { nowIso } from "./utils.js";

function buildHeaders({ userAgent, etag, lastModified }) {
  const headers = {
    Accept: HTTP_HEADERS.accept,
    "User-Agent": userAgent,
  };

  if (etag) {
    headers["If-None-Match"] = etag;
  }
  if (lastModified) {
    headers["If-Modified-Since"] = lastModified;
  }

  return headers;
}

export async function fetchFeedDocument(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: buildHeaders(options),
    });

    const fetchedAt = nowIso();
    const durationMs = Date.now() - startedAt;
    const etag = response.headers.get("etag");
    const lastModified = response.headers.get("last-modified");
    const contentType = response.headers.get("content-type");
    const finalUrl = response.url || url;

    if (response.status === 304) {
      return {
        ok: true,
        notModified: true,
        status: 304,
        fetchedAt,
        durationMs,
        etag: etag || options.etag || null,
        lastModified: lastModified || options.lastModified || null,
        contentType,
        finalUrl,
        bodyText: null,
      };
    }

    if (!response.ok) {
      const preview = await response.text().catch(() => "");
      throw new RssPluginError(`HTTP ${response.status} ${response.statusText || ""}`.trim(), {
        code: "HTTP_ERROR",
        status: response.status,
        details: {
          url: finalUrl,
          bodyPreview: preview.slice(0, 500),
        },
      });
    }

    const bodyText = await response.text();
    return {
      ok: true,
      notModified: false,
      status: response.status,
      fetchedAt,
      durationMs,
      etag,
      lastModified,
      contentType,
      finalUrl,
      bodyText,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new RssPluginError(`Request timed out after ${options.timeoutMs} ms`, {
        code: "TIMEOUT",
        details: { url },
      });
    }

    if (error instanceof RssPluginError) {
      throw error;
    }

    throw new RssPluginError(error?.message || "Network request failed", {
      code: "NETWORK_ERROR",
      details: { url },
    });
  } finally {
    clearTimeout(timeout);
  }
}
