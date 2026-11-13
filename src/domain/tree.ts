/** Pure tree and search projection, shared by the UI and behavior tests. */
import type { ClassifierState, ContainerRef, EntityCatalog, EntityRef } from '../types.ts'
import { ancestorsOf, containerKey, createEntityLookup, entityKey, nameKey, parentOf } from './model.ts'
import type { EntityLookup } from './model.ts'

/** Minimal project metadata; current membership remains owned by DSH. */
export interface ProjectInfo { id: string; title: string; sessionIds: string[] }
/** Minimal Session metadata; status and rendering remain owned by DSH. */
export interface SessionInfo { id: string; title: string; updatedAt: number; pinned: boolean; blank: boolean }
/** One row in the virtual tree. */
export interface TreeNode { ref: EntityRef; parent: ContainerRef; label: string; depth: number; children: string[]; searchable: boolean }
/** Tree lookup and ordering assembled from one consistent set of inputs. */
export interface ClassifierTree { nodes: Map<string, TreeNode>; roots: string[]; order: string[]; catalog: EntityCatalog; lookup: EntityLookup }
/** Search controls and the current Host content page. */
export interface SearchOptions {
  query: string
  content: { sessionId: string; snippet: string }[]
  contentHasMore: boolean
  limit: number
}
/** Result entries and their ancestor paths; a matching container represents its entire branch. */
export interface SearchProjection { visible: Set<string>; matches: Set<string>; hasMore: boolean; snippets: Map<string, string>; active: boolean }

/** Build a bounded-depth rendering projection without rewriting the real project membership. */
export function buildTree(state: ClassifierState, projects: readonly ProjectInfo[], sessions: readonly SessionInfo[], orderBy: 'manual' | 'updated'): ClassifierTree {
  const catalog: EntityCatalog = { projects: projects.map(project => ({ id: project.id, sessionIds: project.sessionIds })), sessionIds: sessions.map(session => session.id) }
  const lookup = createEntityLookup(state, catalog)
  const nodes = new Map<string, TreeNode>()
  const add = (ref: EntityRef, label: string, searchable = true): void => { nodes.set(entityKey(ref), { ref, label, parent: parentOf(state, catalog, ref, lookup), depth: 0, children: [], searchable }) }
  for (const folder of state.folders) {
    const scope = folder.scope
    if (scope.kind === 'project' && !lookup.projects.has(scope.projectId)) continue
    add({ kind: 'folder', id: folder.id }, folder.name)
  }
  for (const project of projects) add({ kind: 'project', id: project.id }, project.title)
  for (const session of sessions) add({ kind: 'session', id: session.id }, session.title, !session.blank)
  const roots: string[] = []
  for (const [key, node] of nodes) {
    const parent = node.parent.kind === 'root' ? undefined : nodes.get(containerKey(node.parent))
    if (parent) parent.children.push(key)
    else roots.push(key)
  }
  const sessionMap = new Map(sessions.map(session => [session.id, session]))
  // Container creation order is stable. Unranked sessions use recency, then a stable id.
  const containerPositions = new Map([...nodes].filter(([, node]) => node.ref.kind !== 'session').map(([key], index) => [key, index]))
  const recent = (left: string, right: string): number => sessionMap.get(nodes.get(right)!.ref.id)!.updatedAt - sessionMap.get(nodes.get(left)!.ref.id)!.updatedAt || left.localeCompare(right)
  const rank = new Map(state.orders.map(order => [containerKey(order.container), new Map(order.entities.map((ref, i) => [entityKey(ref), i]))]))
  const sort = (keys: string[], container: string): void => {
    const positions = rank.get(container)
    keys.sort((left, right) => {
      const difference = (positions?.get(left) ?? Number.MAX_SAFE_INTEGER) - (positions?.get(right) ?? Number.MAX_SAFE_INTEGER)
      if (difference) return difference
      const a = containerPositions.get(left), b = containerPositions.get(right)
      if (a !== undefined || b !== undefined) return (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER)
      return recent(left, right)
    })
    const blank: string[] = [], pinned: string[] = [], normal: string[] = []
    for (const key of keys) {
      const node = nodes.get(key)!, session = node.ref.kind === 'session' ? sessionMap.get(node.ref.id) : undefined
      ;(session?.blank ? blank : session?.pinned ? pinned : normal).push(key)
    }
    if (orderBy === 'updated') {
      blank.sort(recent); pinned.sort(recent)
      const conversations = normal.filter(key => nodes.get(key)!.ref.kind === 'session').sort(recent)
      let index = 0
      for (let i = 0; i < normal.length; i++) if (nodes.get(normal[i]!)!.ref.kind === 'session') normal[i] = conversations[index++]!
    }
    keys.splice(0, keys.length, ...blank, ...pinned, ...normal)
  }
  sort(roots, 'root')
  const order: string[] = []
  const seen = new Set<string>()
  const walk = (keys: string[], depth: number): void => {
    for (const key of keys) {
      if (seen.has(key)) continue
      seen.add(key)
      const node = nodes.get(key)!
      node.depth = depth; order.push(key)
      sort(node.children, key); walk(node.children, depth + 1)
    }
  }
  walk(roots, 0)
  return { nodes, roots, order, catalog, lookup }
}

