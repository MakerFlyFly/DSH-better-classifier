// @vitest-environment jsdom
import { useState, useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { MenuContribution } from '@deepseek-ai/dsh-client-ui-context-menu/client'
import { BackgroundMenuOwner } from '../src/client/background-menu.ts'
import { ClassifierTreeView } from '../src/client/Tree.tsx'
import { ClassifierEditors } from '../src/client/Editors.tsx'
import { createClassifierViewStore } from '../src/client/state.ts'
import { zh } from '../src/client/locales.ts'
import { emptyState, reduceMutation } from '../src/domain/model.ts'
import type { ClassifierCommand } from '../src/types.ts'
import type { DataState, Editor, InteractionState } from '../src/client/controller.ts'
import type { EditorProps, TreeProps } from '../src/client/contract.ts'

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
function bind<T>(source: { getSnapshot(): T; subscribe(listener: () => void): () => void }) {
  return <S,>(select: (value: T) => S): S => select(useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot))
}
function fixture() {
  const data = createSnapshotStore<DataState>({ phase: 'ready', state: emptyState() })
  const interaction = createSnapshotStore<InteractionState>({ editor: null, busy: false, drag: [], notice: null, noticeSeq: 0 })
  const controller = {
    data, interaction,
    edit: vi.fn((editor: Exclude<Editor, null>) => { interaction.update(value => { value.editor = editor }) }),
    notice: vi.fn(),
  }
  const disposers: (() => void)[] = [], unregister = vi.fn()
  let contribution!: MenuContribution<'betterClassifierBackground'>
  const t = ((key: keyof typeof zh, values?: Record<string, string | number>) => Object.entries(values ?? {}).reduce((text, [key, value]) => text.replaceAll('{' + key + '}', String(value)), zh[key] as string)) as EditorProps['t']
  const owner = new BackgroundMenuOwner({
    contextMenus: { register: (value: typeof contribution) => { contribution = value; return unregister } },
    effect: (setup: () => () => void) => { disposers.push(setup()) },
  } as never, controller, t)
  return { owner, controller, data, interaction, t, unregister, contribution: () => contribution, dispose: () => { disposers.reverse().forEach(dispose => { dispose() }) } }
}

it('offers only root-folder creation, observes readiness/busy state and releases obsolete callbacks', async () => {
  const h = fixture(), created = vi.fn()
  const items = () => h.contribution().resolve({ key: 'list' }, new AbortController().signal)
  h.owner.bind('list', { ready: false, created })
  expect((await items())[0]?.disabled).toBe(true)
  h.owner.bind('list', { ready: true, created })
  expect((await items()).map(item => item.label)).toEqual(['新建文件夹'])
  expect((await items())[0]?.disabled).toBe(false)
  h.interaction.update(value => { value.busy = true })
  expect((await items())[0]?.disabled).toBe(true)
  h.interaction.update(value => { value.busy = false })
  h.data.update(value => { value.phase = 'offline' })
  expect((await items())[0]?.disabled).toBe(true)
  h.data.update(value => { value.phase = 'ready' })
  await (await items())[0]!.run!()
  expect(h.controller.edit).toHaveBeenCalledWith({ kind: 'folder.create', scope: { kind: 'global' }, parentId: null, revision: 0, background: 'list' })
  h.owner.bind('list', null)
  h.owner.created('list', 'obsolete')
  expect(created).not.toHaveBeenCalled()
  h.owner.bind('list', { ready: true, created })
  h.dispose()
  expect(h.unregister).toHaveBeenCalledOnce()
  h.owner.created('list', 'disposed')
  expect(created).not.toHaveBeenCalled()
})

it('preserves search on cancel/failure, then exits search and focuses the persisted root folder', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => { fn(0) }, 0))
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => { clearTimeout(id) })
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  const h = fixture()
  const view = createClassifierViewStore().create()
  let target!: { key: string }
  let fail = true
  const mutate = vi.fn(async (commands: ClassifierCommand[], revision?: number) => {
    if (fail) return false
    const result = reduceMutation(h.data.getSnapshot().state!, { expectedRevision: revision!, commands }, { projects: [], sessionIds: [] })
    if (!result.ok) throw new Error(result.code)
    h.data.set({ phase: 'ready', state: result.state })
    h.interaction.update(value => { value.editor = null })
    return true
  })
  const shared = {
    useClassifier: bind(h.data), useInteraction: bind(h.interaction), useStore: bind(view), actions: view.actions, t: h.t,
    edit: h.controller.edit, closeEditor: () => { h.interaction.update(value => { value.editor = null }) }, notice: h.controller.notice,
    bindBackground: h.owner.bind, folderCreated: h.owner.created, mutate, refresh: vi.fn(), drag: vi.fn(),
    useTagLayout: () => undefined, measureTags: vi.fn(),
    useWorkspaces: (select: (state: { items: [] }) => unknown) => select({ items: [] }),
    useSessions: (select: (state: { ids: []; byId: object }) => unknown) => select({ ids: [], byId: {} }),
    useContextMenu: () => ({ getTriggerProps: (value: { value: { key: string } }) => ({ tabIndex: 0, onContextMenu: () => { target = value.value } }) }),
  } as EditorProps
  function Harness() {
    const [query, setQuery] = useState('正在搜索')
    const props = { ...shared, query, setQuery, ready: true, workspaces: [], sessionRows: [], resultLimit: 20, orderBy: 'manual', archivedFilter: 'default',
      bindBackground: (key, region) => { h.owner.bind(key, region) },
      usePanelInfo: (select: (value: { activePanelId: null }) => unknown) => select({ activePanelId: null }), searchContent: vi.fn(), renderFactorySlot: vi.fn(),
    } as TreeProps
    return <><output data-testid="query">{query}</output><ClassifierTreeView {...props} /><ClassifierEditors {...shared} /></>
  }
  const mounted = render(<Harness />)
  const open = async () => {
    fireEvent.contextMenu(screen.getByRole('region', { name: '会话列表空白区域' }))
    await act(async () => { await (await h.contribution().resolve(target, new AbortController().signal))[0]!.run!() })
  }
  await open()
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.getByTestId('query').textContent).toBe('正在搜索')
  await open()
  fireEvent.change(screen.getByLabelText('文件夹名称'), { target: { value: '根目录新建' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保存' })) })
  expect(screen.getByTestId('query').textContent).toBe('正在搜索')
  expect(h.data.getSnapshot().state!.folders).toEqual([])
  fail = false
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保存' })) })
  await act(async () => { await vi.advanceTimersByTimeAsync(1) })
  expect(screen.getByTestId('query').textContent).toBe('')
  expect(h.data.getSnapshot().state!.folders[0]).toMatchObject({ name: '根目录新建', scope: { kind: 'global' }, parentId: null })
  expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: /^根目录新建/ }))
  expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })
  mounted.unmount()
  h.dispose()
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})
