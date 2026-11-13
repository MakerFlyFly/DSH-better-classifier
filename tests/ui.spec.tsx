// @vitest-environment jsdom
import { useState, useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { createClassifierViewStore } from '../src/client/state.ts'
import { TagBadges } from '../src/client/Tags.tsx'
import { tagColors } from '../src/client/tag-colors.ts'
import { ClassifierEditors } from '../src/client/Editors.tsx'
import { ClassifierTreeView } from '../src/client/Tree.tsx'
import { emptyState } from '../src/domain/model.ts'
import { zh } from '../src/client/locales.ts'
import type { DataState, InteractionState } from '../src/client/controller.ts'
import type { EditorProps, TreeProps } from '../src/client/contract.ts'
import type { WorkspaceProjectRowOwner, WorkspaceSessionRowOwner } from '../src/client/compat/contract/browser.ts'
import type { TagLayout } from '../src/client/tag-layout.ts'
import type { AdapterState } from '../src/client/compat/install.ts'
import type { ClassifierCommand } from '../src/types.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SessionNodeItem } from '../src/client/compat/rows/Rows.tsx'

afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.unstubAllGlobals() })
function bind<T>(source: { getSnapshot(): T; subscribe(listener: () => void): () => void }) {
  return <S,>(selector: (value: T) => S): S => selector(useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot))
}
function fixture() {
  const state = emptyState()
  state.tags = [{ id: 'one', name: '重点', color: '#FFFFFF' }, { id: 'two', name: '开发', color: '#000000' }, { id: 'three', name: '待审阅', color: '#E34A72' }]
  state.folders = [{ id: 'outer', name: '工作', scope: { kind: 'global' }, parentId: null }]
  state.placements = [{ target: { kind: 'project', id: 'p' }, folderId: 'outer' }]
  state.assignments = [{ target: { kind: 'folder', id: 'outer' }, tagIds: ['one', 'two', 'three'] }]
  const data = createSnapshotStore<DataState>({ phase: 'ready', state })
  const interaction = createSnapshotStore<InteractionState>({ drag: [], editor: null, busy: false, notice: null, noticeSeq: 0 })
  const adapter = createSnapshotStore<AdapterState>({ phase: 'ready' })
  const view = createClassifierViewStore().create()
  const mutate = vi.fn(async (_commands: ClassifierCommand[], _revision?: number) => true)
  const layout = createSnapshotStore<Record<string, TagLayout>>({})
  const measureTags = vi.fn((key: string, element: HTMLElement | null) => {
    if (element) layout.update(value => { value[key] = { count: 3, minimum: 18 } })
  })
  const backgroundMouse = vi.fn(), backgroundKey = vi.fn()
  const props = {
    useClassifier: bind(data), useInteraction: bind(interaction), useAdapter: bind(adapter), useStore: bind(view), actions: view.actions,
    useTagLayout: bind(layout), measureTags,
    t: (key: keyof typeof zh, values?: Record<string, string | number>) => Object.entries(values ?? {}).reduce((text, [name, value]) => text.replaceAll('{' + name + '}', String(value)), zh[key] as string),
    edit: vi.fn(), closeEditor: vi.fn(), notice: vi.fn(), refresh: vi.fn(), mutate, drag: vi.fn(), searchContent: vi.fn(),
    bindBackground: vi.fn(), folderCreated: vi.fn(),
    useContextMenu: () => ({ getTriggerProps: () => ({ tabIndex: 0, onContextMenu: backgroundMouse, onKeyDown: backgroundKey }) }),
    useWorkspaces: (select: (value: object) => unknown) => select({ items: [{ workspaceId: 'p', title: 'DSH', sessionIds: ['s'] }] }),
    useSessions: (select: (value: object) => unknown) => select({ ids: ['s'], byId: { s: { displayTitle: '搜索优化' } } }),
  } as EditorProps
  return { props, data, interaction, adapter, view, mutate, layout, backgroundMouse, backgroundKey }
}

