# Fader

Your X "Following" feed, with a fader for each account you follow. At 1 you see everything they post and reply. At 0.1 you only see their best 10%. At 0 they're muted.

It runs on your machine and reads X with your own browser session, not the paid API.

## Setup

1. Log in to x.com in your browser. Open DevTools (⌥⌘I on a Mac), go to **Application → Cookies → https://x.com**, and copy the values of `auth_token`, `ct0` and `twid`.
2. Put them in `.env.local` (see `.env.example`):

   ```
   X_AUTH_TOKEN=...
   X_CT0=...
   X_TWID=...
   ```

   `auth_token` gives full access to your account, so keep this file private. It is gitignored.
3. Install and start everything:

   ```bash
   pnpm install
   pnpm dev
   ```

   This runs the web app on http://localhost:3000 (reachable from this machine only) and the sync worker next to it.

The first sync reads your following list, then works through the accounts, a few pages each. It reads slowly on purpose (see Caveats), so with a few hundred follows the first sync takes a few hours. The Following tab is checked throughout, so new posts still show up within minutes. The sync light at the bottom of the menu (in the bottom bar on phones) shows what it's doing.

If X logs you out, or the cookies expire, copy fresh ones into `.env.local`. The worker picks them up without a restart.

## How the faders work

Every account's posts and replies from the last 30 days are ranked against each other by engagement:

```
likes + 2·reposts + 2·quotes + replies + bookmarks
```

Young posts haven't collected their engagement yet, so they're scored on a projection. Early numbers count for less, and the projection falls back on that account's typical post (posts and replies are compared separately). A fader at 0.25 lets through the posts that rank in the account's top 25%.

The bars on each fader are that account's recent posts, best first. The lit ones are what gets through.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | App and sync worker together |
| `pnpm dev:web` | App only |
| `pnpm worker` | Sync worker only |
| `pnpm sync` | One sync pass, then exit (good for checking your cookies) |
| `pnpm test` | Tests |
| `pnpm typecheck`, `pnpm lint` | Checks |

Data lives in `data/feed.db` (SQLite). Set `FEED_DB_PATH` to use another file.

## How syncing works

- **New posts**: X's own Following tab (latest first), every 3 minutes. It stops at posts it has already seen.
- **Replies and fresh numbers**: each account's posts-and-replies timeline, on a schedule set by how much the account posts. Busy accounts are read every 30 minutes. Quiet ones are read up to 12 hours apart.
- **Your following list**: once a day.
- Muted accounts (fader at 0) are never read.

## Caveats

- Using your session cookies to automate reading X is against X's terms of service, and X can lock or suspend accounts for unusual activity. Fader lowers that risk but can't remove it:
  - It only reads. It never posts, likes, follows or sends anything.
  - It paces itself: at most 40 requests per 15 minutes, 3–6 seconds apart, a small fraction of X's own limits (`REQUEST_BUDGET` in `src/lib/x/client.ts`). Don't raise it. It starts an account only when there's room to read it whole, and if it runs out partway anyway, it keeps what it read rather than reading the same pages again.
  - Only one worker runs at a time; a second one exits instead of doubling the traffic.
  - If X ever asks you to verify your account or shows a warning, stop the worker for a day or two.
- X's web client signs requests with an `x-client-transaction-id` header, and account timelines return 404 without it. Fader loads x.com/home with your session about once an hour to get the signing keys. If syncs start failing with 404s, X has probably changed how signing works, and updating `rettiwt-api` and `x-client-transaction-id` is the first thing to try.
