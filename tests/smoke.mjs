import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRssService } from "../lib/rss-service.js";
import { parseFeedDocument, parseOpmlDocument } from "../lib/parser.js";

const fixtureDir = path.resolve("./fixtures");
const rssFixture = await fs.readFile(path.join(fixtureDir, "sample-rss.xml"), "utf-8");
const atomFixture = await fs.readFile(path.join(fixtureDir, "sample-atom.xml"), "utf-8");
const opmlFixture = await fs.readFile(path.join(fixtureDir, "sample.opml"), "utf-8");

const parsedRss = parseFeedDocument(rssFixture, "https://example.com/rss.xml", {
  summaryLength: 280,
  contentSnippetLength: 560,
});
assert.equal(parsedRss.format, "rss");
assert.equal(parsedRss.items.length, 2);

const parsedAtom = parseFeedDocument(atomFixture, "https://example.com/atom.xml", {
  summaryLength: 280,
  contentSnippetLength: 560,
});
assert.equal(parsedAtom.format, "atom");
assert.equal(parsedAtom.items.length, 2);

const parsedOpml = parseOpmlDocument(opmlFixture);
assert.equal(parsedOpml.subscriptions.length, 2);

const rssEtag = '"rss-fixture-etag"';
const atomEtag = '"atom-fixture-etag"';

const server = http.createServer((req, res) => {
  if (req.url === "/rss.xml") {
    if (req.headers["if-none-match"] === rssEtag) {
      res.writeHead(304, { ETag: rssEtag, "Last-Modified": "Tue, 31 Mar 2026 09:00:00 GMT" });
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/rss+xml; charset=utf-8",
      ETag: rssEtag,
      "Last-Modified": "Tue, 31 Mar 2026 09:00:00 GMT",
    });
    res.end(rssFixture);
    return;
  }

  if (req.url === "/atom.xml") {
    if (req.headers["if-none-match"] === atomEtag) {
      res.writeHead(304, { ETag: atomEtag, "Last-Modified": "Tue, 31 Mar 2026 10:05:00 GMT" });
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/atom+xml; charset=utf-8",
      ETag: atomEtag,
      "Last-Modified": "Tue, 31 Mar 2026 10:05:00 GMT",
    });
    res.end(atomFixture);
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hanako-rss-smoke-"));

const ctx = {
  dataDir: path.join(tempRoot, "plugin-data"),
  config: { get: () => undefined, set: () => undefined },
  log: console,
};
const service = createRssService(ctx);

try {
  const addRss = await service.addFeed({ url: `http://127.0.0.1:${port}/rss.xml` });
  assert.equal(addRss.action, "added");
  assert.equal(addRss.refresh.insertedCount, 2);

  const refreshRss = await service.refreshFeed({ feedId: addRss.feed.id });
  assert.equal(refreshRss.refresh.status, "not_modified");

  const addAtom = await service.addFeed({ url: `http://127.0.0.1:${port}/atom.xml` });
  assert.equal(addAtom.action, "added");
  assert.equal(addAtom.refresh.insertedCount, 2);

  const unread = await service.listUnreadItems({ limit: 10 });
  assert.equal(unread.totalUnread, 4);

  const exportResult = await service.exportOpml({});
  assert.ok(exportResult.filePath.endsWith(".opml"));
  console.log("hanako-rss smoke test passed", {
    rssFeedId: addRss.feed.id,
    atomFeedId: addAtom.feed.id,
    unreadCount: unread.totalUnread,
    exportPath: exportResult.filePath,
  });
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