describe('single-item dragging', () => {
  it('moves one folder inside another and switches to manual order', async () => {
    const h = fixture()
    h.data.getSnapshot().state!.folders.push({ id: 'incoming', name: '发布准备', scope: { kind: 'global' }, parentId: null })
    const setOrderBy = vi.fn()
    const props = { ...h.props, usePanelInfo: () => true, query: '', setQuery: vi.fn(), orderBy: 'updated', setOrderBy,
      archivedFilter: 'default', ready: true, currentId: undefined, home: undefined, resultLimit: 20,
      openSession: vi.fn(), startSession: vi.fn(), sessionRows: [], workspaces: [], renderFactorySlot: () => null,
      drag: (refs: InteractionState['drag']) => h.interaction.update(value => { value.drag = refs }),
    } as unknown as TreeProps
    const view = render(<ClassifierTreeView {...props} />)
    const source = screen.getByRole('treeitem', { name: /^发布准备/ })
    const destination = view.container.querySelector('[data-classifier-key="folder:outer"]')!
    vi.spyOn(destination, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 32, width: 200, height: 32, toJSON: () => ({}) })
    fireEvent.dragStart(source, { dataTransfer: { setData: vi.fn(), effectAllowed: 'move' } })
    expect(h.interaction.getSnapshot().drag).toEqual([{ kind: 'folder', id: 'incoming' }])
    fireEvent(destination, new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 16 }))
    await act(async () => { fireEvent(destination, new MouseEvent('drop', { bubbles: true, cancelable: true, clientY: 16 })) })
    expect(h.mutate).toHaveBeenCalledWith([expect.objectContaining({ kind: 'entities.move', targets: [{ kind: 'folder', id: 'incoming' }], destination: { kind: 'folder', id: 'outer' } })])
    expect(setOrderBy).toHaveBeenCalledWith('manual')
    expect(h.interaction.getSnapshot().drag).toEqual([])
  })
})

describe('tag interaction', () => {
  it('preserves native panel selection and does not intercept modifier clicks for plugin selection', () => {
    const h = fixture()
    const panel = createSnapshotStore({ activePanelId: 'plugins' as string | null })
    const rows = ['s', 'blank'].map(id => ({ id, title: id === 's' ? '搜索优化' : '', blank: id === 'blank', running: false, runningSubagentCount: 0, completed: false, pinned: false, archived: false, updatedAt: 0 }))
    const props = { ...h.props, usePanelInfo: bind(panel), query: '', setQuery: vi.fn(), orderBy: 'manual', setOrderBy: vi.fn(), archivedFilter: 'default',
      ready: true, currentId: 'blank', home: undefined, resultLimit: 20, openSession: vi.fn(), startSession: vi.fn(), sessionRows: rows,
      workspaces: [{ workspaceId: 'p', title: 'DSH', path: '/project', sessionIds: ['s', 'blank'], createdAt: '', updatedAt: '' }],
      renderFactorySlot: (name: string, owner: object) => {
        if (name === 'betterClassifier.sessionRow') {
          const row = owner as WorkspaceSessionRowOwner
          return <div role="treeitem" aria-selected={row.currentId === row.node.id} onClick={() => row.onOpen(row.node.id)}>{row.node.blank ? '新会话' : row.node.title}</div>
        }
        return <div role="treeitem">{(owner as WorkspaceProjectRowOwner).group.label}</div>
      },
    } as TreeProps
    // The dynamic factory double covers two owner shapes; production never receives this test dispatcher.
    render(<ClassifierTreeView {...props} />)
    expect(screen.getByRole('treeitem', { name: '新会话' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    act(() => { panel.set({ activePanelId: null }) })
    expect(screen.getByRole('treeitem', { name: '新会话' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('treeitem', { name: '新会话' }))
    expect(props.openSession).toHaveBeenCalledWith('blank')
    fireEvent.click(screen.getByRole('treeitem', { name: '搜索优化' }), { ctrlKey: true })
    expect(props.openSession).toHaveBeenCalledWith('s')
  })
  it('renders the measured prefix and restores tags as space grows', () => {
    const h = fixture()
    const onRowClick = vi.fn()
    const view = render(<div onClick={onRowClick}><TagBadges {...h.props} target={{ kind: 'folder', id: 'outer' }} /></div>)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: '查看全部标签' })).toBeNull()
    act(() => { h.layout.update(value => { for (const key of Object.keys(value)) value[key] = { count: 1, minimum: 18 } }) })
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '查看全部标签' }).textContent).toBe('+2')
    fireEvent.click(screen.getByRole('button', { name: '查看全部标签' }))
    expect(onRowClick).not.toHaveBeenCalled()
    expect(h.props.edit).toHaveBeenCalledWith({ kind: 'tags', targets: [{ kind: 'folder', id: 'outer' }], revision: 0 })
    fireEvent.click(view.container.querySelector('span')!)
    expect(onRowClick).toHaveBeenCalledOnce()
    act(() => { h.layout.update(value => { for (const key of Object.keys(value)) value[key] = { count: 3, minimum: 18 } }) })
    expect(screen.getByRole('button', { name: '编辑标签: 待审阅' })).toBeTruthy()
    expect(h.data.getSnapshot().state!.assignments[0]!.tagIds).toHaveLength(3)
  })
  it('chooses readable foregrounds for light and dark custom tag colors', () => {
    expect(tagColors('#FFFFFF').color).toBe('#000000')
    expect(tagColors('#000000').color).toBe('#FFFFFF')
  })
  it('validates custom hex input before submitting a tag', () => {
    const h = fixture()
    h.interaction.update(value => { value.editor = { kind: 'tags', targets: [{ kind: 'session', id: 's' }], revision: 0 } })
    render(<ClassifierEditors {...h.props} />)
    fireEvent.click(screen.getByRole('button', { name: '添加标签' }))
    fireEvent.change(screen.getByLabelText('标签名称'), { target: { value: '研究' } })
    fireEvent.change(screen.getByLabelText('十六进制颜色'), { target: { value: '#oops' } })
    expect((screen.getByRole('button', { name: '完成' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('十六进制颜色'), { target: { value: '#12AB34' } })
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(h.mutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(h.mutate).toHaveBeenCalledWith([
      { kind: 'tag.create', id: expect.any(String), name: '研究', color: '#12AB34' },
      { kind: 'tags.assign', targets: [{ kind: 'session', id: 's' }], add: [expect.any(String)], remove: [] },
    ], 0)
  })
  it('offers parent tags for explicit addition without displaying or assigning them to the child', () => {
    const h = fixture()
    h.interaction.update(value => { value.editor = { kind: 'tags', targets: [{ kind: 'session', id: 's' }], revision: 0 } })
    render(<ClassifierEditors {...h.props} />)
    expect(screen.queryByText(/继承/)).toBeNull()
    expect(within(screen.getByRole('group', { name: '已关联标签' })).queryAllByRole('button')).toHaveLength(0)
    expect(within(screen.getByRole('group', { name: '可添加标签' })).getAllByRole('button')).toHaveLength(3)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: /^移除标签/ })).toHaveLength(0)
  })
})

