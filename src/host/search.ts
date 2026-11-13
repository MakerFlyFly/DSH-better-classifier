/** Candidate-filtered body search over the stock DSH index; no Session activation. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-api-remote-access'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSearchCursor } from '@deepseek-ai/dsh-session-query'
import type { ContentSearchRequest, ContentSearchResult } from '../types.ts'

/** Apply visibility and authorization before provider ranking and result truncation. */
export async function searchContent(ctx: Context, request: ContentSearchRequest, signal: AbortSignal): Promise<ContentSearchResult> {
  const query = request.query.trim()
  if (!query || query.length > 500 || query.includes('\0') || request.sessionIds.length > 100_000) throw new Error('Invalid content search request')
  signal.throwIfAborted()
  const offered = new Set(request.sessionIds)
  if (!offered.size) return { items: [], hasMore: false }
  const visible = await ctx.sessionQuery.listSessions(signal)
  const candidates = visible.filter(record => record.header.cwd !== undefined && offered.has(record.header.id)
    && ctx.remoteAccess.allows({ kind: 'session', id: record.header.id })).map(record => record.header.id)
  if (!candidates.length) return { items: [], hasMore: false }
  const accepted = new Set<SessionId>()
  const permitted = new Set(candidates)
  const seenCursors = new Set<SessionSearchCursor>()
  const items: ContentSearchResult['items'] = []
  let cursor: SessionSearchCursor | undefined
  for (let pageNumber = 0; pageNumber < 64; pageNumber++) {
    signal.throwIfAborted()
    const page = await ctx.sessionQuery.searchSessions({ query, limit: 20,
      sessionFilters: [{ kind: 'id', values: candidates }],
      eventFilters: [{ kind: 'type', values: ['user/message', 'assistant/message'] }, { kind: 'surface', values: ['current'] }],
      ...(cursor === undefined ? {} : { cursor }),
    }, { signal })
    signal.throwIfAborted()
    if (page.items.length > 20) throw new Error('Search provider exceeded its page bound')
    for (const hit of page.items) {
      const id = hit.header.id
      if (!permitted.has(id) || accepted.has(id) || hit.bestMatch.sessionId !== id || hit.bestMatch.surface !== 'current'
        || !['user/message', 'assistant/message'].includes(hit.bestMatch.type)
        || !ctx.remoteAccess.allows({ kind: 'session', id })) continue
      accepted.add(id)
      items.push({ sessionId: id, snippet: [...hit.bestMatch.snippet].slice(0, 300).join('') })
      if (items.length > 20) return { items: items.slice(0, 20), hasMore: true }
    }
    if (page.nextCursor === undefined) return { items, hasMore: false }
    if (seenCursors.has(page.nextCursor)) throw new Error('Search provider repeated its cursor')
    seenCursors.add(page.nextCursor)
    cursor = page.nextCursor
  }
  throw new Error('Content search work budget exceeded')
}
