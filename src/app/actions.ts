"use server"

import {
  feedPage,
  requestAccountSync,
  requestSync,
  setAccountFaders,
  setAccountSplit,
  setDefaultRatio,
  toFeedFilter,
  type FeedFilter,
} from "@/lib/store"
import type { Faders } from "@/lib/faders"
import type { FeedCursor, FeedItem } from "@/lib/types"

// Server actions are reachable by anything that can reach the app, so check inputs.
// The app itself is meant to run on your machine only (it has your X session), so
// the package scripts bind it to 127.0.0.1.

function assertRatio(ratio: unknown): asserts ratio is number {
  if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
    throw new Error("Ratio must be a number between 0 and 1")
  }
}

function assertId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !/^\d+$/.test(id)) throw new Error("Invalid account id")
}

/** Saves the faders given; the other keeps its saved setting. */
export async function saveAccountFaders(accountId: string, { ratio, replyRatio }: Partial<Faders>) {
  assertId(accountId)
  if (ratio != null) assertRatio(ratio)
  if (replyRatio != null) assertRatio(replyRatio)
  setAccountFaders(accountId, { ratio, replyRatio })
}

/** Splits an account's fader in two or joins its two, returning where they end up. */
export async function splitAccountFaders(accountId: string, split: boolean): Promise<Faders> {
  assertId(accountId)
  if (typeof split !== "boolean") throw new Error("Split must be true or false")
  return setAccountSplit(accountId, split)
}

export async function saveDefaultRatio(ratio: number) {
  assertRatio(ratio)
  setDefaultRatio(ratio)
}

export async function loadFeedPage(cursor: FeedCursor, filter: FeedFilter): Promise<FeedItem[]> {
  if (typeof cursor?.createdAt !== "number" || typeof cursor?.id !== "string") {
    throw new Error("Invalid cursor")
  }
  return feedPage({ cursor, filter: toFeedFilter(filter) })
}

export async function syncNow() {
  requestSync()
}

export async function syncAccountNow(accountId: string) {
  assertId(accountId)
  requestAccountSync(accountId)
  requestSync()
}
