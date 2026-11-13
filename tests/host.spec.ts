import { mkdtemp, readFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage, { StorageError, type StorageBackend } from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json'
import BetterClassifier from 'dsh-better-classifier'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })

async function harness() {
  const parent = resolve('.dev/host-tests'); await mkdir(parent, { recursive: true })
  const root = await mkdtemp(join(parent, 'case-'))
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new JsonStorageBackend(root)
  let failing = false
  const fault: StorageBackend = {
    kv: { open: async descriptor => {
      const unit = await backend.kv.open(descriptor)
      return new Proxy(unit, { get(target, property) {
        if (property === 'putRecord') return async (...args: Parameters<typeof unit.putRecord>) => {
          if (failing) throw new StorageError('malformed-medium', 'Simulated storage write refusal')
          return target.putRecord(...args)
        }
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      } })
    } },
    close: () => backend.close(),
  }
  ctx.storage.backend.register('test', fault)
  ctx.provide('storageDomain', new DomainFacility(ctx, { backend: 'test' }))
  ctx.provide('typert', {} as never)
  ctx.provide('remoteAccess', { allows: () => true } as never)
  ctx.provide('workspaceRegistry', { list: () => [] } as never)
  ctx.provide('sessionQuery', { listSessions: async () => [] } as never)
  const fiber = ctx.plugin(BetterClassifier)
  await fiber.await()
  const service = ctx.get('betterClassifier')!
  await service.snapshot()
  cleanups.push(async () => { await ctx.fiber.dispose(); await backend.close() })
  return { ctx, service, fiber, root, fail: (value: boolean) => { failing = value } }
}

describe('Host storage and subscription ownership', () => {
  it('does not write or broadcast a no-op, and still checks its expected revision', async () => {
    const h = await harness()
    await h.service.apply({ expectedRevision: 0, commands: [{ kind: 'tag.create', id: 't', name: '重点', color: '#123456' }] })
    const before = await readFile(join(h.root, 'better_classifier.json'))
    const changes: unknown[] = []
    h.ctx.on('domain/changed', event => { if (event.domain === 'better_classifier') changes.push(event) })
    const commands = [{ kind: 'tag.update' as const, id: 't', name: '重点', color: '#123456' }]
    h.fail(true)
    expect(await h.service.apply({ expectedRevision: 1, commands })).toMatchObject({ ok: true, state: { revision: 1 } })
    expect(await h.service.apply({ expectedRevision: 0, commands })).toMatchObject({ ok: false, code: 'conflict' })
    expect(changes).toEqual([])
    expect(await readFile(join(h.root, 'better_classifier.json'))).toEqual(before)
  })
  it('publishes only after durable commit and preserves state on a storage write failure', async () => {
    const h = await harness()
    const changes: unknown[] = []
    h.ctx.on('domain/changed', event => { if (event.domain === 'better_classifier') changes.push(event) })
    const before = await h.service.snapshot()
    const request = { expectedRevision: before.revision, commands: [{ kind: 'folder.create' as const, id: 'folder', name: '工作', scope: { kind: 'global' as const }, parentId: null }] }
    h.fail(true)
    await expect(h.service.apply(request)).rejects.toThrow('Simulated storage')
    expect(await h.service.snapshot()).toEqual(before)
    expect(changes).toEqual([])
    h.fail(false)
    expect((await h.service.apply(request)).ok).toBe(true)
    const disk = JSON.parse(await readFile(join(h.root, 'better_classifier.json'), 'utf8'))
    expect(disk.tables.state.root).toEqual(await h.service.snapshot())
    expect(changes).toHaveLength(1)
  })

  it('keeps data through plugin unload/reload and returns fresh snapshots', async () => {
    const h = await harness()
    await h.service.apply({ expectedRevision: 0, commands: [{ kind: 'tag.create', id: 't', name: '重点', color: '#123456' }] })
    const detached = await h.service.snapshot(); detached.tags[0]!.name = 'local mutation'
    expect((await h.service.snapshot()).tags[0]!.name).toBe('重点')
    await h.fiber.dispose()
    expect(h.ctx.get('betterClassifier')).toBeUndefined()
    const next = h.ctx.plugin(BetterClassifier); await next.await()
    expect((await h.ctx.get('betterClassifier')!.snapshot()).tags[0]!.color).toBe('#123456')
  })

  it('resolves concurrent revisions once and releases follow listeners on cancellation', async () => {
    const h = await harness()
    const cancellation = new AbortController()
    const stream = h.service.follow(cancellation.signal)[Symbol.asyncIterator]()
    expect((await stream.next()).value.state.revision).toBe(0)
    const results = await Promise.all(['one', 'two'].map(id => h.service.apply({ expectedRevision: 0, commands: [{ kind: 'tag.create', id, name: id, color: '#112233' }] })))
    expect(results.filter(result => result.ok)).toHaveLength(1)
    expect(results.filter(result => !result.ok && result.code === 'conflict')).toHaveLength(1)
    expect((await stream.next()).value.state.revision).toBe(1)
    const pending = stream.next()
    cancellation.abort()
    expect((await pending).done).toBe(true)
  })
})
