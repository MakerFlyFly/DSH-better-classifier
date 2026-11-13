/** Public extension positions for alternate Workspace browsers and shared native rows. */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ContextMenuTarget } from '@deepseek-ai/dsh-client-ui-context-menu/client'
import type { GroupNode, SessionNode, ArchivedFilter, SessionOrderBy } from '../tree.ts'
import type { RowDragProps } from '../rows/Rows.tsx'
import type { ShortcutCatalogEntry } from '@deepseek-ai/dsh-client-shortcuts/client'

/** Browser-owned query, visibility, and native navigation supplied to extensions. */
export interface WorkspaceBrowserViewOwner {
  query: string
  /** Set the query; clearing it also closes the native search field. */
  setQuery: (query: string) => void
  orderBy: SessionOrderBy
  setOrderBy: (order: SessionOrderBy) => void
  archivedFilter: ArchivedFilter
  workspaces: readonly WorkspaceView[]
  sessionRows: readonly SessionNode[]
  ready: boolean
  home: string | undefined
  currentId: SessionId | undefined
  revealSessionId?: SessionId | undefined
  onSessionRevealed?: ((id: SessionId) => void) | undefined
  openSession: (id: SessionId) => void
  startSession: (id: WorkspaceId) => void
  resultLimit: number
}

/** Native Session row data and optional owner gestures. */
export interface WorkspaceSessionRowOwner {
  /** Explicit tree depth for flat DOM projections; omitted preserves native grouping semantics. */
  level?: number | undefined
  node: SessionNode
  currentId: string | undefined
  now: number
  onOpen: (id: SessionId) => void
  onRenameRequest?: ((id: SessionId, title: string) => void) | undefined
  onReveal?: (() => void) | undefined
  drag?: RowDragProps | undefined
  home?: string | undefined
}

/** Native Workspace header with owner-managed expansion and movement. */
export interface WorkspaceProjectRowOwner {
  /** Explicit tree depth for flat DOM projections; omitted preserves native grouping semantics. */
  level?: number | undefined
  group: GroupNode
  newShortcut?: ShortcutCatalogEntry | undefined
  containsCurrentDescendant?: boolean | undefined
  onToggle: () => void
  onCreate: (workspaceId: WorkspaceId) => void
  drag?: { start: () => void; end: () => void } | undefined
  home?: string | undefined
}

/** Shared row dependencies bound at the factory registration. */
export interface WorkspaceRowInjected {
  hooks: { contextMenuTarget: HostObservable<ContextMenuTarget | null> }
  requestSessionRename: (id: SessionId, title: string) => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Occupying this position replaces only the browser body; the shell, search field, and dialogs stay native. */
    'betterClassifier.tree': { kind: 'single'; scope: 'root'; owner: WorkspaceBrowserViewOwner }
    /** Controls shared with the alternate body, rendered below the native toolbar. */
    'betterClassifier.toolbar': { kind: 'list'; scope: 'root'; owner: WorkspaceBrowserViewOwner }
    /** Compact metadata after a Session title. */
    'betterClassifier.session.row.tags': { kind: 'list'; scope: 'root'; inline: true; owner: { sessionId: SessionId } }
    /** Compact metadata after a Workspace title. */
    'betterClassifier.workspace.row.tags': { kind: 'list'; scope: 'root'; inline: true; owner: { workspaceId: WorkspaceId } }
  }
  interface SlotFactoryMap {
    /** Reuses the native Session row, menu, actions, status and decorations. */
    'betterClassifier.sessionRow': {
      scope: 'root'
      props: WorkspaceSessionRowOwner
      locale: 'workspace'
      inject: WorkspaceRowInjected
      children: {
        'betterClassifier.session.row.action': { kind: 'list'; scope: 'root' }
        'betterClassifier.session.row.leading': { kind: 'list'; scope: 'root'; inline: true }
        'betterClassifier.session.row.trailing': { kind: 'list'; scope: 'root'; inline: true }
        'betterClassifier.session.row.hover': { kind: 'list'; scope: 'root' }
        'betterClassifier.session.row.tags': { kind: 'list'; scope: 'root'; inline: true }
      }
    }
    /** Reuses the native Workspace header and its captured context menu. */
    'betterClassifier.projectRow': {
      scope: 'root'
      props: WorkspaceProjectRowOwner
      locale: 'workspace'
      inject: WorkspaceRowInjected
      children: { 'betterClassifier.workspace.row.tags': { kind: 'list'; scope: 'root'; inline: true } }
    }
  }
}
