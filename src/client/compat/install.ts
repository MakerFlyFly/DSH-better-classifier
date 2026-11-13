/** Version-pinned adapter over the public Slot registry. Native callbacks keep their original owner. */
import type { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { WorkspaceBrowser } from './rows/WorkspaceBrowser.tsx'
import { SessionRowFactory, ProjectRowFactory } from './rows/RowFactories.tsx'
import type { WorkspaceBrowserInjected, WorkspaceViewStoreHandle } from './contract/slots.ts'

const aliases = [
  ['sidebar.workspaces.directoryFlow', 'betterClassifier.directoryFlow'],
  ['sidebar.workspaces.session.row.action', 'betterClassifier.session.row.action'],
  ['sidebar.session.row.leading', 'betterClassifier.session.row.leading'],
  ['sidebar.session.row.trailing', 'betterClassifier.session.row.trailing'],
  ['sidebar.session.row.hover', 'betterClassifier.session.row.hover'],
] as const

/** Mirror supported child entries without moving or modifying the native registration. */
function mirror(ctx: Context, source: typeof aliases[number][0], target: typeof aliases[number][1]): () => void {
  const copies = new Map<StoredEntry, () => void>()
  let closed = false
  const sync = (): void => {
    if (closed) return
    const entries = ctx.slots.entries(source)
    for (const [entry, dispose] of copies) if (!entries.includes(entry)) { dispose(); copies.delete(entry) }
    for (const entry of entries) {
      if (copies.has(entry)) continue
      // These documented child seats have the same owner, hook and store shares.
      // Nested declarations are intentionally refused instead of stealing their ownership.
      if (entry.children && Object.keys(entry.children).length) throw new Error('Unsupported nested sidebar contribution: ' + source)
      const options = { ...entry.options, name: target, inject: entry.inject, store: entry.store, locale: entry.locale }
      const register = ctx.slots.register as unknown as (input: typeof options, component: unknown) => () => void
      copies.set(entry, register.call(ctx.slots, options, entry.component))
    }
  }
  const off = ctx.on('slots/changed', key => { if (key === source) sync() })
  sync()
  return () => { closed = true; off(); for (const dispose of copies.values()) dispose(); copies.clear() }
}

/** Shadow only the native browser component, sharing its public injected actions and viewing store. */
export function installStockBrowser(ctx: Context): void {
  let owner: StoredEntry | undefined
  let release: (() => void) | undefined
  let changing = false
  let disposed = false
  const reconcile = (): void => {
    if (disposed || changing) return
    const native = ctx.slots.entries('sidebar.workspaces').find(entry => entry.locale === 'workspace' && (entry.options.priority ?? 0) === 0)
    if (native === owner) return
    changing = true
    try {
      release?.(); release = undefined; owner = undefined
      if (!native) return
      if (!native.store || !native.inject) throw new Error('Unsupported DSH workspace registration; requires stock DSH 0.2.2-rc.2')
      const shared = native.inject() as unknown as WorkspaceBrowserInjected
      if (!shared.hooks?.workspaceActionRequest || !shared.hooks.workspaceShortcuts || !shared.requestSessionRename) {
        throw new Error('DSH workspace action contract is unavailable')
      }
      owner = native
      const dispose = ctx.effect(function* () {
      const browserView = createSnapshotStore(true)
      const inject = (): WorkspaceBrowserInjected => ({ ...shared, hooks: { ...shared.hooks, browserView } })
      yield ctx.slots.register({ name: 'sidebar.workspaces', priority: -100, locale: 'workspace',
        store: native.store as WorkspaceViewStoreHandle, inject,
        children: {
          'betterClassifier.directoryFlow': { kind: 'single', scope: 'root' },
          'betterClassifier.tree': { kind: 'single', scope: 'root' },
          'betterClassifier.toolbar': { kind: 'list', scope: 'root' },
        },
      }, WorkspaceBrowser)
      const rowInject = () => ({ requestSessionRename: shared.requestSessionRename, hooks: { contextMenuTarget: ctx.contextMenus.active } })
      yield ctx.slots.registerFactory({ name: 'betterClassifier.sessionRow', scope: 'root', locale: 'workspace', inject: rowInject,
        children: {
          'betterClassifier.session.row.action': { kind: 'list', scope: 'root' },
          'betterClassifier.session.row.leading': { kind: 'list', scope: 'root', inline: true },
          'betterClassifier.session.row.trailing': { kind: 'list', scope: 'root', inline: true },
          'betterClassifier.session.row.hover': { kind: 'list', scope: 'root' },
          'betterClassifier.session.row.tags': { kind: 'list', scope: 'root', inline: true },
        },
      }, SessionRowFactory)
      yield ctx.slots.registerFactory({ name: 'betterClassifier.projectRow', scope: 'root', locale: 'workspace', inject: rowInject,
        children: { 'betterClassifier.workspace.row.tags': { kind: 'list', scope: 'root', inline: true } },
      }, ProjectRowFactory)
      for (const [source, target] of aliases) yield mirror(ctx, source, target)
      }, 'better-classifier: native registration lifetime')
      release = () => { void dispose() }
    } finally { changing = false }
  }
  ctx.on('slots/changed', key => { if (key === 'sidebar.workspaces') reconcile() })
  ctx.effect(() => () => { disposed = true; release?.(); owner = undefined }, 'better-classifier: stock sidebar adapter')
  reconcile()
}
