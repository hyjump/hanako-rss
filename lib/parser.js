import { XMLParser, XMLValidator } from "fast-xml-parser";
import { RssPluginError } from "./errors.js";
import {
  canonicalizeUrl,
  decodeHtmlEntities,
  ensureArray,
  hashText,
  maybeString,
  normalizeWhitespace,
  parseDateToIso,
  stripHtml,
  truncateText,
} from "./utils.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  textNodeName: "#text",
  processEntities: true,
});

function validateXml(xmlText) {
  const result = XMLValidator.validate(xmlText);
  if (result !== true) {
    throw new RssPluginError(`XML parse error: ${result.err.msg} (line ${result.err.line}, col ${result.err.col})`, {
      code: "INVALID_XML",
      details: result.err,
    });
  }
}

function extractNodeText(node) {
  if (node === undefined || node === null) {
    return "";
  }
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractNodeText).filter(Boolean).join(" ").trim();
  }
  if (typeof node === "object") {
    if (typeof node["#text"] === "string") {
      return node["#text"];
    }
    if (typeof node.text === "string") {
      return node.text;
    }
    return Object.entries(node)
      .filter(([key]) => key !== "#text" && !key.startsWith("@_"))
      .map(([, value]) => extractNodeText(value))
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return "";
}

function toPlainText(node) {
  return normalizeWhitespace(stripHtml(decodeHtmlEntities(extractNodeText(node))));
}