function openAssignments(h: ReturnType<typeof fixture>, targets = [{ kind: 'session' as const, id: 's' }]) {
  h.interaction.update(value => { value.editor = { kind: 'tags', targets, revision: 0 } })
  return render(<ClassifierEditors {...h.props} />)
}
function back() { fireEvent.click(screen.getAllByRole('button', { name: '返回' }).at(-1)!) }

describe('tag editor draft pages', () => {
  it('does not dirty an unchanged tag definition', () => {
    const h = fixture()
    h.data.update(value => { value.state!.assignments.push({ target: { kind: 'session', id: 's' }, tagIds: ['one'] }) })
    openAssignments(h)
    fireEvent.click(screen.getByRole('button', { name: '修改标签 重点' }))
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true)
    expect(h.mutate).not.toHaveBeenCalled()
  })
  it('moves chips between assigned and available groups in one page until save', () => {
    const h = fixture()
    h.data.update(value => { value.state!.assignments.push({ target: { kind: 'session', id: 's' }, tagIds: ['one'] }) })
    openAssignments(h)
    expect(screen.queryByText('搜索优化')).toBeNull()
    expect(screen.queryByText(/^直接标签/)).toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    const assigned = within(screen.getByRole('group', { name: '已关联标签' }))
    expect(assigned.getByRole('button', { name: '修改标签 重点' })).toBeTruthy()
    expect(assigned.queryByRole('button', { name: '修改标签 开发' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '移除标签 重点' }))
    expect(h.mutate).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '添加标签' }))
    expect(screen.getByRole('button', { name: '添加标签 重点' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '添加标签 开发' }))
    expect(screen.queryByRole('button', { name: '添加标签 开发' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '添加标签 待审阅' }))
    fireEvent.click(screen.getByRole('button', { name: '添加标签 待审阅' }))
    expect(screen.getByRole('dialog', { name: '编辑标签' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(h.mutate).toHaveBeenCalledWith([{ kind: 'tags.assign', targets: [{ kind: 'session', id: 's' }], add: ['two', 'three'], remove: ['one'] }], 0)
    expect(h.data.getSnapshot().state!.assignments.at(-1)!.tagIds).toEqual(['one'])
  })

  it('retains definition input across back, creates and selects atomically, and cancel writes nothing', () => {
    const h = fixture()
    openAssignments(h)
    fireEvent.click(screen.getByRole('button', { name: '添加标签' }))
    fireEvent.change(screen.getByLabelText('标签名称'), { target: { value: '新研究' } })
    fireEvent.change(screen.getByLabelText('十六进制颜色'), { target: { value: '#4D6BFE' } })
    back()
    fireEvent.click(screen.getByRole('button', { name: '添加标签' }))
    expect((screen.getByLabelText('标签名称') as HTMLInputElement).value).toBe('新研究')
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(screen.queryByRole('button', { name: '添加标签 新研究' })).toBeNull()
    expect(screen.getByRole('button', { name: '修改标签 新研究' })).toBeTruthy()
    expect(h.mutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(h.props.closeEditor).toHaveBeenCalledOnce()
    expect(h.mutate).not.toHaveBeenCalled()
    // The close callback is a test double, so the draft remains available to inspect its submission.
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(h.mutate).toHaveBeenCalledWith([
      { kind: 'tag.create', id: expect.any(String), name: '新研究', color: '#4D6BFE' },
      { kind: 'tags.assign', targets: [{ kind: 'session', id: 's' }], add: [expect.any(String)], remove: [] },
    ], 0)
    const submitted = h.mutate.mock.calls[0]![0]
    expect(submitted.find(command => command.kind === 'tag.create')!.id).toBe(submitted.find(command => command.kind === 'tags.assign')!.add[0])
  })

  it('edits shared definitions in the draft and preserves them through failure and a newer snapshot', () => {
    const h = fixture()
    h.mutate.mockResolvedValue(false)
    h.data.update(value => { value.state!.assignments.push({ target: { kind: 'session', id: 's' }, tagIds: ['one'] }) })
    openAssignments(h)
    fireEvent.click(screen.getByRole('button', { name: '修改标签 重点' }))
    expect(screen.queryByRole('button', { name: '删除标签' })).toBeNull()
    fireEvent.change(screen.getByLabelText('标签名称'), { target: { value: '优先处理' } })
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(h.mutate).toHaveBeenCalledWith([{ kind: 'tag.update', id: 'one', name: '优先处理', color: '#FFFFFF' }], 0)
    act(() => {
      h.data.update(value => { value.state!.revision = 1; value.state!.tags[0]!.name = '另一个页面的名称' })
      h.interaction.update(value => { value.notice = 'conflict' })
    })
    expect(screen.getByRole('button', { name: '修改标签 优先处理' })).toBeTruthy()
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toContain('其他页面')
  })

  it('validates duplicate names locally without a global management page', () => {
    const h = fixture()
    h.interaction.update(value => { value.editor = { kind: 'tags', targets: [{ kind: 'folder', id: 'outer' }], revision: 0 } })
    render(<ClassifierEditors {...h.props} />)
    fireEvent.click(screen.getByRole('button', { name: '添加标签' }))
    fireEvent.change(screen.getByLabelText('标签名称'), { target: { value: '重点' } })
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(screen.getByRole('alert').textContent).toContain('名称已存在')
    back()
    fireEvent.click(screen.getByRole('button', { name: '修改标签 重点' }))
    expect(screen.queryByRole('button', { name: '删除标签' })).toBeNull()
    expect(screen.queryByRole('button', { name: '管理标签' })).toBeNull()
    expect(h.mutate).not.toHaveBeenCalled()
  })
})

