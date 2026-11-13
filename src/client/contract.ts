/** All UI data crosses the Slot renderer's derived props shares. */
import type { HostObservable, InjectFace, PropsLocale, PropsRenderFactories, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from './compat/contract/browser.ts'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ClassifierCommand, EntityRef } from '../types.ts'
import type { DataState, Editor, InteractionState } from './controller.ts'
import type { createClassifierViewStore } from './state.ts'
import type { ClassifierKey } from './locales.ts'
import type { TagLayout } from './tag-layout.ts'
import type { BackgroundRegion } from './background-menu.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { betterClassifier: ClassifierKey }
}
export interface ClassifierInjected {
  hooks: { classifier: HostObservable<DataState>; interaction: HostObservable<InteractionState>; tagLayout: HostObservable<Readonly<Record<string, TagLayout>>> }
  measureTags: (key: string, element: HTMLElement | null) => void
  edit: (editor: Exclude<Editor, null>) => void
  closeEditor: () => void
  notice: (code: InteractionState['notice']) => void
  refresh: () => Promise<void>
  mutate: (commands: ClassifierCommand[], revision?: number) => Promise<boolean>
  bindBackground: (key: string, region: BackgroundRegion | null) => void
  folderCreated: (key: string, id: string) => void
  drag: (targets: EntityRef[]) => void
  searchContent: (query: string, signal: AbortSignal, sessionIds: readonly SessionId[]) => Promise<{ items: readonly { sessionId: string; snippet: string }[]; hasMore: boolean }>
}
export type ClassifierSharedProps = InjectFace<ClassifierInjected> & PropsLocale<'betterClassifier'> & PropsStore<ReturnType<typeof createClassifierViewStore>>
export type TreeProps = PropsRuntime<'betterClassifier.tree'> & PropsRenderFactories & ClassifierSharedProps
export type EditorProps = PropsRuntime<'shell.overlay'> & ClassifierSharedProps
export type SessionTagsProps = PropsRuntime<'betterClassifier.session.row.tags'> & ClassifierSharedProps
export type ProjectTagsProps = PropsRuntime<'betterClassifier.workspace.row.tags'> & ClassifierSharedProps
