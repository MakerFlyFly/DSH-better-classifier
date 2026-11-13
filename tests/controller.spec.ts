import { describe, expect, it, vi } from 'vitest'
import { ClassifierController } from '../src/client/controller.ts'
import { emptyState } from '../src/domain/model.ts'
import type { ClassifierState, MutationRequest } from '../src/types.ts'

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

function harness(apply: (request: MutationRequest) => Promise<unknown> = vi.fn(async (_request: MutationRequest) => ({ ok: true, value: { ok: true, state: { ...emptyState(), revision: 1 } } }))) {
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
    const apply = vi.fn(async (_request: MutationRequest) => ({ ok: true, value: { ok: false, code: 'conflict', revision: 5 } }))
    const h = harness(apply)
    try {
      h.feeds[0]!.push(4)
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().phase).toBe('ready'))
      h.controller.edit({ kind: 'tags', targets: [{ kind: 'session', id: 's' }], revision: 3 })
      expect(await h.controller.mutate([{ kind: 'tag.create', id: 't', name: 'tag', color: '#123456' }], 3)).toBe(false)
      expect(apply.mock.calls[0]![0]).toMatchObject({ expectedRevision: 3 })
      expect(h.controller.interaction.getSnapshot()).toMatchObject({ notice: 'conflict', editor: { kind: 'tags' }, busy: false })
    } finally { await h.close() }
  })
  it('coalesces concurrent retries into one replacement stream and disposes every stream', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = harness()
    try {
      h.feeds[0]!.fail()
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().phase).toBe('error'))
      const first = h.controller.refresh(), second = h.controller.refresh()
      expect(second).toBe(first)
      await Promise.all([first, second])
      expect(h.feeds).toHaveLength(2)
      expect(h.remote.betterClassifier.snapshot).toHaveBeenCalledTimes(1)
      await h.close()
      expect(h.feeds.every(feed => feed.signal.aborted)).toBe(true)
    } finally { await h.close(); logger.mockRestore() }
  })
  it('ignores a late snapshot and cannot restart after disposal', async () => {
    const h = harness()
    let finish!: (value: { ok: boolean; value: ClassifierState }) => void
    try {
      h.feeds[0]!.push(2)
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().phase).toBe('ready'))
      h.remote.betterClassifier.snapshot.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      const pending = h.controller.refresh()
      await h.close()
      const before = h.controller.data.getSnapshot()
      finish({ ok: true, value: { ...emptyState(), revision: 99 } })
      await pending
      await h.controller.refresh()
      expect(h.controller.data.getSnapshot()).toBe(before)
      expect(h.feeds).toHaveLength(1)
      expect(h.remote.betterClassifier.snapshot).toHaveBeenCalledTimes(1)
    } finally { await h.close() }
  })
  it('does not let a late snapshot conceal a newer stream failure', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = harness()
    let finish!: (value: { ok: boolean; value: ClassifierState }) => void
    try {
      h.feeds[0]!.fail()
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().phase).toBe('error'))
      h.remote.betterClassifier.snapshot.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      const pending = h.controller.refresh()
      await vi.waitFor(() => expect(h.feeds).toHaveLength(2))
      h.feeds[1]!.fail()
      await vi.waitFor(() => expect(h.feeds[1]!.signal.aborted).toBe(true))
      finish({ ok: true, value: { ...emptyState(), revision: 10 } })
      await pending
      expect(h.controller.data.getSnapshot()).toMatchObject({ phase: 'error', state: { revision: 10 } })
    } finally { await h.close(); logger.mockRestore() }
  })
  it('keeps a newer subscription failure visible after a successful in-flight write', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    let finish!: (value: unknown) => void
    const h = harness(() => new Promise(resolve => { finish = resolve }))
    try {
      h.feeds[0]!.push(0)
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().phase).toBe('ready'))
      const writing = h.controller.mutate([{ kind: 'tag.create', id: 't', name: 'tag', color: '#123456' }])
      h.feeds[0]!.fail()
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().phase).toBe('error'))
      finish({ ok: true, value: { ok: true, state: { ...emptyState(), revision: 1 } } })
      expect(await writing).toBe(true)
      expect(h.controller.data.getSnapshot()).toMatchObject({ phase: 'error', state: { revision: 1 } })
    } finally { await h.close(); logger.mockRestore() }
  })
  it('restores writes after failure without replacing the captured editor revision', async () => {
    const apply = vi.fn<(request: MutationRequest) => Promise<unknown>>()
      .mockResolvedValueOnce({ ok: false, error: 'write failed' })
      .mockResolvedValueOnce({ ok: true, value: { ok: true, state: { ...emptyState(), revision: 6 } } })
    const h = harness(apply)
    try {
      h.feeds[0]!.push(5)
      await vi.waitFor(() => expect(h.controller.data.getSnapshot().phase).toBe('ready'))
      const editor = { kind: 'folder.create' as const, scope: { kind: 'global' as const }, parentId: null, revision: 5 }
      h.controller.edit(editor)
      const commands = [{ kind: 'folder.create' as const, id: 'f', name: '草稿', scope: { kind: 'global' as const }, parentId: null }]
      expect(await h.controller.mutate(commands, editor.revision)).toBe(false)
      expect(h.controller.interaction.getSnapshot().editor).toEqual(editor)
      await h.controller.refresh()
      expect(await h.controller.mutate(commands, editor.revision)).toBe(true)
      expect(apply.mock.calls.map(([request]) => request.expectedRevision)).toEqual([5, 5])
    } finally { await h.close() }
  })
})
