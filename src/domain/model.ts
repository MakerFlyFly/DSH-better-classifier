/** Pure, atomic classification operations. No filesystem or Session mutations. */
import type { ClassifierCommand, ClassifierFailureCode, ClassifierState, ContainerRef, EntityCatalog, EntityRef, Folder, FolderScope, MutationRequest, MutationResult } from '../types.ts'

/** Create a detached empty record. */
export function emptyState(): ClassifierState {
  return { revision: 0, folders: [], tags: [], assignments: [], placements: [], orders: [] }
}
/** Stable composite identity, safe as a Map key. */
export function entityKey(ref: EntityRef): string { return ref.kind + ':' + ref.id }
/** Stable container identity. */
export function containerKey(ref: ContainerRef): string { return ref.kind === 'root' ? 'root' : ref.kind + ':' + ref.id }
/** Match exact entity identities. */
export function sameEntity(a: EntityRef, b: EntityRef): boolean { return a.kind === b.kind && a.id === b.id }
/** The real project owning a session; undefined denotes Ungrouped. */
export function sessionProject(catalog: EntityCatalog, sessionId: string): string | undefined { return catalog.projects.find(project => project.sessionIds.includes(sessionId))?.id }

class Rejection { constructor(readonly code: ClassifierFailureCode) {} }
function reject(code: ClassifierFailureCode): never { throw new Rejection(code) }
function getFolder(state: ClassifierState, id: string): Folder { return state.folders.find(folder => folder.id === id) ?? reject('not-found') }
function sameScope(a: FolderScope, b: FolderScope): boolean { return a.kind === b.kind && (a.kind === 'global' || (b.kind === 'project' && a.projectId === b.projectId)) }
function normalizedName(value: string): string {
  const name = value.trim()
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) reject('invalid-name')
  return name
}
function normalizedColor(value: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(value.trim())) reject('invalid-color')
  return value.trim().toUpperCase()
}
function assertEntity(state: ClassifierState, catalog: EntityCatalog, target: EntityRef): void {
  const found = target.kind === 'folder' ? state.folders.some(f => f.id === target.id)
    : target.kind === 'project' ? catalog.projects.some(p => p.id === target.id) : catalog.sessionIds.includes(target.id)
  if (!found) reject('not-found')
}
function validateFolderName(state: ClassifierState, folder: Folder): void {
  if (state.folders.some(other => other.id !== folder.id && sameScope(other.scope, folder.scope) && other.parentId === folder.parentId && other.name.toLocaleLowerCase() === folder.name.toLocaleLowerCase())) reject('duplicate-name')
}

/** Parent container, falling back to the real account if a stale placement has no valid folder. */
export function parentOf(state: ClassifierState, catalog: EntityCatalog, ref: EntityRef): ContainerRef {
  if (ref.kind === 'folder') {
    const folder = getFolder(state, ref.id)
    return folder.parentId !== null ? { kind: 'folder', id: folder.parentId }
      : folder.scope.kind === 'global' ? { kind: 'root' } : { kind: 'project', id: folder.scope.projectId }
  }
  const projectId = ref.kind === 'session' ? sessionProject(catalog, ref.id) : undefined
  const placement = state.placements.find(item => sameEntity(item.target, ref))
  const folder = placement && state.folders.find(item => item.id === placement.folderId)
  if (folder && ((ref.kind === 'project' && folder.scope.kind === 'global') || (ref.kind === 'session' && folder.scope.kind === 'project' && folder.scope.projectId === projectId))) return { kind: 'folder', id: folder.id }
  return ref.kind === 'project' || projectId === undefined ? { kind: 'root' } : { kind: 'project', id: projectId }
}

/** Ancestors nearest-first; the visited set makes malformed stored cycles finite. */
export function ancestorsOf(state: ClassifierState, catalog: EntityCatalog, ref: EntityRef): EntityRef[] {
  const result: EntityRef[] = []
  const visited = new Set([entityKey(ref)])
  let parent = parentOf(state, catalog, ref)
  while (parent.kind !== 'root') {
    const next: EntityRef = { kind: parent.kind, id: parent.id }
    if (visited.has(entityKey(next))) break
    visited.add(entityKey(next)); result.push(next)
    parent = parentOf(state, catalog, next)
  }
  return result
}

