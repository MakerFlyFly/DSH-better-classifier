import { describe, expect, it } from 'vitest'
import { emptyState, reduceMutation, directTagsOf, parentOf } from '../src/domain/model.ts'
import { buildTree, candidateSessions, projectSearch } from '../src/domain/tree.ts'
import { mutationSchema, stateSchema } from '../src/domain/schema.ts'
import type { ClassifierState, ClassifierCommand, EntityCatalog, EntityRef } from '../src/types.ts'

const project = (id: string): EntityRef => ({ kind: 'project', id })
const session = (id: string): EntityRef => ({ kind: 'session', id })
const folder = (id: string): EntityRef => ({ kind: 'folder', id })
const catalog: EntityCatalog = { projects: [{ id: 'p1', sessionIds: ['s1', 's2', 's3'] }, { id: 'p2', sessionIds: ['s4'] }], sessionIds: ['s1', 's2', 's3', 's4'] }
function apply(state: ClassifierState, ...commands: ClassifierCommand[]): ClassifierState {
  const result = reduceMutation(state, { expectedRevision: state.revision, commands }, catalog)
  if (!result.ok) throw new Error(result.code)
  return result.state
}
function fixture(): ClassifierState {
  return apply(emptyState(),
    { kind: 'folder.create', id: 'global', name: '工作', scope: { kind: 'global' }, parentId: null },
    { kind: 'folder.create', id: 'inner', name: '插件', scope: { kind: 'project', projectId: 'p1' }, parentId: null },
    { kind: 'entities.move', targets: [project('p1')], destination: folder('global') as { kind: 'folder'; id: string } },
    { kind: 'entities.move', targets: [session('s1')], destination: { kind: 'folder', id: 'inner' } },
  )
}
describe('classification transactions', () => {
  it('moves projects and sessions while leaving real membership unchanged', () => {
    const before = structuredClone(catalog)
    const state = fixture()
    expect(parentOf(state, catalog, project('p1'))).toEqual(folder('global'))
    expect(parentOf(state, catalog, session('s1'))).toEqual(folder('inner'))
    expect(catalog).toEqual(before)
  })
  it('rejects cross-project moves atomically, including preceding commands', () => {
    const state = fixture(); const before = structuredClone(state)
    expect(reduceMutation(state, { expectedRevision: state.revision, commands: [
      { kind: 'folder.rename', id: 'inner', name: 'changed' },
      { kind: 'entities.move', targets: [session('s4')], destination: { kind: 'folder', id: 'inner' } },
    ] }, catalog)).toMatchObject({ ok: false, code: 'invalid-move' })
    expect(state).toEqual(before)
  })
  it('rejects self and descendant cycles', () => {
    const state = apply(fixture(), { kind: 'folder.create', id: 'child', name: '子目录', scope: { kind: 'global' }, parentId: 'global' })
    for (const id of ['global', 'child']) expect(reduceMutation(state, { expectedRevision: state.revision, commands: [
      { kind: 'entities.move', targets: [folder('global')], destination: { kind: 'folder', id } },
    ] }, catalog)).toMatchObject({ ok: false, code: 'cycle' })
  })
  it('dissolves only the removed folder and preserves its children', () => {
    const state = apply(fixture(), { kind: 'folder.create', id: 'child', name: '测试', scope: { kind: 'project', projectId: 'p1' }, parentId: 'inner' })
    const next = apply(state, { kind: 'folder.delete', id: 'inner' })
    expect(parentOf(next, catalog, session('s1'))).toEqual(project('p1'))
    expect(next.folders.find(item => item.id === 'child')?.parentId).toBeNull()
    expect(next.folders.some(item => item.id === 'global')).toBe(true)
  })
  it('deduplicates a parent and its selected descendant in a bulk move', () => {
    const state = fixture()
    const next = apply(state, { kind: 'entities.move', targets: [folder('global'), project('p1')], destination: { kind: 'root' } })
    expect(parentOf(next, catalog, project('p1'))).toEqual(folder('global'))
  })
  it('retains unaffected positions when a recency view becomes manual', () => {
    const next = apply(emptyState(), { kind: 'entities.move', targets: [session('s3')], destination: { kind: 'project', id: 'p1' }, before: session('s2'), visibleOrder: ['s1', 's2', 's3'].map(session) })
    expect(next.orders[0]?.entities).toEqual(['s1', 's3', 's2'].map(session))
  })
  it('refuses stale revisions without writing', () => {
    const state = fixture()
    expect(reduceMutation(state, { expectedRevision: 0, commands: [{ kind: 'folder.delete', id: 'inner' }] }, catalog)).toEqual({ ok: false, code: 'conflict', revision: state.revision })
  })
})
describe('tags', () => {
  it('keeps tags on their explicit objects through moves without copying parent tags', () => {
    let state = apply(fixture(), { kind: 'tag.create', id: 't1', name: ' 客户 ', color: '#aBc123' }, { kind: 'tags.assign', targets: [folder('global')], add: ['t1'], remove: [] })
    expect(state.tags[0]).toEqual({ id: 't1', name: '客户', color: '#ABC123' })
    expect(directTagsOf(state, folder('global'))).toEqual(['t1'])
    expect(directTagsOf(state, project('p1'))).toEqual([])
    expect(directTagsOf(state, session('s1'))).toEqual([])
    expect(state.assignments).toHaveLength(1)
    state = apply(state, { kind: 'tags.assign', targets: [session('s1')], add: ['t1'], remove: [] })
    state = apply(state, { kind: 'entities.move', targets: [project('p1')], destination: { kind: 'root' } })
    expect(directTagsOf(state, session('s1'))).toEqual(['t1'])
    expect(directTagsOf(state, project('p1'))).toEqual([])
  })
  it('changes tag colors everywhere and removes references on deletion', () => {
    let state = apply(fixture(), { kind: 'tag.create', id: 't1', name: '审阅', color: '#123456' }, { kind: 'tags.assign', targets: [session('s1'), project('p1')], add: ['t1'], remove: [] })
    state = apply(state, { kind: 'tag.update', id: 't1', name: '完成', color: '#FFFFFF' })
    expect(state.tags[0]?.name).toBe('完成')
    state = apply(state, { kind: 'tag.delete', id: 't1' })
    expect(state.assignments).toEqual([])
  })
  it('rejects invalid custom colors and duplicate tag names', () => {
    const state = apply(emptyState(), { kind: 'tag.create', id: 't1', name: 'Review', color: '#112233' })
    for (const [name, color, code] of [['x', 'red', 'invalid-color'], ['review', '#112233', 'duplicate-name']]) {
      expect(reduceMutation(state, { expectedRevision: 1, commands: [{ kind: 'tag.create', id: 't2', name: name!, color: color! }] }, catalog)).toMatchObject({ ok: false, code })
    }
  })
})
describe('tree-shaped search', () => {
  const projects = catalog.projects.map(item => ({ ...item, title: item.id === 'p1' ? 'DSH 项目' : '其他' }))
  const sessions = catalog.sessionIds.map((id, i) => ({ id, title: id === 's1' ? '搜索优化' : '对话 ' + id, updatedAt: i, pinned: false, blank: false }))
  const defaults = { query: '', content: [], contentHasMore: false, limit: 20 }
  it('keeps ancestors of a matching conversation without including its siblings', () => {
    const state = fixture(); const tree = buildTree(state, projects, sessions, 'updated')
    const result = projectSearch(state, tree, { ...defaults, query: '搜索优化' })
    expect([...result.matches]).toEqual(['session:s1'])
    expect([...result.visible].sort()).toEqual(['folder:global', 'folder:inner', 'project:p1', 'session:s1'])
  })
  it('matches a folder at its own level, including an empty folder', () => {
    const state = apply(fixture(), { kind: 'folder.create', id: 'empty', name: '空文件夹', scope: { kind: 'global' }, parentId: null })
    const tree = buildTree(state, projects, sessions, 'manual')
    expect([...projectSearch(state, tree, { ...defaults, query: '插件' }).matches]).toEqual(['folder:inner'])
    expect([...projectSearch(state, tree, { ...defaults, query: '空文件夹' }).visible]).toEqual(['folder:empty'])
  })
  it('finds directly tagged containers and sessions without assigning tags to descendants', () => {
    let state = apply(fixture(), { kind: 'tag.create', id: 't', name: '重点', color: '#123456' }, { kind: 'tags.assign', targets: [folder('inner')], add: ['t'], remove: [] })
    let tree = buildTree(state, projects, sessions, 'updated')
    expect([...projectSearch(state, tree, { ...defaults, query: '重点' }).matches]).toEqual(['folder:inner'])
    expect(candidateSessions(state, tree, { query: '重点' })).not.toContain('s1')
    state = apply(state, { kind: 'tags.assign', targets: [session('s1'), session('s4')], add: ['t'], remove: [] })
    tree = buildTree(state, projects, sessions, 'updated')
    expect([...projectSearch(state, tree, { ...defaults, query: '重点' }).matches]).toEqual(['folder:inner', 'session:s4'])
  })
  it('counts direct matches independently from ancestor paths', () => {
    const state = fixture(); const tree = buildTree(state, projects, sessions, 'updated')
    const result = projectSearch(state, tree, { ...defaults, query: '搜索优化', limit: 1 })
    expect(result.visible.size).toBe(4)
    expect(result.hasMore).toBe(false)
  })
  it('represents matching parents and descendants with one outermost container entry', () => {
    const state = apply(fixture(), { kind: 'tag.create', id: 't', name: '重点', color: '#123456' },
      { kind: 'tags.assign', targets: [folder('global'), folder('inner'), session('s1')], add: ['t'], remove: [] })
    const tree = buildTree(state, projects, sessions, 'manual')
    {
      const result = projectSearch(state, tree, { ...defaults, query: '重点', limit: 1, content: [{ sessionId: 's1', snippet: '重点正文' }] })
      expect([...result.matches]).toEqual(['folder:global'])
      expect([...result.visible]).toEqual(['folder:global'])
      expect(result.hasMore).toBe(false)
      expect(result.snippets.size).toBe(0)
    }
  })
  it('matches each tag name only on its explicitly tagged object', () => {
    const state = apply(fixture(),
      { kind: 'tag.create', id: 'a', name: '父级', color: '#123456' }, { kind: 'tag.create', id: 'b', name: '会话', color: '#123456' },
      { kind: 'tags.assign', targets: [folder('global')], add: ['a'], remove: [] }, { kind: 'tags.assign', targets: [session('s1')], add: ['b'], remove: [] })
    const tree = buildTree(state, projects, sessions, 'manual')
    expect([...projectSearch(state, tree, { ...defaults, query: '父级' }).matches]).toEqual(['folder:global'])
    expect([...projectSearch(state, tree, { ...defaults, query: '会话' }).matches]).toEqual(['session:s1'])
  })
  it('excludes covered sessions before the Host limit so an outside body hit after the first 20 is returned', () => {
    const state = fixture()
    const covered = Array.from({ length: 25 }, (_, i) => ({ id: 'covered-' + i, title: '记录', updatedAt: i, pinned: false, blank: false }))
    const projectsWithCoverage = projects.map(item => item.id === 'p1' ? { ...item, sessionIds: [...item.sessionIds, ...covered.map(row => row.id)] } : item)
    const tree = buildTree(state, projectsWithCoverage, [...covered, ...sessions], 'updated')
    const candidates = candidateSessions(state, tree, { ...defaults, query: '工作' })
    expect(candidates).toEqual(['s4'])
    const indexedHits = [...covered.map(row => ({ sessionId: row.id, snippet: '工作记录' })), { sessionId: 's4', snippet: '外部工作正文' }]
    const page = indexedHits.filter(item => candidates.includes(item.sessionId)).slice(0, 20)
    const result = projectSearch(state, tree, { ...defaults, query: '工作', content: page })
    expect([...result.matches]).toEqual(['folder:global', 'session:s4'])
    expect(result.snippets.get('session:s4')).toBe('外部工作正文')
    expect(result.hasMore).toBe(false)
  })
  it('bounds entries before adding context and respects the native archive-filtered row set', () => {
    const state = fixture()
    const extra = Array.from({ length: 25 }, (_, i) => ({ id: 'outside-' + i, title: '正文', updatedAt: i, pinned: false, blank: false }))
    const filteredSessions = [...extra, ...sessions.filter(row => row.id !== 's4')]
    const tree = buildTree(state, projects, filteredSessions, 'updated')
    const candidates = candidateSessions(state, tree, { ...defaults, query: '工作' })
    expect(candidates).not.toContain('s4')
    const result = projectSearch(state, tree, { ...defaults, query: '工作', content: [...extra.map(row => ({ sessionId: row.id, snippet: '工作正文' })), { sessionId: 's4', snippet: '已归档' }] })
    expect(result.matches.size).toBe(20)
    expect(result.hasMore).toBe(true)
    expect(result.visible.has('session:s4')).toBe(false)
  })
})
describe('boundary schemas', () => {
  it('round-trips classifier data and rejects malformed requests', () => {
    expect(stateSchema.parse(JSON.parse(JSON.stringify(fixture())))).toEqual(fixture())
    expect(mutationSchema.safeParse({ expectedRevision: -1, commands: [] }).success).toBe(false)
  })
})
