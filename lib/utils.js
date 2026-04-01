import crypto from "crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function ensureArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
}

export function hashText(text) {
  return crypto.createHash("sha1").update(String(text)).digest("hex");
}

export function truncateText(text, maxLength) {
  if (typeof text !== "string") {
    return "";
  }

  const clean = normalizeWhitespace(text);
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function normalizeWhitespace(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

export function decodeHtmlEntities(text) {
  if (!text) {
    return "";
  }

  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  return String(text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const raw = isHex ? entity.slice(2) : entity.slice(1);
      const codePoint = Number.parseInt(raw, isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    }
    return named[entity] ?? _;
  });
}

export function stripHtml(html) {
  if (!html) {
    return "";
  }

  const withLineBreaks = String(html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n")
    .replace(/<\s*\/\s*div\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "• ")
    .replace(/<\/?[^>]+>/g, " ");

  return normalizeWhitespace(decodeHtmlEntities(withLineBreaks));
}

export function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function canonicalizeUrl(input) {
  const raw = safeTrim(input);
  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
}

export function parseDateToIso(value) {
  const raw = safeTrim(value);
  if (!raw) {
    return null;
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }

  const normalized = raw
    .replace(/\bUT\b/g, "UTC")
    .replace(/\s+([+-]\d{2})(\d{2})$/, " $1:$2");
  const fallback = new Date(normalized);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString();
  }

  return null;
}

export function sortItemsDescending(items) {
  return [...items].sort((left, right) => {
    const leftKey = left.publishedAt || left.fetchedAt || "";
    const rightKey = right.publishedAt || right.fetchedAt || "";
    if (leftKey !== rightKey) {
      return rightKey.localeCompare(leftKey);
    }
    return String(right.title || "").localeCompare(String(left.title || ""));
  });
}

export function sortFeeds(feeds) {
  return [...feeds].sort((left, right) => {
    const leftTitle = String(left.title || left.url || left.id).toLowerCase();
    const rightTitle = String(right.title || right.url || right.id).toLowerCase();
    return leftTitle.localeCompare(rightTitle);
  });
}

export function uniqueStrings(values) {
  const output = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = safeTrim(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

export function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function maybeString(value) {
  const normalized = safeTrim(typeof value === "number" ? String(value) : value);
  return normalized || null;
}
