import fs from "fs/promises";
import path from "path";
import { escapeXml } from "./utils.js";

function formatDateForOpml(date) {
  return new Date(date).toUTCString();
}

export function buildOpmlDocument(feeds, options = {}) {
  const title = options.title || "Hanako RSS subscriptions";
  const createdAt = options.createdAt || new Date().toISOString();
  const modifiedAt = options.modifiedAt || createdAt;

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    `    <title>${escapeXml(title)}</title>`,
    `    <dateCreated>${escapeXml(formatDateForOpml(createdAt))}</dateCreated>`,
    `    <dateModified>${escapeXml(formatDateForOpml(modifiedAt))}</dateModified>`,
    '    <docs>https://opml.org/spec2.opml</docs>',
    '  </head>',
    '  <body>',
  ];

  for (const feed of feeds) {
    const attrs = [
      `text="${escapeXml(feed.title || feed.url || feed.id)}"`,
      `title="${escapeXml(feed.title || feed.url || feed.id)}"`,
      `type="rss"`,
      `xmlUrl="${escapeXml(feed.url)}"`,
    ];

    if (feed.siteUrl) {
      attrs.push(`htmlUrl="${escapeXml(feed.siteUrl)}"`);
    }
    if (feed.description) {
      attrs.push(`description="${escapeXml(feed.description)}"`);
    }
    if (feed.raw?.format === "atom") {
      attrs.push('version="atom"');
    } else {
      attrs.push('version="RSS2"');
    }

    lines.push(`    <outline ${attrs.join(" ")} />`);
  }

  lines.push('  </body>');
  lines.push('</opml>');
  return `${lines.join("\n")}\n`;
}

export async function writeOpmlToFile(filePath, opmlText) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, opmlText, "utf-8");
  return filePath;
}
