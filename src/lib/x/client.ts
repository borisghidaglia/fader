import { parseHTML } from "linkedom"
import { Rettiwt, TwitterError, type Tweet } from "rettiwt-api"
import { ClientTransaction } from "x-client-transaction-id"

import { toIncomingAccount, type IncomingAccount } from "@/lib/x/normalize"

// Talks to X's internal web API (the one x.com itself uses) with your session
// cookies, through rettiwt-api, which keeps up with X's GraphQL query ids.

/** X's GraphQL operations we call. Each has its own rate limit, usually per 15 minutes. */
export type Operation = "Following" | "UserTweetsAndReplies" | "HomeLatestTimeline"

export type XCredentials = { authToken: string; ct0: string; twid: string }

export class RateLimitedError extends Error {
  constructor(
    readonly operation: string,
    readonly resetAt: number,
  ) {
    super(`Rate limited on ${operation} until ${new Date(resetAt).toLocaleTimeString()}`)
  }
}

export class AuthError extends Error {}

/** X can't be reached or isn't answering normally: nothing to do with any one account. */
export class UnavailableError extends Error {}

// Pacing. X's own limits (about 500 requests per 15 minutes for each kind of
// timeline) are a ceiling, not a target: reading anywhere near them looks nothing
// like a person, and unusual activity is what gets accounts locked. So Fader keeps
// to a budget of its own, closer to someone checking X now and then.

/** Most requests in any 15 minutes, across everything Fader reads. */
const REQUEST_BUDGET = 40
const BUDGET_WINDOW_MS = 15 * 60_000
/** Of the budget, what's kept for the Following tab so new posts arrive during long syncs. */
const FEED_SHARE = 5
/** Minimum gap between two requests, plus up to the same again at random. */
const MIN_REQUEST_GAP_MS = 3_000
/** Stop this far short of X's own limit, leaving room for your own browsing. */
const RATE_LIMIT_RESERVE = 50
const FALLBACK_RESET_MS = 15 * 60_000
/** How long the request-signing keys from x.com/home are reused. */
const SIGNER_TTL_MS = 60 * 60_000
/** After a failure to load them, wait this long before fetching x.com/home again. */
const SIGNER_RETRY_MS = 5 * 60_000
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

type HttpErrorLike = {
  isAxiosError?: boolean
  status?: number
  message?: string
  config?: { url?: string }
  response?: { status?: number; headers?: Record<string, unknown>; data?: unknown }
}

export function credentialsFromEnv(): XCredentials {
  const authToken = process.env.X_AUTH_TOKEN?.trim()
  const ct0 = process.env.X_CT0?.trim()
  const twid = process.env.X_TWID?.trim()
  if (!authToken || !ct0 || !twid) {
    throw new AuthError(
      "Missing X cookies. Copy auth_token, ct0 and twid from x.com (DevTools → Application → Cookies) into .env.local.",
    )
  }
  return { authToken, ct0, twid }
}

export class XClient {
  /** Your own X user id, from the twid cookie ("u=123…"). */
  readonly viewerId: string
  private readonly rettiwt: Rettiwt
  private readonly cookie: string
  private readonly limits = new Map<string, { remaining: number; resetAt: number }>()
  /** When recent requests were sent, oldest first, for the budget. */
  private readonly sent: number[] = []
  private nextRequestAt = 0
  private signer: { transaction: Promise<ClientTransaction>; createdAt: number; expiresAt: number } | null = null

  constructor(credentials: XCredentials) {
    this.viewerId = decodeURIComponent(credentials.twid).replace(/^"?u=/, "").replace(/"$/, "")
    this.cookie = `auth_token=${credentials.authToken}; ct0=${credentials.ct0}; twid=${credentials.twid}`
    const apiKey = Buffer.from(
      `auth_token=${credentials.authToken};ct0=${credentials.ct0};twid=${credentials.twid};`,
    ).toString("base64")

    this.rettiwt = new Rettiwt({
      apiKey,
      timeout: 30_000,
      responseMiddleware: (response) =>
        this.recordLimits(response.config.url, response.headers as Record<string, unknown>),
      errorHandler: {
        handle: (error) => {
          throw this.toError(error)
        },
      },
    })

    // X wants an x-client-transaction-id header, signed with keys from its
    // logged-in home page; without it account timelines return 404. rettiwt
    // fetches x.com/home without your cookies (getting the logged-out page, which
    // lacks the keys) and does so before every request, so do it here instead.
    Object.assign(this.rettiwt.user, {
      _getTransactionHeader: (method: string, url: string) => this.transactionHeader(method, url),
    })
  }