/**
 * Read only this object's tag associations.
 * @param state - classifier snapshot.
 * @param ref - explicitly tagged object; ancestors have no effect on its tags.
 * @returns tag ids in assignment order.
 */
export function directTagsOf(state: ClassifierState, ref: EntityRef): readonly string[] {
  return state.assignments.find(item => sameEntity(item.target, ref))?.tagIds ?? []
}

function destinationScope(state: ClassifierState, catalog: EntityCatalog, destination: ContainerRef): FolderScope {
  if (destination.kind === 'root') return { kind: 'global' }
  if (destination.kind === 'folder') return getFolder(state, destination.id).scope
  if (!catalog.projects.some(project => project.id === destination.id)) reject('not-found')
  return { kind: 'project', projectId: destination.id }
}

function move(state: ClassifierState, catalog: EntityCatalog, command: Extract<ClassifierCommand, { kind: 'entities.move' }>): void {
  const scope = destinationScope(state, catalog, command.destination)
  // Capture the displayed account order before changing any parent relationship.
  const baseline: EntityRef[] = [
    ...state.folders.map(folder => ({ kind: 'folder' as const, id: folder.id })),
    ...catalog.projects.map(project => ({ kind: 'project' as const, id: project.id })),
    ...catalog.sessionIds.map(id => ({ kind: 'session' as const, id })),
  ].filter(ref => containerKey(parentOf(state, catalog, ref)) === containerKey(command.destination))
  const known = new Set(baseline.map(entityKey))
  const saved = state.orders.find(item => containerKey(item.container) === containerKey(command.destination))?.entities ?? []
  const initialOrder = [...new Map([...(command.visibleOrder ?? []), ...saved, ...baseline]
    .filter(ref => known.has(entityKey(ref)) || saved.some(item => sameEntity(item, ref)))
    .map(ref => [entityKey(ref), ref])).values()]
  const unique = [...new Map(command.targets.map(target => [entityKey(target), target])).values()]
  for (const target of unique) assertEntity(state, catalog, target)
  const selected = new Set(unique.map(entityKey))
  const targets = unique.filter(target => !ancestorsOf(state, catalog, target).some(ancestor => selected.has(entityKey(ancestor))))
  for (const target of targets) {
    if (target.kind === 'folder') {
      const folder = getFolder(state, target.id)
      if (!sameScope(folder.scope, scope)) reject('invalid-move')
      if (command.destination.kind === 'folder' && (command.destination.id === target.id || ancestorsOf(state, catalog, { kind: 'folder', id: command.destination.id }).some(a => sameEntity(a, target)))) reject('cycle')
    } else if (target.kind === 'project') {
      if (scope.kind !== 'global') reject('invalid-move')
    } else if (scope.kind !== 'project' || sessionProject(catalog, target.id) !== scope.projectId) reject('invalid-move')
  }
  if (command.before) {
    assertEntity(state, catalog, command.before)
    if (selected.has(entityKey(command.before)) || containerKey(parentOf(state, catalog, command.before)) !== containerKey(command.destination)) reject('invalid-move')
  }
  for (const target of targets) {
    if (target.kind === 'folder') {
      const folder = getFolder(state, target.id)
      folder.parentId = command.destination.kind === 'folder' ? command.destination.id : null
      validateFolderName(state, folder)
    } else {
      state.placements = state.placements.filter(item => !sameEntity(item.target, target))
      if (command.destination.kind === 'folder') state.placements.push({ target, folderId: command.destination.id })
    }
  }
  const moving = new Set(targets.map(entityKey))
  for (const order of state.orders) order.entities = order.entities.filter(ref => !moving.has(entityKey(ref)))
  let order = state.orders.find(item => containerKey(item.container) === containerKey(command.destination))
  if (!order) { order = { container: command.destination, entities: [] }; state.orders.push(order) }
  order.entities = initialOrder.filter(ref => !moving.has(entityKey(ref)))
  if (command.before && !order.entities.some(ref => sameEntity(ref, command.before!))) order.entities.push(command.before)
  const index = command.before ? order.entities.findIndex(ref => sameEntity(ref, command.before!)) : order.entities.length
  order.entities.splice(index, 0, ...targets)
}

