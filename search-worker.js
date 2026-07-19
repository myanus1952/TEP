/*
 * Runs Fuse.js fuzzy search for the Bible and source-text indices off the
 * main thread. Typing in the search box posts a query here and waits for a
 * postMessage back — the main thread is never blocked by search cost,
 * regardless of query length or how large the indexed text is.
 */
// Vendored locally (not loaded from a CDN) so this worker never depends on a
// network fetch to start up — a service worker reliably caches same-origin
// requests across all browsers, whereas its ability to intercept a Worker's
// cross-origin importScripts() call is inconsistent (notably on Safari/iOS).
importScripts('./fuse.min.js');

const FUSE_OPTIONS = { keys: ['text'], threshold: 0.32, includeScore: true, ignoreLocation: true };

// Generous margin over every UI section's display cap (25 max) — keeps the
// postMessage payload small for common queries that match thousands of rows,
// without ever truncating what a panel actually needs to show.
const TOP_CAP = 30;

const indices = {}; // name ('bible' | 'source') -> Fuse instance or null

self.onmessage = (e) => {
  const msg = e.data;

  if (msg.type === 'load') {
    indices[msg.name] = msg.data.length ? new Fuse(msg.data, FUSE_OPTIONS) : null;
    return;
  }

  if (msg.type === 'search') {
    const bible = indices.bible ? indices.bible.search(msg.query) : [];

    let source = indices.source ? indices.source.search(msg.query) : [];
    if (msg.sourceIdWhitelist) {
      const whitelist = new Set(msg.sourceIdWhitelist);
      source = source.filter((m) => whitelist.has(m.item.sourceId));
    }

    self.postMessage({
      type: 'search-result',
      reqId: msg.reqId,
      phase: msg.phase,
      rawQuery: msg.rawQuery,
      query: msg.query,
      bible: { total: bible.length, top: bible.slice(0, TOP_CAP) },
      source: { total: source.length, top: source.slice(0, TOP_CAP) }
    });
  }
};
