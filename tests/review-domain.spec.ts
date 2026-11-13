import { describe, expect, it } from 'vitest'
import { emptyState, reduceMutation } from '../src/domain/model.ts'
import { buildTree } from '../src/domain/tree.ts'
import type { ClassifierCommand, ClassifierState, EntityCatalog, EntityRef } from '../src/types.ts'

const folder = (id: string): EntityRef => ({ kind: 'folder', id })
const session = (id: string): EntityRef => ({ kind: 'session', id })
const catalog: EntityCatalog = { projects: [{ id: 'p', sessionIds: ['s1', 's2', 's3', 'blank'] }], sessionIds: ['s1', 's2', 's3', 'blank'] }
const create = (id: string, parentId: string | null = null, name = id): ClassifierCommand => ({ kind: 'folder.create', id, name, scope: { kind: 'global' }, parentId })
function apply(state: ClassifierState, commands: ClassifierCommand[], entities = catalog): ClassifierState {
  const result = reduceMutation(state, { expectedRevision: state.revision, commands }, entities)
  if (!result.ok) throw new Error(result.code)
  return result.state
}

describe('review regressions: ordering and preservation', () => {
  it('does not freeze unrelated sessions in creation order when deleting an empty folder', () => {
    let state = apply(emptyState(), [{ kind: 'folder.create', id: 'empty', name: 'empty', scope: { kind: 'project', projectId: 'p' }, parentId: null }])
    const projects = [{ ...catalog.projects[0]!, title: 'Project' }]
    const rows = [{ id: 's1', title: 's1', updatedAt: 10, pinned: false, blank: false }, { id: 's2', title: 's2', updatedAt: 20, pinned: false, blank: false }]
    expect(buildTree(state, projects, rows, 'manual').nodes.get('project:p')?.children).toEqual(['folder:empty', 'session:s2', 'session:s1'])
    state = apply(state, [{ kind: 'folder.delete', id: 'empty' }])
    expect(buildTree(state, projects, rows, 'manual').nodes.get('project:p')?.children).toEqual(['session:s2', 'session:s1'])
  })
  it.each([false, true])('preserves child order when the parent order omits its folder (existing=%s)', existing => {
    let state = apply(emptyState(), [create('other'), create('P'), create('A', 'P'), create('B', 'P')])
    state = apply(state, [{ kind: 'entities.move', targets: [folder('B')], destination: { kind: 'folder', id: 'P' }, before: folder('A') }])
    if (existing) state.orders.push({ container: { kind: 'root' }, entities: [folder('other')] })
    state = apply(state, [{ kind: 'folder.delete', id: 'P' }])
    expect(buildTree(state, [], [], 'manual').roots).toEqual(['folder:other', 'folder:B', 'folder:A'])
    expect(state.orders.find(order => order.container.kind === 'root')?.entities).toEqual([...['other', 'B', 'A'].map(folder), { kind: 'project', id: 'p' }])
  })

  it('retains unloaded direct children and their tags when dissolving a folder', () => {
    let state = apply(emptyState(), [create('P'), create('A', 'P')])
    state.placements.push({ target: { kind: 'project', id: 'offline' }, folderId: 'P' })
    state.orders.push({ container: { kind: 'folder', id: 'P' }, entities: [{ kind: 'project', id: 'offline' }, folder('A')] })
    state.tags.push({ id: 't', name: 'kept', color: '#123456' })
    state.assignments.push({ target: { kind: 'project', id: 'offline' }, tagIds: ['t'] })
    state = apply(state, [{ kind: 'folder.delete', id: 'P' }], { projects: [], sessionIds: [] })
    expect(state.orders[0]?.entities).toEqual([{ kind: 'project', id: 'offline' }, folder('A')])
    expect(state.assignments).toEqual([{ target: { kind: 'project', id: 'offline' }, tagIds: ['t'] }])
  })

  it('allows reordering and case-only renaming of duplicate siblings produced by deletion', () => {
    let state = apply(emptyState(), [create('P'), create('A', 'P', 'same'), create('B', null, 'same')])
    state = apply(state, [{ kind: 'folder.delete', id: 'P' }])
    state = apply(state, [{ kind: 'entities.move', targets: [folder('B')], destination: { kind: 'root' }, before: folder('A') }, { kind: 'folder.rename', id: 'A', name: 'SAME' }])
    expect(buildTree(state, [], [], 'manual').roots).toEqual(['folder:B', 'folder:A'])
    expect(state.folders.find(item => item.id === 'A')?.name).toBe('SAME')
    expect(reduceMutation(state, { expectedRevision: state.revision, commands: [create('C', null, 'Same')] }, catalog)).toMatchObject({ ok: false, code: 'duplicate-name' })
  })

  it.each(['manual', 'updated'] as const)('keeps blank/pinned first with stable mixed normal rows in %s mode', mode => {
    let state = apply(emptyState(), ['F1', 'F2'].map(id => ({ kind: 'folder.create', id, name: id, scope: { kind: 'project', projectId: 'p' }, parentId: null })))
    state = apply(state, [
      { kind: 'entities.move', targets: [folder('F2')], destination: { kind: 'project', id: 'p' }, before: folder('F1') },
      { kind: 'entities.move', targets: [session('s1')], destination: { kind: 'project', id: 'p' }, before: folder('F1') },
    ])
    const rows = ['s1', 's2', 's3', 'blank'].map((id, i) => ({ id, title: id, updatedAt: i, pinned: id === 's3', blank: id === 'blank' }))
    const expected = mode === 'manual' ? ['session:blank', 'session:s3', 'folder:F2', 'session:s1', 'folder:F1', 'session:s2']
      : ['session:blank', 'session:s3', 'folder:F2', 'session:s2', 'folder:F1', 'session:s1']
    for (const input of [rows, [...rows].reverse(), [rows[2]!, rows[0]!, rows[3]!, rows[1]!]]) {
      expect(buildTree(state, [{ ...catalog.projects[0]!, title: 'Project' }], input, mode).nodes.get('project:p')!.children).toEqual(expected)
    }
    const unpinned = rows.map(row => ({ ...row, pinned: false }))
    expect(buildTree(state, [{ ...catalog.projects[0]!, title: 'Project' }], unpinned, 'manual').nodes.get('project:p')!.children)
      .toEqual(['session:blank', 'folder:F2', 'session:s1', 'folder:F1', 'session:s2', 'session:s3'])
  })
})