function summarizeText(text, maxLength) {
  return truncateText(toPlainText(text), maxLength);
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function resolveRssGuid(guidNode, link) {
  const text = maybeString(extractNodeText(guidNode));
  if (!text) {
    return maybeString(link);
  }
  return text;
}

function buildDedupeKey({ guid, atomId, link, title, publishedAt, rawFingerprint }) {
  if (guid) {
    return `guid:${guid}`;
  }
  if (atomId) {
    return `atom-id:${atomId}`;
  }
  if (link) {
    return `link:${canonicalizeUrl(link)}`;
  }
  if (title || publishedAt) {
    return `title-date:${hashText(`${title || ""}|${publishedAt || ""}`)}`;
  }
  return `raw:${hashText(rawFingerprint || "")}`;
}

function normalizeRssItem(item, feedId, settings, fallbackAuthor) {
  const title = maybeString(toPlainText(item.title)) || "(untitled)";
  const link = maybeString(canonicalizeUrl(extractNodeText(item.link)));
  const descriptionText = summarizeText(item.description, settings.summaryLength);
  const contentText = summarizeText(item.encoded || item.description || item.content, settings.contentSnippetLength);
  const guid = resolveRssGuid(item.guid, link);
  const publishedAt = parseDateToIso(item.pubDate) || parseDateToIso(item.date) || null;
  const author = maybeString(toPlainText(item.author || item.creator)) || fallbackAuthor || null;
  const dedupeKey = buildDedupeKey({
    guid,
    atomId: null,
    link,
    title,
    publishedAt,
    rawFingerprint: JSON.stringify(item),
  });

  return {
    id: `item_${hashText(`${feedId}:${dedupeKey}`).slice(0, 16)}`,
    feedId,
    title,
    link,
    summary: descriptionText || truncateText(contentText, settings.summaryLength) || null,
    contentSnippet: contentText || descriptionText || null,
    publishedAt,
    author,
    guid,
    read: false,
    fetchedAt: null,
    dedupeKey,
    raw: {
      format: "rss",
      enclosure: item.enclosure || null,
      source: item.source || null,
      comments: maybeString(extractNodeText(item.comments)),
      categories: ensureArray(item.category).map(extractNodeText).filter(Boolean),
      guidIsPermaLink: typeof item.guid === "object" ? item.guid["@_isPermaLink"] ?? null : null,
    },
  };
}

function pickAtomLink(linkNodes, preferredRels = ["alternate"]) {
  const links = ensureArray(linkNodes)
    .map((link) => ({
      rel: typeof link === "object" ? (link["@_rel"] || "alternate") : "alternate",
      href: typeof link === "object" ? link["@_href"] : null,
      type: typeof link === "object" ? link["@_type"] || null : null,
      length: typeof link === "object" ? link["@_length"] || null : null,
      title: typeof link === "object" ? link["@_title"] || null : null,
    }))
    .filter((link) => link.href);

  for (const rel of preferredRels) {
    const found = links.find((link) => link.rel === rel);
    if (found) {
      return found;
    }
  }
  return links[0] || null;
}

function normalizeAtomContent(node) {
  if (!node) {
    return {
      text: "",
      type: null,
      src: null,
    };
  }

  if (typeof node === "string") {
    return {
      text: toPlainText(node),
      type: null,
      src: null,
    };
  }

  return {
    text: toPlainText(node),
    type: node["@_type"] || null,
    src: node["@_src"] || null,
  };
}

function normalizeAtomAuthor(authorNode) {
  if (!authorNode) {
    return null;
  }

  const author = Array.isArray(authorNode) ? authorNode[0] : authorNode;
  return maybeString(toPlainText(author.name || author.email || author.uri || author));
}

function normalizeAtomItem(entry, feedId, settings, fallbackAuthor) {
  const title = maybeString(toPlainText(entry.title)) || "(untitled)";
  const primaryLink = pickAtomLink(entry.link, ["alternate", "self"]);
  const link = maybeString(canonicalizeUrl(primaryLink?.href));
  const summaryText = summarizeText(entry.summary, settings.summaryLength);
  const content = normalizeAtomContent(entry.content);
  const contentSnippet = truncateText(content.text || summaryText, settings.contentSnippetLength) || null;
  const guid = maybeString(extractNodeText(entry.id));
  const publishedAt = parseDateToIso(entry.published) || parseDateToIso(entry.updated) || null;
  const author = normalizeAtomAuthor(entry.author) || fallbackAuthor || null;
  const dedupeKey = buildDedupeKey({
    guid: null,
    atomId: guid,
    link,
    title,
    publishedAt,
    rawFingerprint: JSON.stringify(entry),
  });

  return {
    id: `item_${hashText(`${feedId}:${dedupeKey}`).slice(0, 16)}`,
    feedId,
    title,
    link,
    summary: summaryText || truncateText(content.text, settings.summaryLength) || null,
    contentSnippet,
    publishedAt,
    author,
    guid,
    read: false,
    fetchedAt: null,
    dedupeKey,
    raw: {
      format: "atom",
      links: ensureArray(entry.link),
      contentType: content.type,
      contentSrc: content.src,
      enclosures: ensureArray(entry.link).filter((linkNode) => typeof linkNode === "object" && linkNode.rel === "enclosure"),
    },
  };
}

function normalizeRssDocument(documentObject, sourceUrl, settings) {
  const channel = documentObject?.rss?.channel;
  if (!channel || typeof channel !== "object") {
    throw new RssPluginError("RSS document is missing <rss><channel>", {
      code: "INVALID_RSS_DOCUMENT",
    });
  }

  const feedIdSeed = canonicalizeUrl(sourceUrl) || maybeString(extractNodeText(channel.link)) || hashText(JSON.stringify(channel));
  const feedId = `feed_${hashText(feedIdSeed).slice(0, 12)}`;
  const feedAuthor = maybeString(toPlainText(channel.managingEditor || channel.webMaster));

  return {
    format: "rss",
    feed: {
      id: feedId,
      title: maybeString(toPlainText(channel.title)) || maybeString(canonicalizeUrl(sourceUrl)) || "Untitled RSS Feed",
      siteUrl: maybeString(canonicalizeUrl(extractNodeText(channel.link))),
      description: maybeString(toPlainText(channel.description)),
      raw: {
        format: "rss",
        language: maybeString(extractNodeText(channel.language)),
        generator: maybeString(toPlainText(channel.generator)),
        docs: maybeString(extractNodeText(channel.docs)),
      },
    },
    items: ensureArray(channel.item).map((item) => normalizeRssItem(item, feedId, settings, feedAuthor)),
  };
}

function normalizeAtomDocument(documentObject, sourceUrl, settings) {
  const feedNode = documentObject?.feed;
  if (!feedNode || typeof feedNode !== "object") {
    throw new RssPluginError("Atom document is missing <feed>", {
      code: "INVALID_ATOM_DOCUMENT",
    });
  }

  const atomId = maybeString(extractNodeText(feedNode.id));
  const primaryLink = pickAtomLink(feedNode.link, ["alternate", "self"]);
  const siteUrl = maybeString(canonicalizeUrl(primaryLink?.href)) || maybeString(canonicalizeUrl(sourceUrl));
  const feedIdSeed = atomId || siteUrl || hashText(JSON.stringify(feedNode));
  const feedId = `feed_${hashText(feedIdSeed).slice(0, 12)}`;
  const feedAuthor = normalizeAtomAuthor(feedNode.author);

  return {
    format: "atom",
    feed: {
      id: feedId,
      title: maybeString(toPlainText(feedNode.title)) || siteUrl || "Untitled Atom Feed",
      siteUrl,
      description: maybeString(toPlainText(feedNode.subtitle)),
      raw: {
        format: "atom",
        atomId,
        updated: parseDateToIso(feedNode.updated),
        selfLink: pickAtomLink(feedNode.link, ["self"])?.href || null,
      },
    },
    items: ensureArray(feedNode.entry).map((entry) => normalizeAtomItem(entry, feedId, settings, feedAuthor)),
  };
}

export function parseFeedDocument(xmlText, sourceUrl, settings) {
  const cleanedXml = String(xmlText || "").replace(/^\uFEFF/, "");
  validateXml(cleanedXml);
  const documentObject = parser.parse(cleanedXml);

  if (documentObject?.rss) {
    return normalizeRssDocument(documentObject, sourceUrl, settings);
  }
  if (documentObject?.feed) {
    return normalizeAtomDocument(documentObject, sourceUrl, settings);
  }

  throw new RssPluginError("Unsupported feed format. Only RSS 2.0 and Atom are supported.", {
    code: "UNSUPPORTED_FEED_FORMAT",
  });
}

function flattenOpmlOutlines(outlineNode, trail, output) {
  for (const node of ensureArray(outlineNode)) {
    if (!node || typeof node !== "object") {
      continue;
    }

    const text = maybeString(node["@_text"] || node.text) || maybeString(node["@_title"] || node.title) || "Untitled";
    const currentTrail = [...trail, text];
    const xmlUrl = maybeString(node["@_xmlUrl"] || node.xmlUrl);
    if (xmlUrl) {
      output.push({
        title: maybeString(node["@_title"] || node.title) || text,
        text,
        xmlUrl: maybeString(canonicalizeUrl(xmlUrl)),
        htmlUrl: maybeString(canonicalizeUrl(node["@_htmlUrl"] || node.htmlUrl)),
        description: maybeString(node["@_description"] || node.description),
        categoryPath: currentTrail.slice(0, -1),
      });
    }

    if (node.outline) {
      flattenOpmlOutlines(node.outline, currentTrail, output);
    }
  }
}

export function parseOpmlDocument(xmlText) {
  const cleanedXml = String(xmlText || "").replace(/^\uFEFF/, "");
  validateXml(cleanedXml);
  const documentObject = parser.parse(cleanedXml);
  const opml = documentObject?.opml;
  if (!opml || typeof opml !== "object") {
    throw new RssPluginError("OPML document is missing <opml>", {
      code: "INVALID_OPML_DOCUMENT",
    });
  }

  const subscriptions = [];
  flattenOpmlOutlines(opml.body?.outline, [], subscriptions);
  return {
    title: maybeString(opml.head?.title) || "Imported OPML",
    subscriptions,
  };
}
