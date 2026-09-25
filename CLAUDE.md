@AGENTS.md

# Project notes

- Two processes share `data/feed.db` (node:sqlite, WAL): the Next app (`src/app`) and the sync worker (`src/worker.ts`). They coordinate through the `kv` table (sync status, sync requests, default ratio). Queries live in `src/lib/store.ts`; the schema and its migrations in `src/lib/db.ts`.
- X access: `src/lib/x/client.ts` wraps rettiwt-api with cookie auth. rettiwt's own x-client-transaction-id generation is replaced: it fetched x.com/home without cookies (logged-out page, no signing keys). `XClient` loads it with the session instead and caches the signer for an hour. `src/lib/x/normalize.ts` turns X's tweets into our shape.
- X timelines mix in tweets that aren't entries: the pinned tweet on every page, and the tweets replies answer (often much older). `src/lib/sync.ts` judges how far back it has read by entries only.
- Ranking: `src/lib/ranking.ts`. `top` is a tweet's rank within its author's last 30 days (0 = best), `kind_top` its rank among only their posts or only their replies. The feed's rule is `src/lib/faders.ts` (and `IN_FEED` in SQL): one fader shows a tweet when `top <= ratio`; once replies have their own fader (`reply_ratio` set), posts need `kind_top <= ratio` and replies `kind_top <= reply_ratio`.
- Pages read SQLite synchronously, so they call `await connection()` first.
- `.env.local` holds the user's X session cookies. Never print or log their values; check only whether they're set.