describe('review regressions: names and idempotent intents', () => {
  it('returns unchanged state for empty assignments and same-value edits, while retaining CAS', () => {
    const state = apply(emptyState(), [create('P'), { kind: 'tag.create', id: 't', name: '重点', color: '#123456' }])
    const commands: ClassifierCommand[] = [{ kind: 'folder.rename', id: 'P', name: 'P' }, { kind: 'tag.update', id: 't', name: '重点', color: '#123456' }, { kind: 'tags.assign', targets: [folder('P')], add: [], remove: [] }]
    expect(apply(state, commands)).toBe(state)
    expect(reduceMutation(state, { expectedRevision: state.revision - 1, commands }, catalog)).toMatchObject({ ok: false, code: 'conflict' })
  })

  it('normalizes new Unicode names and rejects invisible-only or bidi-control names', () => {
    for (const name of ['\u200b', '\u200d\ufe0f', '  \u200b ', 'abc\u202e']) {
      expect(reduceMutation(emptyState(), { expectedRevision: 0, commands: [create('f', null, name)] }, catalog)).toMatchObject({ ok: false, code: 'invalid-name' })
    }
    const state = apply(emptyState(), [create('f', null, 'e\u0301')])
    expect(state.folders[0]?.name).toBe('é')
    expect(reduceMutation(state, { expectedRevision: 1, commands: [create('g', null, 'É')] }, catalog)).toMatchObject({ ok: false, code: 'duplicate-name' })
    for (const name of ['工作', '👩‍💻', 'فارسی', 'می\u200cروم']) expect(apply(emptyState(), [create('f', null, name)]).folders[0]?.name).toBe(name)
  })

  it('does not rewrite legacy names or reject color-only edits of historical equivalent labels', () => {
    const state = { ...emptyState(), tags: [{ id: 'a', name: 'e\u0301', color: '#123456' }, { id: 'b', name: 'é', color: '#123456' }, { id: 'legacy', name: '\u200b', color: '#123456' }] }
    const next = apply(state, [{ kind: 'tag.update', id: 'a', name: 'e\u0301', color: '#FFFFFF' }, { kind: 'tag.update', id: 'legacy', name: '\u200b', color: '#FFFFFF' }])
    expect(next.tags.map(tag => tag.name)).toEqual(state.tags.map(tag => tag.name))
    expect(next.tags[0]?.color).toBe('#FFFFFF')
  })

  it('handles a large catalog without dropping unloaded metadata or duplicating targets', () => {
    const ids = Array.from({ length: 10_000 }, (_, i) => 's' + i)
    const entities = { projects: [{ id: 'p', sessionIds: ids }], sessionIds: ids }
    const state = { ...emptyState(), tags: [{ id: 't', name: '重点', color: '#123456' }], assignments: [{ target: session('unloaded'), tagIds: ['t'] }] }
    const next = apply(state, [{ kind: 'tags.assign', targets: [...ids.map(session), session(ids[0]!)], add: ['t'], remove: [] }], entities)
    expect(next.assignments).toHaveLength(10_001)
    expect(next.assignments[0]).toEqual(state.assignments[0])
    const rows = ids.map((id, updatedAt) => ({ id, title: id, updatedAt, blank: false, pinned: false }))
    expect(buildTree(next, [{ ...entities.projects[0]!, title: 'Project' }], rows, 'updated').nodes.get('project:p')?.children[0]).toBe('session:s9999')
  })
})