  /**
   * Milliseconds until `operation` may be called `requests` times in a row, by X's
   * limits and Fader's budget; 0 means now.
   */
  waitFor(operation: Operation, now = Date.now(), requests = 1): number {
    return Math.max(this.xLimitWait(operation, now), this.budgetWait(operation, now, requests))
  }

  private xLimitWait(operation: Operation, now: number): number {
    const limit = this.limits.get(operation)
    if (!limit || limit.resetAt <= now || limit.remaining > RATE_LIMIT_RESERVE) return 0
    return limit.resetAt - now
  }

  private budgetWait(operation: Operation, now: number, requests: number): number {
    while (this.sent.length > 0 && this.sent[0] <= now - BUDGET_WINDOW_MS) this.sent.shift()
    const budget = operation === "HomeLatestTimeline" ? REQUEST_BUDGET : REQUEST_BUDGET - FEED_SHARE
    // How many can already be in the window with room left for `requests` more.
    const allowed = budget - requests + 1
    if (this.sent.length < allowed) return 0
    // Until enough of the oldest requests leave the window.
    return this.sent[this.sent.length - allowed] + BUDGET_WINDOW_MS - now
  }

  /** One page (up to 100) of the accounts you follow, most recently followed first. */
  async following(cursor?: string): Promise<{ accounts: IncomingAccount[]; next: string | null }> {
    const page = await this.call("Following", () =>
      this.rettiwt.user.following(this.viewerId, 100, cursor),
    )
    return { accounts: page.list.map(toIncomingAccount), next: nextCursor(page.next, cursor) }
  }

  /** One page of an account's posts and replies, newest first (like their "Replies" tab). */
  async timeline(userId: string, cursor?: string): Promise<{ tweets: Tweet[]; next: string | null }> {
    const page = await this.call("UserTweetsAndReplies", () =>
      this.rettiwt.user.replies(userId, 20, cursor),
    )
    return { tweets: page.list, next: nextCursor(page.next, cursor) }
  }

  /** One page of X's own chronological Following tab. */
  async homeFeed(cursor?: string): Promise<{ tweets: Tweet[]; next: string | null }> {
    const page = await this.call("HomeLatestTimeline", () => this.rettiwt.user.followed(cursor))
    return { tweets: page.list, next: nextCursor(page.next, cursor) }
  }

  private async call<T>(operation: Operation, request: () => Promise<T>): Promise<T> {
    const wait = this.waitFor(operation)
    if (wait > 0) throw new RateLimitedError(operation, Date.now() + wait)

    const delay = this.nextRequestAt - Date.now()
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    this.nextRequestAt = Date.now() + MIN_REQUEST_GAP_MS * (1 + Math.random())
    this.sent.push(Date.now())

    try {
      return await request()
    } catch (error) {
      const failure = this.toError(error)
      if (!(failure instanceof RateLimitedError)) throw failure
      // Whatever form the limit arrived in, don't ask again before it resets.
      const resetAt = failure.resetAt > Date.now() ? failure.resetAt : Date.now() + FALLBACK_RESET_MS
      this.limits.set(operation, { remaining: 0, resetAt })
      throw new RateLimitedError(operation, resetAt)
    }
  }

  private async transactionHeader(method: string, url: string): Promise<Record<string, string>> {
    const transaction = await this.clientTransaction()
    const id = await transaction.generateTransactionId(method.toUpperCase(), new URL(url).pathname)
    return { "x-client-transaction-id": id }
  }

  private clientTransaction(): Promise<ClientTransaction> {
    const now = Date.now()
    if (!this.signer || now >= this.signer.expiresAt) {
      const signer = {
        transaction: loadClientTransaction(this.cookie),
        createdAt: now,
        expiresAt: now + SIGNER_TTL_MS,
      }
      // Keep a failure for a few minutes rather than refetching x.com on every request.
      signer.transaction.catch(() => {
        signer.expiresAt = Date.now() + SIGNER_RETRY_MS
      })
      this.signer = signer
    }
    return this.signer.transaction
  }

