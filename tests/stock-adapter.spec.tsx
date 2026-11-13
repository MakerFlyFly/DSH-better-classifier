// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore, defineStore } from '@deepseek-ai/dsh-client-store'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/src/client/registry.ts'
import { installStockBrowser } from '../src/client/compat/install.ts'

const contexts: Context[] = []
afterEach(async () => { for (const ctx of contexts.splice(0)) await ctx.fiber.dispose() })
async function setup() {
  const ctx = new Context(); contexts.push(ctx)
  await ctx.plugin(SlotRegistry)
  ctx.provide('contextMenus', { active: createSnapshotStore(null) } as never)
  // The real registry validates ownership; this frame is never rendered in these lifetime tests.
  ctx.slots.register({ name: 'root', children: { 'sidebar.workspaces': { kind: 'single', scope: 'root' } } } as never, (() => null) as never)
  const requestSessionRename = vi.fn()
  const store = defineStore({ init: () => ({ orderBy: 'updated' }), actions: {} })
  const inject = () => ({ requestSessionRename, hooks: {
    workspaceActionRequest: createSnapshotStore(null), workspaceShortcuts: createSnapshotStore({}),
  } })
  const mountNative = () => ctx.slots.register({ name: 'sidebar.workspaces', locale: 'workspace', store, inject,
    children: {
      'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' },
      'sidebar.workspaces.session.row.action': { kind: 'list', scope: 'root' },
      'sidebar.session.row.leading': { kind: 'list', scope: 'root', inline: true },
      'sidebar.session.row.trailing': { kind: 'list', scope: 'root', inline: true },
      'sidebar.session.row.hover': { kind: 'list', scope: 'root' },
    },
  } as never, (() => null) as never)
  const unmountNative = mountNative()
  return { ctx, mountNative, unmountNative, store, requestSessionRename }
}
async function install(h: Awaited<ReturnType<typeof setup>>, phase = 'ready') {
  let status!: ReturnType<typeof installStockBrowser>
  const plugin = h.ctx.plugin({ inject: ['slots', 'contextMenus'], apply: (ctx: Context) => { status = installStockBrowser(ctx) } })
  await plugin.await()
  await vi.waitFor(() => expect(status.getSnapshot().phase).toBe(phase))
  return { plugin, status }
}

