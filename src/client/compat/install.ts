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

/** A fallback hides new classification actions without destroying an already open draft. */
export interface AdapterState { phase: 'waiting' | 'ready' | 'fallback' }

function mount(ctx: Context, native: StoredEntry, shared: WorkspaceBrowserInjected) {
  const copies = new Map<StoredEntry, () => void>()
  const sync = (): void => {
    const current = new Set(aliases.flatMap(([source]) => ctx.slots.entries(source)))
    for (const [entry, dispose] of copies) if (!current.has(entry)) { dispose(); copies.delete(entry) }
    for (const [source, target] of aliases) for (const entry of ctx.slots.entries(source)) {
      if (copies.has(entry)) continue
      const options = { ...entry.options, name: target, inject: entry.inject, store: entry.store, locale: entry.locale }
      const register = ctx.slots.register as unknown as (input: typeof options, component: unknown) => () => void
      copies.set(entry, register.call(ctx.slots, options, entry.component))
    }
  }
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
    // Own rollback before the first copy, including failures halfway through sync.
    yield () => { for (const dispose of copies.values()) dispose(); copies.clear() }
    sync()
  }, 'better-classifier: native registration lifetime')
  return { owner: native, sync, dispose }
}

/** Shadow compatible native registrations without throwing into another plugin's register(). */
export function installStockBrowser(ctx: Context) {
  const status = createSnapshotStore<AdapterState>({ phase: 'waiting' })
  let running: ReturnType<typeof mount> | undefined
  let disposed = false, dirty = false
  let task: Promise<void> | undefined
  const setPhase = (phase: AdapterState['phase']): void => {
    if (!disposed && status.getSnapshot().phase !== phase) status.set({ phase })
  }
  const retire = async (): Promise<void> => {
    const previous = running
    running = undefined
    await previous?.dispose()
  }
  const nativeOwner = (): StoredEntry | undefined => ctx.slots.entries('sidebar.workspaces').find(entry => entry.locale === 'workspace' && (entry.options.priority ?? 0) === 0)
  const preflight = (): void => {
    for (const [source] of aliases) for (const entry of ctx.slots.entries(source)) {
      if (entry.children && Object.keys(entry.children).length) throw new Error('Unsupported nested sidebar contribution: ' + source)
    }
  }
  const reconcile = async (): Promise<void> => {
    try {
      const native = nativeOwner()
      if (!native) { await retire(); setPhase('waiting'); return }
      preflight()
      if (!native.store || !native.inject) throw new Error('Unsupported DSH workspace registration; requires stock DSH 0.2.2-rc.2')
      if (running?.owner !== native) {
        const shared = native.inject() as unknown as WorkspaceBrowserInjected
        if (!shared.hooks?.workspaceActionRequest || !shared.hooks.workspaceShortcuts || !shared.requestSessionRename) throw new Error('DSH workspace action contract is unavailable')
        if (running) await retire()
        if (disposed) return
        // Disposal can yield to an owner or contribution replacement. Re-read before installing.
        if (nativeOwner() !== native) { dirty = true; return }
        preflight()
        running = mount(ctx, native, shared)
      } else running.sync()
      setPhase('ready')
    } catch (error) {
      await retire()
      if (!disposed && status.getSnapshot().phase !== 'fallback') ctx.logger.warn('BetterClassifier restored the native sidebar: ' + String(error))
      setPhase('fallback')
    }
  }
  const schedule = (): void => {
    if (disposed) return
    dirty = true
    if (task) return
    // Let source register() finish declaring children before inspecting it.
    task = Promise.resolve().then(async () => {
      while (dirty && !disposed) { dirty = false; await reconcile() }
    }).catch(error => {
      if (!disposed) { ctx.logger.warn('BetterClassifier adapter cleanup failed: ' + String(error)); setPhase('fallback') }
    }).finally(() => { task = undefined; if (dirty && !disposed) schedule() })
  }
  ctx.effect(function* () {
    let observedOwner = nativeOwner()
    yield ctx.slots.subscribe('sidebar.workspaces', () => {
      const next = nativeOwner()
      // Our shadow's install/rollback must not retry an unchanged, incompatible input.
      if (next !== observedOwner) { observedOwner = next; schedule() }
    })
    for (const [source] of aliases) yield ctx.slots.subscribe(source, schedule)
    yield async () => { disposed = true; dirty = false; await task; await retire() }
  }, 'better-classifier: stock sidebar adapter')
  // Initial contributions belong to plugin startup, before the Client loader releases its render barrier.
  // Later registry notifications still use the deferred, serialized path above.
  task = reconcile().catch(error => {
    if (!disposed) { ctx.logger.warn('BetterClassifier adapter cleanup failed: ' + String(error)); setPhase('fallback') }
  }).finally(() => { task = undefined; if (dirty && !disposed) schedule() })
  return status
}
