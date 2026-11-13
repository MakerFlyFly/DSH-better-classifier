import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { searchContent } from '../src/host/search.ts'

function fixture(ids: string[], denied = new Set<string>()) {
  const searchSessions = vi.fn()
  const ctx = { sessionQuery: { listSessions: async () => ids.map(id => ({ header: { id, cwd: '/fixture' } })), searchSessions },
    remoteAccess: { allows: ({ id }: { id: string }) => !denied.has(id) } } as unknown as Context
  return { ctx, searchSessions }
}
const hit = (id: string, snippet = '蓝鲸检索') => ({ header: { id }, bestMatch: { sessionId: id, surface: 'current', type: 'user/message', snippet } })
describe('stock index search', () => {
  it('applies candidate and access predicates before ranking so an outside top-20 hit remains reachable', async () => {
    const h = fixture([...Array.from({ length: 25 }, (_, i) => 'covered-' + i), 'denied', 'wanted'], new Set(['denied']))
    h.searchSessions.mockImplementation(async request => {
      expect(request.sessionFilters).toEqual([{ kind: 'id', values: ['wanted'] }])
      return { items: [hit('wanted')] }
    })
    expect(await searchContent(h.ctx, { query: '蓝鲸检索', sessionIds: ['wanted', 'denied', 'unknown'] }, new AbortController().signal))
      .toEqual({ items: [{ sessionId: 'wanted', snippet: '蓝鲸检索' }], hasMore: false })
  })
  it('deduplicates pages, rejects forged hits, rechecks grants, and counts only accepted hits', async () => {
    const ids = Array.from({ length: 23 }, (_, i) => 's' + i)
    const denied = new Set<string>()
    const h = fixture(ids, denied)
    h.searchSessions.mockResolvedValueOnce({ items: ids.slice(0, 20).map(id => hit(id)), nextCursor: 'page2' })
      .mockImplementationOnce(async () => { denied.add('s20'); return { items: [hit('s0'), hit('forged'), hit('s20'), hit('s21'), hit('s22')] } })
    const result = await searchContent(h.ctx, { query: '蓝鲸检索', sessionIds: ids }, new AbortController().signal)
    expect(result.items).toHaveLength(20)
    expect(result.hasMore).toBe(true)
    expect(result.items.some(item => ['s20', 'forged'].includes(item.sessionId))).toBe(false)
  })
  it('returns no hits without candidates, aborts stale work, and refuses repeated cursors', async () => {
    const h = fixture(['s'])
    expect(await searchContent(h.ctx, { query: 'text', sessionIds: [] }, new AbortController().signal)).toEqual({ items: [], hasMore: false })
    expect(h.searchSessions).not.toHaveBeenCalled()
    const abort = new AbortController(); abort.abort()
    await expect(searchContent(h.ctx, { query: 'text', sessionIds: ['s'] }, abort.signal)).rejects.toThrow()
    h.searchSessions.mockResolvedValue({ items: [], nextCursor: 'repeat' })
    await expect(searchContent(h.ctx, { query: 'text', sessionIds: ['s'] }, new AbortController().signal)).rejects.toThrow('repeated')
  })
})