describe('editor recovery', () => {
  it('retains a folder draft through a write failure and retries with its opening revision', async () => {
    const h = fixture()
    h.interaction.update(value => { value.editor = { kind: 'folder.create', scope: { kind: 'global' }, parentId: null, revision: 0 } })
    h.mutate.mockImplementationOnce(async () => { h.data.update(value => { value.phase = 'error' }); return false })
    h.props.refresh = vi.fn(async () => { h.data.update(value => { value.phase = 'ready'; value.state!.revision = 4 }) })
    render(<ClassifierEditors {...h.props} />)
    fireEvent.change(screen.getByLabelText('文件夹名称'), { target: { value: '保留草稿' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保存' })) })
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('文件夹名称') as HTMLInputElement).value).toBe('保留草稿')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保存' })) })
    expect(h.mutate.mock.calls.map(([, revision]) => revision)).toEqual([0, 0])
    expect(h.mutate.mock.calls[1]?.[0]).toEqual([expect.objectContaining({ name: '保留草稿' })])
    expect(h.props.closeEditor).not.toHaveBeenCalled()
  })
  it.each(['folder', 'tags'])('preserves %s drafts but blocks Save during adapter fallback', kind => {
    const h = fixture()
    if (kind === 'folder') h.interaction.update(value => { value.editor = { kind: 'folder.create', scope: { kind: 'global' }, parentId: null, revision: 0 } })
    else h.interaction.update(value => { value.editor = { kind: 'tags', targets: [{ kind: 'session', id: 's' }], revision: 0 } })
    render(<ClassifierEditors {...h.props} />)
    if (kind === 'folder') fireEvent.change(screen.getByLabelText('文件夹名称'), { target: { value: '草稿' } })
    else fireEvent.click(screen.getByRole('button', { name: '添加标签 重点' }))
    act(() => { h.adapter.set({ phase: 'fallback' }) })
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true)
    if (kind === 'folder') expect((screen.getByLabelText('文件夹名称') as HTMLInputElement).value).toBe('草稿')
    else expect(screen.getByRole('button', { name: '修改标签 重点' })).toBeTruthy()
    act(() => { h.adapter.set({ phase: 'ready' }) })
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(false)
    expect(h.mutate).not.toHaveBeenCalled()
  })
})