describe('stock sidebar registration adapter', () => {
  it('owns the initial shadow before plugin startup completes', async () => {
    const h = await setup()
    const plugin = h.ctx.plugin({ inject: ['slots', 'contextMenus'], apply: (ctx: Context) => {
      const status = installStockBrowser(ctx)
      expect(status.getSnapshot().phase).toBe('ready')
      expect(ctx.slots.entries('sidebar.workspaces').some(entry => entry.options.priority === -100)).toBe(true)
    } })
    await plugin.await()
    await plugin.dispose()
  })
  it('shares native actions and store, mirrors late contributions, and restores the exact native entry on unload', async () => {
    const h = await setup()
    const original = h.ctx.slots.entries('sidebar.workspaces')[0]
    const { plugin } = await install(h)
    const shadow = h.ctx.slots.entries('sidebar.workspaces').find(entry => entry.options.priority === -100)!
    expect(shadow.store).toBe(h.store)
    expect(shadow.inject!().requestSessionRename).toBe(h.requestSessionRename)
    const component = () => null
    const remove = h.ctx.slots.register({ name: 'sidebar.session.row.trailing', id: 'late', order: 10 } as never, component as never)
    await vi.waitFor(() => expect(h.ctx.slots.entries('betterClassifier.session.row.trailing')[0]?.component).toBe(component))
    remove()
    await vi.waitFor(() => expect(h.ctx.slots.entries('betterClassifier.session.row.trailing')).toHaveLength(0))
    await plugin.dispose()
    expect(h.ctx.slots.entries('sidebar.workspaces')).toEqual([original])
    expect(h.ctx.slots.entries('betterClassifier.tree')).toHaveLength(0)
    await install(h)
    expect(h.ctx.slots.entries('sidebar.workspaces')).toHaveLength(2)
  })
  it('retires borrowed actions with the native owner and rebinds when the owner returns', async () => {
    const h = await setup()
    const { plugin } = await install(h)
    h.unmountNative()
    await vi.waitFor(() => expect(h.ctx.slots.entries('sidebar.workspaces')).toHaveLength(0))
    h.mountNative()
    await vi.waitFor(() => expect(h.ctx.slots.entries('sidebar.workspaces')).toHaveLength(2))
    await plugin.dispose()
    expect(h.ctx.slots.entries('sidebar.workspaces')).toHaveLength(1)
  })
  it.each([true, false])('leaves nested contributions intact and restores after their removal (initial=%s)', async initial => {
    const h = await setup()
    const original = h.ctx.slots.entries('sidebar.workspaces')[0]
    const trailing = () => null
    h.ctx.slots.register({ name: 'sidebar.session.row.trailing', id: 'plain' } as never, trailing as never)
    const later = vi.fn()
    h.ctx.on('slots/changed', key => { if (key === 'sidebar.session.row.trailing') later() })
    const registerNested = () => h.ctx.slots.register({ name: 'sidebar.session.row.trailing', id: 'nested', children: { 'review.nested': { kind: 'list', scope: 'root' } } } as never, (() => null) as never)
    const early = initial ? registerNested() : undefined
    const { plugin, status } = await install(h, initial ? 'fallback' : 'ready')
    let remove = early
    if (!initial) {
      await vi.waitFor(() => expect(h.ctx.slots.entries('betterClassifier.session.row.trailing')).toHaveLength(1))
      expect(() => { remove = registerNested() }).not.toThrow()
    }
    await vi.waitFor(() => expect(status.getSnapshot().phase).toBe('fallback'))
    expect(later).toHaveBeenCalled()
    expect(h.ctx.slots.spec('review.nested' as never)).toBeDefined()
    expect(h.ctx.slots.entries('sidebar.workspaces')).toEqual([original])
    expect(h.ctx.slots.entries('sidebar.session.row.trailing')).toHaveLength(2)
    expect(h.ctx.slots.entries('betterClassifier.session.row.trailing')).toHaveLength(0)
    expect(h.ctx.slots.snapshot('factory:betterClassifier.sessionRow')).toHaveLength(0)
    remove!()
    await vi.waitFor(() => expect(status.getSnapshot().phase).toBe('ready'))
    expect(h.ctx.slots.entries('betterClassifier.session.row.trailing')[0]?.component).toBe(trailing)
    await plugin.dispose()
    expect(h.ctx.slots.entries('sidebar.workspaces')).toEqual([original])
  })
  it('does not reinstall a queued adapter after its plugin is disabled', async () => {
    const h = await setup()
    const { plugin } = await install(h)
    h.ctx.slots.register({ name: 'sidebar.session.row.trailing', id: 'queued' } as never, (() => null) as never)
    await plugin.dispose()
    await Promise.resolve()
    expect(h.ctx.slots.entries('sidebar.workspaces')).toHaveLength(1)
    expect(h.ctx.slots.entries('betterClassifier.session.row.trailing')).toHaveLength(0)
    expect(h.ctx.slots.snapshot('factory:betterClassifier.sessionRow')).toHaveLength(0)
  })
  it('rolls back a halfway mount failure without retrying its own shadow changes', async () => {
    const h = await setup()
    const removeBlocker = h.ctx.slots.registerFactory({ name: 'betterClassifier.sessionRow', scope: 'root' } as never, (() => null) as never)
    let attempts = 0
    h.ctx.on('slots/changed', key => {
      if (key === 'sidebar.workspaces' && h.ctx.slots.entries(key).some(entry => entry.options.priority === -100)) {
        attempts++
        // Bound a broken implementation so the regression fails instead of starving the runner.
        if (attempts === 4) removeBlocker()
      }
    })
    const { plugin, status } = await install(h, 'fallback')
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(attempts).toBe(1)
    expect(h.ctx.slots.entries('sidebar.workspaces')).toHaveLength(1)
    removeBlocker()
    h.unmountNative(); h.mountNative()
    await vi.waitFor(() => expect(status.getSnapshot().phase).toBe('ready'))
    await plugin.dispose()
  })
})
