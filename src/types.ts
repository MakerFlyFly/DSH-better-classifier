/** Durable classifier records and the plugin's wire vocabulary. */

/** An entity identity; the kind participates in its identity. */
export interface EntityRef { kind: 'folder' | 'project' | 'session'; id: string }
/** Global folders contain projects; project folders contain that project's sessions. */
export type FolderScope = { kind: 'global' } | { kind: 'project'; projectId: string }
/** A destination in the virtual classification tree. */
export type ContainerRef = { kind: 'root' } | { kind: 'project'; id: string } | { kind: 'folder'; id: string }
/** One virtual folder. */
export interface Folder { id: string; name: string; scope: FolderScope; parentId: string | null }
/** One reusable, user-named tag. */
export interface Tag { id: string; name: string; color: string }
/** Tags belong only to the explicitly associated object. */
export interface TagAssignment { target: EntityRef; tagIds: string[] }
/** A project or session's optional virtual parent. */
export interface Placement { target: EntityRef; folderId: string }
/** An explicit order names entities, including temporarily unavailable members. */
export interface ContainerOrder { container: ContainerRef; entities: EntityRef[] }
/** The single atomic durable classifier record. */
export interface ClassifierState {
  revision: number
  folders: Folder[]
  tags: Tag[]
  assignments: TagAssignment[]
  placements: Placement[]
  orders: ContainerOrder[]
}
/** Current authoritative host identities used to validate mutations. */
export interface EntityCatalog {
  projects: { id: string; sessionIds: string[] }[]
  sessionIds: string[]
}
/** Each command is one intent; a request may combine several intents atomically. */
export type ClassifierCommand =
  | { kind: 'folder.create'; id: string; name: string; scope: FolderScope; parentId: string | null }
  | { kind: 'folder.rename'; id: string; name: string }
  | { kind: 'folder.delete'; id: string }
  | { kind: 'entities.move'; targets: EntityRef[]; destination: ContainerRef; before?: EntityRef; visibleOrder?: EntityRef[] }
  | { kind: 'tag.create'; id: string; name: string; color: string }
  | { kind: 'tag.update'; id: string; name: string; color: string }
  | { kind: 'tag.delete'; id: string }
  | { kind: 'tags.assign'; targets: EntityRef[]; add: string[]; remove: string[] }
/** Compare-and-swap mutation request. */
export interface MutationRequest { expectedRevision: number; commands: ClassifierCommand[] }
/** Stable business failure codes, localized by the client. */
export type ClassifierFailureCode = 'conflict' | 'not-found' | 'invalid-name' | 'duplicate-name' | 'invalid-color' | 'invalid-move' | 'cycle' | 'invalid-request'
/** Business rejections leave the record unchanged. Storage failures remain Remote failures. */
export type MutationResult =
  | { ok: true; state: ClassifierState }
  | { ok: false; code: ClassifierFailureCode; revision: number }
/** A follow generation begins with the complete committed snapshot. */
export interface ClassifierFrame { type: 'snapshot'; state: ClassifierState }

/** Plugin-owned body query, with candidate IDs projected from the visible classification tree. */
export interface ContentSearchRequest { query: string; sessionIds: string[] }
/** Bounded search response; snippets use the stock index's current message surface. */
export interface ContentSearchResult { items: { sessionId: string; snippet: string }[]; hasMore: boolean }