type MetadataOptions = Pick<SearchOptions, 'query'>

/** Containers are selected in preorder, so their descendants never become duplicate result entries. */
function metadataEntries(state: ClassifierState, tree: ClassifierTree, options: MetadataOptions): { entries: string[]; covered: Set<string> } {
  const query = nameKey(options.query.trim())
  const names = new Map(state.tags.map(tag => [tag.id, nameKey(tag.name)]))
  const tags = new Map(state.assignments.map(item => [entityKey(item.target), item.tagIds]))
  const containers = new Set<string>(), covered = new Set<string>(), entries: string[] = []
  for (const key of tree.order) {
    const node = tree.nodes.get(key)!
    const parent = containerKey(node.parent)
    if (containers.has(parent) || covered.has(parent)) { covered.add(key); continue }
    if (!node.searchable) continue
    if (!query || nameKey(node.label).includes(query)
      || (node.ref.kind === 'session' && node.ref.id.toLowerCase().includes(query))
      || (tags.get(key) ?? []).some(id => names.get(id)?.includes(query))) {
      entries.push(key)
      if (node.ref.kind !== 'session') containers.add(key)
    }
  }
  return { entries, covered }
}

/** Candidate ids exclude branches already represented by a metadata hit, before Host result truncation. */
export function candidateSessions(state: ClassifierState, tree: ClassifierTree, options: MetadataOptions): string[] {
  const { covered } = metadataEntries(state, tree, options)
  return tree.order.filter(key => {
    const node = tree.nodes.get(key)!
    return node.ref.kind === 'session' && node.searchable && !covered.has(key)
  }).map(key => tree.nodes.get(key)!.ref.id)
}

/** Merge independent metadata/body entries, bound them, then restore only their ancestor paths. */
export function projectSearch(state: ClassifierState, tree: ClassifierTree, options: SearchOptions): SearchProjection {
  const query = nameKey(options.query.trim())
  const active = query !== ''
  if (!active) return { visible: new Set(tree.order), matches: new Set(), hasMore: false, snippets: new Map(), active: false }
  const metadata = metadataEntries(state, tree, options)
  const hits = [...metadata.entries]
  const hitSet = new Set(hits)
  const include = (key: string): void => { if (!hitSet.has(key)) { hits.push(key); hitSet.add(key) } }
  const snippets = new Map<string, string>()
  for (const item of options.content) {
    const key = 'session:' + item.sessionId
    const node = tree.nodes.get(key)
    if (!node || !node.searchable || metadata.covered.has(key)) continue
    include(key); snippets.set(key, item.snippet)
  }
  const matches = new Set(hits.slice(0, options.limit))
  const visible = new Set(matches)
  for (const key of matches) {
    for (const ancestor of ancestorsOf(state, tree.catalog, tree.nodes.get(key)!.ref, tree.lookup)) {
      const ancestorKey = entityKey(ancestor)
      if (tree.nodes.has(ancestorKey)) visible.add(ancestorKey)
    }
  }
  return { visible, matches, hasMore: hits.length > options.limit || options.contentHasMore, snippets, active }
}
