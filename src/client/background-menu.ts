/** Plugin-owned background menu registrations, with callbacks released when their view unmounts. */
import type { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-client-ui-context-menu/client'
import type { ClassifierController } from './controller.ts'
import type { ClassifierSharedProps } from './contract.ts'

declare module '@deepseek-ai/dsh-client-ui-context-menu/client' {
  interface ContextMenuTargetMap {
    /** A mounted classifier list background; no object row is targeted. */
    betterClassifierBackground: { readonly key: string }
  }
}

/** View-owned navigation, used only after its root-folder transaction succeeds. */
export interface BackgroundRegion { ready: boolean; created: (id: string) => void }

/** Register one shared-menu contribution for all mounted classifier background regions. */
export class BackgroundMenuOwner {
  private readonly regions = new Map<string, BackgroundRegion>()
  private readonly readiness = createSnapshotStore<Record<string, boolean>>({})
  private disposed = false

  constructor(ctx: Context, private readonly controller: Pick<ClassifierController, 'data' | 'interaction' | 'edit' | 'notice'>, t: ClassifierSharedProps['t']) {
    ctx.effect(() => ctx.contextMenus.register({
      id: 'better-classifier.background', target: 'betterClassifierBackground', order: 100,
      observe: () => [controller.data, controller.interaction, this.readiness],
      resolve: ({ key }) => [{ id: 'create', label: t('newFolder'), disabled: !this.canCreate(key), run: () => {
        const data = controller.data.getSnapshot()
        if (!this.canCreate(key) || data.state === null) { controller.notice('unavailable'); return }
        controller.edit({ kind: 'folder.create', scope: { kind: 'global' }, parentId: null, revision: data.state.revision, background: key })
      } }],
    }), 'better-classifier: list background menu')
    ctx.effect(() => () => { this.disposed = true; this.regions.clear(); this.readiness.set({}) }, 'better-classifier: background regions')
  }

  private canCreate(key: string): boolean {
    return this.regions.get(key)?.ready === true && this.controller.data.getSnapshot().phase === 'ready'
      && !this.controller.interaction.getSnapshot().busy
  }

  /** Attach or update a committed region; null releases its pending navigation callback. */
  readonly bind = (key: string, region: BackgroundRegion | null): void => {
    if (this.disposed) return
    if (region === null) {
      this.regions.delete(key)
      if (key in this.readiness.getSnapshot()) this.readiness.update(state => { delete state[key] })
    } else {
      this.regions.set(key, region)
      if (this.readiness.getSnapshot()[key] !== region.ready) this.readiness.update(state => { state[key] = region.ready })
    }
  }

  /** Navigate only a still-mounted region, after persistence has succeeded. */
  readonly created = (key: string, id: string): void => { this.regions.get(key)?.created(id) }
}
