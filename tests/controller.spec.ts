import { describe, expect, it, vi } from 'vitest'
import { ClassifierController } from '../src/client/controller.ts'
import { emptyState } from '../src/domain/model.ts'
import type { ClassifierState } from '../src/types.ts'

class Feed {
  readonly abort = new AbortController()
  readonly signal = this.abort.signal
  private queue: { generation: number; value: { type: 'snapshot'; state: ClassifierState }; accept: () => void }[] = []
  private wake: (() => void) | undefined
  private failure: Error | undefined
  private closed = false
  push(revision: number, generation = 1) { this.queue.push({ generation, value: { type: 'snapshot', state: { ...emptyState(), revision } }, accept: () => {} }); this.wake?.() }
  fail() { this.failure = new Error('transport terminal error'); this.wake?.() }
  async dispose() { this.closed = true; this.abort.abort(); this.wake?.() }
  async *[Symbol.asyncIterator]() {
    try {
      while (!this.closed) {
        if (this.failure) throw this.failure
        if (this.queue.length) yield this.queue.shift()!
        else await new Promise<void>(resolve => { this.wake = resolve })
      }
    } finally { this.abort.abort() }
  }
}

function harness(apply = vi.fn(async () => ({ ok: true, value: { ok: true, state: { ...emptyState(), revision: 1 } } }))) {
  const feeds: Feed[] = [], disposers: (() => Promise<void>)[] = []
  const remote = { betterClassifier: { apply, snapshot: vi.fn(async () => ({ ok: true, value: { ...emptyState(), revision: 5 } })), follow: () => {} },
    $stream: () => { const feed = new Feed(); feeds.push(feed); return feed } }
  const controller = new ClassifierController({ remote, effect: (setup: () => () => Promise<void>) => { disposers.push(setup()) } } as never)
  return { controller, feeds, remote, close: async () => { for (const dispose of disposers) await dispose() } }
}

describe('Client state ownership', () => {
  it('reports a terminal stream failure even when the transport aborts during finalization, and retry reconnects', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = harness()
    try {
      h.feeds[0]!.push(0)
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().phase).toBe('ready'))
      h.feeds[0]!.fail()
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().phase).toBe('error'))
      await h.controller.refresh()
      expect(h.feeds).toHaveLength(2)
      h.feeds[1]!.push(6)
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().state?.revision).toBe(6))
    } finally { await h.close(); logger.mockRestore() }
  })
  it('does not overwrite a newer streamed revision with a delayed mutation result', async () => {
    let finish!: (value: never) => void
    const apply = vi.fn(() => new Promise<never>(resolve => { finish = resolve }))
    const h = harness(apply)
    try {
      h.feeds[0]!.push(0)
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().phase).toBe('ready'))
      const writing = h.controller.mutate([{ kind: 'tag.create', id: 't', name: 'tag', color: '#123456' }])
      h.feeds[0]!.push(2)
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().state?.revision).toBe(2))
      finish({ ok: true, value: { ok: true, state: { ...emptyState(), revision: 1 } } } as never)
      expect(await writing).toBe(true)
      expect(h.controller.data.getSnapshot().state?.revision).toBe(2)
    } finally { await h.close() }
  })
  it('uses the dialog revision for edits and retains an editor after a conflict', async () => {
    const apply = vi.fn(async () => ({ ok: true, value: { ok: false, code: 'conflict', revision: 5 } }))
    const h = harness(apply as never)
    try {
      h.feeds[0]!.push(4)
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().phase).toBe('ready'))
      h.controller.edit({ kind: 'tag-manager', revision: 3 })
      expect(await h.controller.mutate([{ kind: 'tag.create', id: 't', name: 'tag', color: '#123456' }], 3)).toBe(false)
      expect(apply.mock.calls[0]![0]).toMatchObject({ expectedRevision: 3 })
      expect(h.controller.interaction.getSnapshot()).toMatchObject({ notice: 'conflict', editor: { kind: 'tag-manager' }, busy: false })
    } finally { await h.close() }
  })
})
