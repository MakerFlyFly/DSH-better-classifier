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

describe('stock sidebar registration adapter', () => {
  it('shares native actions and store, mirrors late contributions, and restores the exact native entry on unload', async () => {
    const h = await setup()
    const original = h.ctx.slots.entries('sidebar.workspaces')[0]
    const plugin = h.ctx.plugin({ inject: ['slots', 'contextMenus'], apply: installStockBrowser })
    await plugin.await()
    const shadow = h.ctx.slots.entries('sidebar.workspaces').find(entry => entry.options.priority === -100)!
    expect(shadow.store).toBe(h.store)
    expect(shadow.inject!().requestSessionRename).toBe(h.requestSessionRename)
    const component = () => null
    const remove = h.ctx.slots.register({ name: 'sidebar.session.row.trailing', id: 'late', order: 10 } as never, component as never)
    expect(h.ctx.slots.entries('betterClassifier.session.row.trailing')[0]?.component).toBe(component)
    remove()
    expect(h.ctx.slots.entries('betterClassifier.session.row.trailing')).toHaveLength(0)
    await plugin.dispose()
    expect(h.ctx.slots.entries('sidebar.workspaces')).toEqual([original])
    expect(h.ctx.slots.entries('betterClassifier.tree')).toHaveLength(0)
    const again = h.ctx.plugin({ inject: ['slots', 'contextMenus'], apply: installStockBrowser }); await again.await()
    expect(h.ctx.slots.entries('sidebar.workspaces')).toHaveLength(2)
  })
  it('retires borrowed actions with the native owner and rebinds when the owner returns', async () => {
    const h = await setup()
    const plugin = h.ctx.plugin({ inject: ['slots', 'contextMenus'], apply: installStockBrowser }); await plugin.await()
    h.unmountNative()
    expect(h.ctx.slots.entries('sidebar.workspaces')).toHaveLength(0)
    h.mountNative()
    expect(h.ctx.slots.entries('sidebar.workspaces')).toHaveLength(2)
    await plugin.dispose()
    expect(h.ctx.slots.entries('sidebar.workspaces')).toHaveLength(1)
  })
})