function applyCommand(state: ClassifierState, catalog: EntityCatalog, command: ClassifierCommand): void {
  switch (command.kind) {
    case 'folder.create': {
      if (state.folders.some(folder => folder.id === command.id)) reject('invalid-request')
      const destination: ContainerRef = command.parentId !== null ? { kind: 'folder', id: command.parentId }
        : command.scope.kind === 'global' ? { kind: 'root' } : { kind: 'project', id: command.scope.projectId }
      if (!sameScope(command.scope, destinationScope(state, catalog, destination))) reject('invalid-move')
      const folder: Folder = { id: command.id, name: normalizedName(command.name), scope: command.scope, parentId: command.parentId }
      validateFolderName(state, folder); state.folders.push(folder); return
    }
    case 'folder.rename': {
      const folder = getFolder(state, command.id); folder.name = normalizedName(command.name); validateFolderName(state, folder); return
    }
    case 'folder.delete': {
      const folder = getFolder(state, command.id)
      const parent = parentOf(state, catalog, { kind: 'folder', id: folder.id })
      const directFolders = state.folders.filter(child => child.parentId === folder.id)
      for (const child of directFolders) child.parentId = folder.parentId
      for (const placement of state.placements) if (placement.folderId === folder.id && folder.parentId !== null) placement.folderId = folder.parentId
      state.placements = state.placements.filter(item => item.folderId !== folder.id)
      const removedKey = 'folder:' + folder.id
      const contents = state.orders.find(order => containerKey(order.container) === removedKey)?.entities ?? []
      for (const order of state.orders) {
        const index = order.entities.findIndex(ref => entityKey(ref) === removedKey)
        if (index >= 0) order.entities.splice(index, 1, ...(containerKey(order.container) === containerKey(parent) ? contents : []))
      }
      state.folders = state.folders.filter(item => item.id !== folder.id)
      state.assignments = state.assignments.filter(item => entityKey(item.target) !== removedKey)
      state.orders = state.orders.filter(item => containerKey(item.container) !== removedKey)
      // Dissolving folders may create same-named siblings; identity remains unambiguous.
      return
    }
    case 'entities.move': move(state, catalog, command); return
    case 'tag.create':
    case 'tag.update': {
      const name = normalizedName(command.name); const color = normalizedColor(command.color)
      if (state.tags.some(tag => tag.id !== command.id && tag.name.toLocaleLowerCase() === name.toLocaleLowerCase())) reject('duplicate-name')
      const tag = state.tags.find(item => item.id === command.id)
      if (command.kind === 'tag.create') {
        if (tag) reject('invalid-request')
        state.tags.push({ id: command.id, name, color })
      } else {
        if (!tag) reject('not-found')
        tag.name = name; tag.color = color
      }
      return
    }
    case 'tag.delete': {
      if (!state.tags.some(tag => tag.id === command.id)) reject('not-found')
      state.tags = state.tags.filter(tag => tag.id !== command.id)
      for (const assignment of state.assignments) assignment.tagIds = assignment.tagIds.filter(id => id !== command.id)
      state.assignments = state.assignments.filter(item => item.tagIds.length > 0); return
    }
    case 'tags.assign': {
      for (const id of [...command.add, ...command.remove]) if (!state.tags.some(tag => tag.id === id)) reject('not-found')
      for (const target of command.targets) {
        assertEntity(state, catalog, target)
        let assignment = state.assignments.find(item => sameEntity(item.target, target))
        if (!assignment) { assignment = { target, tagIds: [] }; state.assignments.push(assignment) }
        assignment.tagIds = [...new Set([...assignment.tagIds.filter(id => !command.remove.includes(id)), ...command.add])]
      }
      state.assignments = state.assignments.filter(item => item.tagIds.length > 0); return
    }
  }
}

/** Apply a transaction to a detached copy; any rejection leaves the input unchanged. */
export function reduceMutation(current: ClassifierState, request: MutationRequest, catalog: EntityCatalog): MutationResult {
  if (request.expectedRevision !== current.revision) return { ok: false, code: 'conflict', revision: current.revision }
  const state = structuredClone(current)
  try {
    for (const command of request.commands) applyCommand(state, catalog, command)
    state.revision++
    return { ok: true, state }
  } catch (error) {
    if (error instanceof Rejection) return { ok: false, code: error.code, revision: current.revision }
    throw error
  }
}
