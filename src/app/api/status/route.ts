import { countNewer, getSyncStatus, toFeedFilter } from "@/lib/store"

// Polled by the header (sync status) and the feed ("N new posts").
// A route handler rather than a server action: actions run one at a time per
// client, so polling through them would hold up saving a fader.

export type StatusResponse = ReturnType<typeof getSyncStatus> & { newPosts: number | null }

export function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const since = Number(params.get("since"))
  const filter = toFeedFilter(params.get("show"))

  const body: StatusResponse = {
    ...getSyncStatus(),
    newPosts: since > 0 ? countNewer(since, filter) : null,
  }
  return Response.json(body)
}