  private recordLimits(url: string | undefined, headers: Record<string, unknown> | undefined) {
    const operation = url && operationFromUrl(url)
    const remaining = Number(headers?.["x-rate-limit-remaining"])
    const reset = Number(headers?.["x-rate-limit-reset"])
    if (!operation || !Number.isFinite(remaining) || !Number.isFinite(reset)) return
    this.limits.set(operation, { remaining, resetAt: reset * 1000 })
  }

  /** Turns whatever rettiwt threw into one of the errors above, or a readable Error. */
  private toError(error: unknown): Error {
    if (
      error instanceof RateLimitedError ||
      error instanceof AuthError ||
      error instanceof UnavailableError
    ) {
      return error
    }

    if (error instanceof TwitterError) {
      // GraphQL errors arrive with HTTP 200; code 88 is "Rate limit exceeded".
      if (error.details?.some((d) => d.code === 88)) {
        return new RateLimitedError("unknown", Date.now() + FALLBACK_RESET_MS)
      }
      if (error.status === 401 || error.status === 403) return authError(error.status)
      return new Error(`X error: ${error.message}`)
    }

    const http = error as HttpErrorLike
    const status = http?.response?.status ?? http?.status
    if (http?.isAxiosError && status) {
      this.recordLimits(http.config?.url, http.response?.headers)
      if (status === 429) {
        const operation = operationFromUrl(http.config?.url ?? "") ?? "unknown"
        const resetAt = this.limits.get(operation)?.resetAt ?? Date.now() + FALLBACK_RESET_MS
        this.limits.set(operation, { remaining: 0, resetAt })
        return new RateLimitedError(operation, resetAt)
      }
      if (status === 401 || status === 403) return authError(status)
      if (status >= 500) return new UnavailableError(`X is having trouble (HTTP ${status})`)
      // A 404 usually means X rejected the signature: get fresh keys (at most every few minutes).
      if (status === 404 && this.signer && Date.now() - this.signer.createdAt > SIGNER_RETRY_MS) {
        this.signer.expiresAt = 0
      }
      return new Error(`X request failed with HTTP ${status}`)
    }
    // Never pass an HTTP client error on as is: its request config holds the cookie header.
    if (http?.isAxiosError) return new UnavailableError(`Can't reach X: ${http.message ?? "network error"}`)
    return error instanceof Error ? error : new Error(String(error))
  }
}

/** Loads x.com/home as you, and the signing keys in it. */
async function loadClientTransaction(cookie: string): Promise<ClientTransaction> {
  let response: Response
  let html: string
  try {
    response = await fetch("https://x.com/home", {
      headers: { cookie, "user-agent": BROWSER_USER_AGENT },
    })
    html = await response.text()
  } catch (error) {
    throw new UnavailableError(`Can't reach X: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (response.status >= 500) throw new UnavailableError(`X is having trouble (HTTP ${response.status})`)
  // X serves its logged-out page when it doesn't accept the session.
  if (!response.ok || html.includes("entry-client-logged-out")) {
    throw new AuthError(
      "x.com doesn't recognize your session. Copy fresh auth_token, ct0 and twid cookies into .env.local.",
    )
  }
  try {
    return await ClientTransaction.create(parseHTML(html).document as unknown as Document)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new UnavailableError(`Couldn't read X's request-signing keys from x.com/home: ${reason}`)
  }
}

function authError(status: number) {
  return new AuthError(
    `X rejected your session (HTTP ${status}). Copy fresh auth_token, ct0 and twid cookies into .env.local.`,
  )
}

/** ".../graphql/<queryId>/UserTweetsAndReplies?variables=…" → "UserTweetsAndReplies" */
function operationFromUrl(url: string): string | null {
  return url.split("?")[0].split("/").pop() || null
}

/** X keeps returning a bottom cursor after the last page; treat a repeat as the end. */
function nextCursor(next: string | undefined, current: string | undefined): string | null {
  return next && next !== current ? next : null
}