function searchableTree(h: ReturnType<typeof fixture>, query: string): TreeProps {
  return {
    ...h.props, query, setQuery: vi.fn(), orderBy: 'manual', setOrderBy: vi.fn(), archivedFilter: 'default', ready: true,
    currentId: undefined, home: undefined, resultLimit: 20, openSession: vi.fn(), startSession: vi.fn(),
    usePanelInfo: (select: (value: { activePanelId: string | null }) => unknown) => select({ activePanelId: null }),
    workspaces: [{ workspaceId: 'p', title: 'DSH', path: '/project', sessionIds: ['s'], createdAt: '', updatedAt: '' }],
    sessionRows: [{ id: 's', title: '搜索优化', blank: false, running: false, runningSubagentCount: 0, completed: false, pinned: false, archived: false, updatedAt: 0 }],
    searchContent: vi.fn(async () => ({ items: [], hasMore: false })),
    renderFactorySlot: (name: string, owner: object) => {
      if (name === 'betterClassifier.sessionRow') {
        const row = owner as WorkspaceSessionRowOwner
        return <div role="treeitem" onClick={() => row.onOpen(row.node.id)}>{row.node.title}</div>
      }
      const row = owner as WorkspaceProjectRowOwner
      return <div role="treeitem" aria-expanded={row.group.expanded} onClick={row.onToggle}>{row.group.label}</div>
    },
  } as TreeProps
}

