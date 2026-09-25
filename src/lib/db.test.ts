import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { expect, it } from "vitest"

process.env.FEED_DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "feed-test-")), "feed.db")
const { getDb } = await import("@/lib/db")

it("gives tweets ranked before split faders their overall rank among their kind", () => {
  // A database from before split faders: no kind_top yet.
  const old = getDb()
  old.exec("ALTER TABLE tweets DROP COLUMN kind_top")
  old.exec(`
    INSERT INTO accounts (id, handle, name) VALUES ('1', 'someone', 'Someone');
    INSERT INTO tweets (id, author_id, kind, created_at, content, likes, reposts, replies, quotes, bookmarks, metrics_at, top)
    VALUES ('10', '1', 'reply', 0, '{}', 0, 0, 0, 0, 0, 0, 0.2);
  `)
  old.close()
  globalThis.__feedDb = undefined

  const row = getDb().prepare("SELECT kind_top FROM tweets WHERE id = '10'").get()
  expect(row?.kind_top).toBe(0.2)
})
