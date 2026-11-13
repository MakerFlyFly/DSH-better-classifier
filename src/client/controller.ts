/** React-free Remote state owner and mutation coordinator. */
import type { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from 'dsh-better-classifier/remote'
import type { RemoteStream } from '@deepseek-ai/dsh-api-gateway/client'
import type { ClassifierCommand, ClassifierFailureCode, ClassifierFrame, ClassifierState, EntityRef, FolderScope } from '../types.ts'

/** Shared editor state; its revision is captured when a dialog opens. */
export type Editor = ({ revision: number } & (
  | { kind: 'folder.create'; scope: FolderScope; parentId: string | null; background?: string }
  | { kind: 'folder.rename' | 'folder.delete'; id: string }
  | { kind: 'move'; targets: EntityRef[] }
  | { kind: 'tags'; targets: EntityRef[] }
)) | null
/** Last readable committed state is retained through reconnection. */
export interface DataState { phase: 'loading' | 'ready' | 'offline' | 'error'; state: ClassifierState | null }
/** Transient dialogs and single-row dragging, shared without persistence. */
export interface InteractionState {
  drag: EntityRef[]
  editor: Editor
  busy: boolean
  notice: ClassifierFailureCode | 'saved' | 'unavailable' | null
  noticeSeq: number
}

/** One mounted plugin's state and subscriptions. */
export class ClassifierController {
  readonly data = createSnapshotStore<DataState>({ phase: 'loading', state: null })
  readonly interaction = createSnapshotStore<InteractionState>({ drag: [], editor: null, busy: false, notice: null, noticeSeq: 0 })
  private disposed = false
  private following?: { stream: RemoteStream<ClassifierFrame>; consuming: Promise<void> }

  /** @param ctx - plugin-owned Remote context; no React component receives it. */
  constructor(private readonly ctx: Context) {
    this.startFollowing()
    ctx.effect(() => async () => {
      this.disposed = true
      await this.following?.stream.dispose()
      await this.following?.consuming
    }, 'better-classifier: follow lifetime')
  }

  private startFollowing(): void {
    const ctx = this.ctx
    const stream = ctx.remote.$stream<ClassifierFrame>({
      name: 'BetterClassifier state',
      open: signal => ctx.remote.betterClassifier.follow(signal),
      ended: () => new Error('BetterClassifier state stream ended'),
      carrierFailed: () => { this.data.update(value => { value.phase = 'offline' }) },
    })
    const consuming = (async () => {
      let generation = 0
      try {
        for await (const item of stream) {
          const current = this.data.getSnapshot().state
          if (generation !== item.generation || current === null || item.value.state.revision >= current.revision) {
            this.data.set({ phase: 'ready', state: item.value.state })
          }
          generation = item.generation
          item.accept()
        }
      } catch (error) {
        if (this.disposed) return
        this.data.update(value => { value.phase = 'error' })
        console.error('BetterClassifier stream failed', error)
      }
    })()
    this.following = { stream, consuming }
  }

  /** Refresh after an explicit retry or revision conflict. */
  async refresh(): Promise<void> {
    if (this.data.getSnapshot().phase === 'error') {
      await this.following?.stream.dispose()
      await this.following?.consuming
      if (this.disposed) return
      this.startFollowing()
    }
    const result = await this.ctx.remote.betterClassifier.snapshot()
    if (result.ok) {
      const latest = this.data.getSnapshot().state
      if (latest === null || latest.revision <= result.value.revision) this.data.set({ phase: 'ready', state: result.value })
    }
    else { this.data.update(value => { value.phase = 'error' }); this.notice('unavailable') }
  }

  /** Open a dialog using the current committed revision. */
  edit(request: Exclude<Editor, null>): void {
    this.interaction.update(state => { state.editor = request; state.notice = null })
  }
  /** Close the editor unless a write is in flight. */
  closeEditor(): void { this.interaction.update(state => { if (!state.busy) state.editor = null }) }
  /** Publish a localized notification code. */
  notice(code: InteractionState['notice']): void { this.interaction.update(state => { state.notice = code; if (code !== null) state.noticeSeq++ }) }
  /** Retain only plain identities for the active drag. */
  drag(targets: EntityRef[]): void { this.interaction.update(state => { state.drag = targets }) }

  /** @returns whether the complete mutation committed. */
  async mutate(commands: ClassifierCommand[], revision?: number): Promise<boolean> {
    const data = this.data.getSnapshot()
    if (data.phase !== 'ready' || data.state === null || this.interaction.getSnapshot().busy) { this.notice('unavailable'); return false }
    this.interaction.update(state => { state.busy = true; state.notice = null })
    try {
      const result = await this.ctx.remote.betterClassifier.apply({ expectedRevision: revision ?? data.state.revision, commands })
      if (!result.ok) { this.data.update(value => { value.phase = 'error' }); this.notice('unavailable'); return false }
      if (!result.value.ok) {
        if (result.value.code === 'conflict') await this.refresh()
        this.notice(result.value.code)
        return false
      }
      const latest = this.data.getSnapshot().state
      if (latest === null || latest.revision <= result.value.state.revision) this.data.set({ phase: 'ready', state: result.value.state })
      this.interaction.update(state => { state.editor = null; state.drag = []; state.notice = 'saved'; state.noticeSeq++ })
      return true
    } catch (error) {
      this.data.update(value => { value.phase = 'error' }); this.notice('unavailable')
      console.error('BetterClassifier mutation failed', error)
      return false
    } finally { this.interaction.update(state => { state.busy = false }) }
  }
}