describe('collapsed search navigation', () => {
  it.each([false, true])('opens a search hit, reveals its normal directory and invokes the native scroll effect (ungrouped=%s)', async ungrouped => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    const previous = HTMLElement.prototype.scrollIntoView
    const scroll = vi.fn()
    HTMLElement.prototype.scrollIntoView = scroll
    const h = fixture()
    h.view.actions.expand('ungrouped', false)
    h.view.actions.expand('folder:outer', false)
    h.view.actions.expand('project:p', false)
    const acknowledged = vi.fn()
    const base = searchableTree(h, '搜索优化')
    function Browser() {
      const [query, setQuery] = useState('搜索优化')
      const [pending, setPending] = useState<SessionId>()
      return <ClassifierTreeView {...base} query={query} setQuery={setQuery} workspaces={ungrouped ? [] : base.workspaces}
        revealSessionId={pending} onSessionRevealed={id => { acknowledged(id); setPending(undefined) }}
        openSession={id => { setPending(id); setQuery('') }}
        renderFactorySlot={((name: string, owner: object) => {
          if (name !== 'betterClassifier.sessionRow') {
            const row = owner as WorkspaceProjectRowOwner
            return <div role="treeitem" aria-expanded={row.group.expanded} onClick={row.onToggle}>{row.group.label || '未分组'}</div>
          }
          const row = owner as WorkspaceSessionRowOwner
          return <SessionNodeItem {...row} onRenameRequest={() => {}} renderSlot={() => null} renderFactorySlot={() => null}
            useContextMenu={() => ({ getTriggerProps: () => ({}) } as never)} useContextMenuTarget={select => select(null)} useSessionAccess={() => true} t={key => key} />
        }) as TreeProps['renderFactorySlot']} />
    }
    try {
      render(<Browser />)
      expect(scroll).not.toHaveBeenCalled()
      await act(async () => { fireEvent.click(screen.getByRole('treeitem', { name: /^搜索优化/ })) })
      expect(screen.getByRole('treeitem', { name: /^搜索优化/ })).toBeTruthy()
      expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })
      expect(acknowledged).toHaveBeenCalledWith('s')
      expect(h.view.getSnapshot().expanded[ungrouped ? 'ungrouped' : 'project:p']).toBe(true)
    } finally { cleanup(); HTMLElement.prototype.scrollIntoView = previous }
  })
  it('accepts background gestures inside a sidebar drawer while excluding portaled row menus', () => {
    const h = fixture()
    render(<div role="dialog" aria-label="Sidebar drawer"><ClassifierTreeView {...searchableTree(h, '')} /></div>)
    fireEvent.contextMenu(screen.getByRole('region', { name: '会话列表空白区域' }))
    expect(h.backgroundMouse).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '文件夹“工作”的操作' }))
    fireEvent.contextMenu(screen.getByRole('menuitem', { name: '在此新建文件夹' }))
    expect(h.backgroundMouse).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menuitem', { name: '在此范围搜索' })).toBeNull()
  })
  it('ignores legacy visibility and filters while retaining expansion preferences', () => {
    const expanded = { 'folder:outer': true, 'project:p': true }
    localStorage.setItem('dsh.better-classifier.view.v1', JSON.stringify({ expanded, showTags: false, tagIds: ['missing'], tagMode: 'all', scope: { kind: 'folder', id: 'missing' } }))
    const h = fixture()
    render(<ClassifierTreeView {...searchableTree(h, '')} />)
    expect(screen.getByRole('treeitem', { name: '搜索优化' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '编辑标签: 重点' })).toBeTruthy()
    expect(h.view.getSnapshot().expanded).toEqual(expanded)
    expect(screen.queryByText('自定义分类')).toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })
  it('binds only background gestures and leaves rows, row whitespace and controls untouched', () => {
    const h = fixture()
    const view = render(<ClassifierTreeView {...searchableTree(h, '找不到的名称')} />)
    const background = screen.getByRole('region', { name: '会话列表空白区域' })
    fireEvent.contextMenu(background, { clientX: 30, clientY: 500 })
    expect(h.backgroundMouse).toHaveBeenCalledOnce()
    fireEvent.keyDown(background, { key: 'F10', shiftKey: true })
    expect(h.backgroundKey).toHaveBeenCalledOnce()
    view.rerender(<ClassifierTreeView {...searchableTree(h, '')} />)
    fireEvent.contextMenu(view.container.querySelector('[data-classifier-key]')!)
    fireEvent.contextMenu(screen.getByRole('button', { name: '编辑标签: 重点' }))
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /^工作/ }), { key: 'F10', shiftKey: true })
    expect(h.backgroundMouse).toHaveBeenCalledOnce()
    expect(h.backgroundKey).toHaveBeenCalledOnce()
    view.unmount()
    expect(h.props.bindBackground).toHaveBeenLastCalledWith(expect.any(String), null)
  })
  it('opens one level at a time, preserves normal expansion and resets when search or archive conditions change', () => {
    const h = fixture()
    h.data.update(value => {
      value.state!.folders.push({ id: 'inner', name: '插件', scope: { kind: 'project', projectId: 'p' }, parentId: null })
      value.state!.placements.push({ target: { kind: 'session', id: 's' }, folderId: 'inner' })
    })
    h.view.actions.expand('folder:outer', false)
    h.view.actions.expand('project:p', true)
    h.view.actions.expand('folder:inner', true)
    const before = { ...h.view.getSnapshot().expanded }
    const props = searchableTree(h, '工作')
    const view = render(<ClassifierTreeView {...props} />)
    expect(screen.getByRole('treeitem', { name: /^工作/ }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('treeitem', { name: 'DSH' })).toBeNull()
    fireEvent.click(screen.getByRole('treeitem', { name: /^工作/ }))
    expect(screen.getByRole('treeitem', { name: 'DSH' }).getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('treeitem', { name: 'DSH' }))
    expect(screen.getByRole('treeitem', { name: /^插件/ }).getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('treeitem', { name: /^插件/ }))
    expect(screen.getByRole('treeitem', { name: '搜索优化' })).toBeTruthy()
    expect(h.view.getSnapshot().expanded).toEqual(before)
    expect(props.searchContent).not.toHaveBeenCalled()
    view.rerender(<ClassifierTreeView {...props} archivedFilter="show" />)
    expect(screen.getByRole('treeitem', { name: /^工作/ }).getAttribute('aria-expanded')).toBe('false')
    view.rerender(<ClassifierTreeView {...props} query="搜索优化" />)
    expect(screen.getByRole('treeitem', { name: '搜索优化' })).toBeTruthy()
    expect(screen.getByRole('treeitem', { name: /^工作/ }).getAttribute('aria-expanded')).toBe('true')
    view.rerender(<ClassifierTreeView {...props} query="" />)
    expect(screen.getByRole('treeitem', { name: /^工作/ }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('treeitem', { name: 'DSH' })).toBeNull()
    expect(h.view.getSnapshot().expanded).toEqual(before)
  })

  it('debounces body requests, aborts stale queries and ignores a late body hit after switching to a container', async () => {
    vi.useFakeTimers()
    const h = fixture()
    let finish!: (result: { items: { sessionId: never; snippet: string }[]; hasMore: boolean }) => void
    const searchContent = vi.fn((_query: string, _signal: AbortSignal, _ids: readonly string[]) => new Promise<{ items: { sessionId: never; snippet: string }[]; hasMore: boolean }>(resolve => { finish = resolve }))
    const props = { ...searchableTree(h, '正文词'), searchContent }
    const view = render(<ClassifierTreeView {...props} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(249) })
    expect(searchContent).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(searchContent).toHaveBeenCalledOnce()
    expect(searchContent.mock.calls[0]![2]).toEqual(['s'])
    view.rerender(<ClassifierTreeView {...props} query="工作" />)
    expect(searchContent.mock.calls[0]![1].aborted).toBe(true)
    await act(async () => { finish({ items: [{ sessionId: 's' as never, snippet: '过期摘要' }], hasMore: true }); await vi.advanceTimersByTimeAsync(300) })
    expect(searchContent).toHaveBeenCalledOnce()
    expect(screen.queryByText('过期摘要')).toBeNull()
    expect(screen.getByRole('treeitem', { name: /^工作/ }).getAttribute('aria-expanded')).toBe('false')
  })

  it('reveals a body-only hit with its ancestors and keeps name matches when body search fails', async () => {
    vi.useFakeTimers()
    const h = fixture()
    const searchContent = vi.fn(async () => ({ items: [{ sessionId: 's' as never, snippet: '正文摘要' }], hasMore: false }))
    const props = { ...searchableTree(h, '正文词'), searchContent }
    const view = render(<ClassifierTreeView {...props} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(screen.getByRole('treeitem', { name: '搜索优化' })).toBeTruthy()
    expect(screen.getByText('正文摘要')).toBeTruthy()
    expect(screen.getByRole('treeitem', { name: /^工作/ }).getAttribute('aria-expanded')).toBe('true')
    view.rerender(<ClassifierTreeView {...props} query="搜索优化" searchContent={async () => { throw new Error('index offline') }} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(screen.getByRole('treeitem', { name: '搜索优化' })).toBeTruthy()
    expect(screen.getByText('正文搜索暂不可用')).toBeTruthy()
  })
})
