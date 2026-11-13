/** Tree-shaped classifier projection using the native Workspace and Session row factories. */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent, ReactNode } from 'react'
import { HoverCard, HoverCardGroup, IconFolderCloseRegular, IconFolderOpenRegular, IconTriangleRightFillRegular, IconLoadingOutlineRegular as Spinner, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ClassifierState, ContainerRef, EntityRef } from '../types.ts'
import { ancestorsOf, entityKey, reduceMutation } from '../domain/model.ts'
import { buildTree, candidateSessions, projectSearch } from '../domain/tree.ts'
import type { ClassifierTree, TreeNode } from '../domain/tree.ts'
import type { TreeProps } from './contract.ts'
import { TagBadges } from './Tags.tsx'
import css from './classifier.module.css'

interface ContentState { key: string; status: 'idle' | 'loading' | 'ready' | 'error'; items: { sessionId: string; snippet: string }[]; hasMore: boolean }
interface DropTarget { destination: ContainerRef; before?: EntityRef; key: string; placement: 'inside' | 'before' | 'after' }

/** @param props - native browser context and classifier state bindings. */
export function ClassifierTreeView(props: TreeProps) {
  const data = props.useClassifier(state => state)
  const state = data.state
  const key = useId()
  const root = useRef<HTMLDivElement | null>(null)
  const focusFrame = useRef<number | undefined>(undefined)
  const setQuery = useRef(props.setQuery)
  setQuery.current = props.setQuery
  const bindBackground = useRef(props.bindBackground)
  bindBackground.current = props.bindBackground
  const bind = useCallback((element: HTMLDivElement | null) => {
    if (focusFrame.current !== undefined) cancelAnimationFrame(focusFrame.current)
    root.current = element
    bindBackground.current(key, element === null ? null : { ready: props.ready, created: id => {
      setQuery.current('')
      // Store notifications and the modal's return-focus cleanup commit on the first frame.
      focusFrame.current = requestAnimationFrame(() => {
        focusFrame.current = requestAnimationFrame(() => {
          focusFrame.current = undefined
          const item = [...(root.current?.querySelectorAll<HTMLElement>('[data-classifier-key]') ?? [])]
            .find(row => row.dataset.classifierKey === 'folder:' + id)?.querySelector<HTMLElement>('[role="treeitem"]')
          item?.scrollIntoView({ block: 'nearest' })
          item?.focus({ preventScroll: true })
        })
      })
    } })
  }, [key, props.ready])
  const trigger = props.useContextMenu().getTriggerProps({ kind: 'betterClassifierBackground', value: { key } })
  return <div ref={bind} className={css.treeWrapper} data-classifier-background={key} role="region" aria-label={props.t('listBackground')} tabIndex={trigger.tabIndex}
    onContextMenu={event => {
      if (!(event.target instanceof Element) || !event.currentTarget.contains(event.target)) return
      const occupied = event.target.closest('[data-classifier-key],button,input,textarea,select,a,[role="menu"],[role="dialog"]')
      if (occupied === null || !event.currentTarget.contains(occupied)) trigger.onContextMenu?.(event)
    }}
    onKeyDown={event => { if (event.target === event.currentTarget) trigger.onKeyDown?.(event) }}>
    {state === null ? <div className={css.empty} role="status" aria-label={props.t(data.phase === 'loading' ? 'loading' : 'loadFailed')}>
      {data.phase === 'loading' ? <Spinner /> : <><span>{props.t('loadFailed')}</span><button className={css.textButton} onClick={() => { void props.refresh() }}>{props.t('retry')}</button></>}
    </div> : <LoadedTree {...props} state={state} phase={data.phase} />}
  </div>
}

function LoadedTree(props: TreeProps & { state: ClassifierState; phase: string }) {
  const { state, t } = props
  const preferences = props.useStore(value => value)
  const interaction = props.useInteraction(value => value)
  const conversationVisible = props.usePanelInfo(value => value.activePanelId === null)
  const [content, setContent] = useState<ContentState>({ key: '', status: 'idle', items: [], hasMore: false })
  const [retry, setRetry] = useState(0)
  const [drop, setDrop] = useState<DropTarget | null>(null)
  const [searchExpansion, setSearchExpansion] = useState<{ key: string; values: Record<string, boolean> }>({ key: '', values: {} })
  const tree = useMemo(() => buildTree(state, props.workspaces.map(project => ({ id: project.workspaceId, title: project.title, sessionIds: [...project.sessionIds] })), props.sessionRows, props.orderBy), [state, props.workspaces, props.sessionRows, props.orderBy])
  const candidates = candidateSessions(state, tree, { query: props.query })
  const searchKey = JSON.stringify([props.query, [...candidates].sort(), state.revision, retry])
  const expansionKey = JSON.stringify([props.query, props.archivedFilter])
  if (searchExpansion.key !== expansionKey) setSearchExpansion({ key: expansionKey, values: {} })
  useEffect(() => {
    if (!props.query || !props.ready || candidates.length === 0) { setContent({ key: searchKey, status: 'idle', items: [], hasMore: false }); return }
    const cancellation = new AbortController()
    setContent({ key: searchKey, status: 'loading', items: [], hasMore: false })
    const timer = setTimeout(() => {
      props.searchContent(props.query, cancellation.signal, candidates as SessionId[]).then(result => {
        if (!cancellation.signal.aborted) setContent({ key: searchKey, status: 'ready', items: [...result.items], hasMore: result.hasMore })
      }).catch(() => {
        if (!cancellation.signal.aborted) setContent({ key: searchKey, status: 'error', items: [], hasMore: false })
      })
    }, 250)
    return () => { clearTimeout(timer); cancellation.abort() }
  }, [searchKey, props.ready, props.searchContent])
  const currentContent = content.key === searchKey ? content : { status: 'loading', items: [], hasMore: false }
  const search = projectSearch(state, tree, { query: props.query, content: currentContent.items, contentHasMore: currentContent.hasMore, limit: props.resultLimit })
  const sessions = new Map(props.sessionRows.map(row => [row.id as string, row]))
  const workspaces = new Map(props.workspaces.map(project => [project.workspaceId as string, project]))
  const currentPath = props.currentId && tree.nodes.has('session:' + props.currentId) ? ancestorsOf(state, tree.catalog, { kind: 'session', id: props.currentId }, tree.lookup).map(entityKey) : []
  const disabled = props.phase !== 'ready' || interaction.busy

  const expanded = (node: TreeNode, browsing: boolean): boolean => {
    const key = entityKey(node.ref)
    if (search.active) return searchExpansion.values[key] ?? (!browsing && !search.matches.has(key) && node.children.some(child => search.visible.has(child)))
    return preferences.expanded[key] ?? (node.ref.kind === 'folder' || currentPath.includes(key))
  }
  const toggle = (node: TreeNode, browsing: boolean): void => {
    const key = entityKey(node.ref)
    if (search.active) setSearchExpansion(current => ({ key: expansionKey, values: { ...current.values, [key]: !expanded(node, browsing) } }))
    else props.actions.expand(key, !expanded(node, browsing))
  }
  const openSession = (id: SessionId): void => {
    const path = ancestorsOf(state, tree.catalog, { kind: 'session', id }, tree.lookup).map(entityKey)
    props.actions.reveal(path.length ? path : ['ungrouped'])
    props.openSession(id)
  }
  const dragStart = (ref: EntityRef): void => { props.drag([ref]) }
  const dragEnd = (): void => { props.drag([]); setDrop(null) }
  const resolveDrop = (event: DragEvent<HTMLElement>, node?: TreeNode): DropTarget | null => {
    if (!interaction.drag.length || disabled || search.active) return null
    let destination: ContainerRef = { kind: 'root' }, before: EntityRef | undefined
    let placement: DropTarget['placement'] = 'inside'
    if (node) {
      const rect = event.currentTarget.getBoundingClientRect()
      const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1)
      const inside = node.ref.kind !== 'session' && ratio >= 0.25 && ratio <= 0.75
      if (inside) destination = { kind: node.ref.kind as 'folder' | 'project', id: node.ref.id }
      else {
        destination = node.parent
        placement = ratio < 0.5 ? 'before' : 'after'
        const siblings = destination.kind === 'root' ? tree.roots : tree.nodes.get(destination.kind + ':' + destination.id)?.children ?? []
        const index = siblings.indexOf(entityKey(node.ref))
        const anchor = placement === 'before' ? entityKey(node.ref) : siblings.slice(index + 1).find(key => !interaction.drag.some(ref => entityKey(ref) === key))
        if (anchor) before = tree.nodes.get(anchor)!.ref
      }
    }
    const result = reduceMutation(state, { expectedRevision: state.revision, commands: [{ kind: 'entities.move', targets: [...interaction.drag], destination, ...(before ? { before } : {}) }] }, tree.catalog)
    return result.ok ? { destination, ...(before ? { before } : {}), key: node ? entityKey(node.ref) : 'root', placement } : null
  }
  const commitDrop = (target: DropTarget): void => {
    const siblings = target.destination.kind === 'root' ? tree.roots : tree.nodes.get(target.destination.kind + ':' + target.destination.id)?.children ?? []
    void props.mutate([{ kind: 'entities.move', targets: [...interaction.drag], destination: target.destination,
      ...(target.before ? { before: target.before } : {}), visibleOrder: siblings.map(key => tree.nodes.get(key)!.ref) }]).then(ok => {
      if (ok) { props.setOrderBy('manual'); if (target.destination.kind !== 'root') props.actions.expand(target.destination.kind + ':' + target.destination.id, true) }
      dragEnd()
    })
  }
  const renderNode = (key: string, browsing = false): ReactNode => {
    const node = tree.nodes.get(key)!
    if (search.active && !browsing && !search.visible.has(key)) return null
    const isExpanded = expanded(node, browsing)
    const browseChildren = browsing || (search.matches.has(key) && isExpanded)
    const native = node.ref.kind === 'session' ? sessions.get(node.ref.id) : undefined
    const project = node.ref.kind === 'project' ? workspaces.get(node.ref.id) : undefined
    const descendants = isExpanded ? node.children.map(child => renderNode(child, browseChildren)) : null
    return <div key={key} role="none">
      <div className={[css.row, drop?.key === key ? css['drop' + drop.placement] : '', search.active && !browsing && !search.matches.has(key) ? css.context : ''].join(' ')}
        data-classifier-key={key} style={{ '--dsh-workspace-indent': Math.min(node.depth + (node.ref.kind === 'session' && node.parent.kind === 'root' ? 1 : 0), 6) * 12 + 'px' } as CSSProperties}
        onDragOver={event => { const target = resolveDrop(event, node); if (target) { event.preventDefault(); event.stopPropagation(); setDrop(target) } }}
        onDropCapture={event => { const target = resolveDrop(event, node); if (target) { event.preventDefault(); event.stopPropagation(); commitDrop(target) } }}>
        <div className={css.nativeRow}>
          {native ? props.renderFactorySlot('betterClassifier.sessionRow', {
            level: node.depth + (node.parent.kind === 'root' ? 2 : 1),
            node: native, currentId: conversationVisible ? props.currentId : undefined, now: Date.now(), onOpen: openSession, home: props.home,
            onReveal: props.query === '' && props.revealSessionId === native.id ? () => { props.onSessionRevealed?.(native.id) } : undefined,
            drag: disabled || search.active ? undefined : { start: () => { dragStart(node.ref) }, end: dragEnd, active: false, marker: null, hover: () => {}, drop: () => {} },
          }) : project ? props.renderFactorySlot('betterClassifier.projectRow', {
            level: node.depth + 1,
            group: { key: project.workspaceId, workspaceId: project.workspaceId, cwd: project.path, createdAt: Date.parse(project.createdAt), label: project.title,
              sessionCount: project.sessionIds.length, expanded: isExpanded, containsCurrent: currentPath.includes(key), sessions: [] },
            containsCurrentDescendant: currentPath.includes(key), home: props.home,
            onToggle: () => { toggle(node, browsing) }, onCreate: id => { props.actions.expand(key, true); props.startSession(id) },
            drag: disabled || search.active ? undefined : { start: () => { dragStart(node.ref) }, end: dragEnd },
          }) : <FolderRow {...props} node={node} tree={tree} expanded={isExpanded} disabled={disabled} state={state}
            toggle={() => { toggle(node, browsing) }} dragStart={() => { dragStart(node.ref) }} dragEnd={dragEnd} draggable={!disabled && !search.active} />}
          {search.snippets.has(key) && <div className={css.snippet}>{search.snippets.get(key)}</div>}
        </div>
      </div>
      {descendants && <div role="group">{descendants}</div>}
    </div>
  }
  const ungrouped = tree.roots.filter(key => tree.nodes.get(key)!.ref.kind === 'session')
  const ungroupedVisible = ungrouped.filter(key => !search.active || search.visible.has(key))
  const ungroupedExpanded = search.active ? (searchExpansion.values.ungrouped ?? true) : (preferences.expanded.ungrouped ?? true)
  const rendered = tree.roots.filter(key => tree.nodes.get(key)!.ref.kind !== 'session').map(key => renderNode(key))
  if (ungroupedVisible.length) rendered.push(<div key="ungrouped" role="none">
    {props.renderFactorySlot('betterClassifier.projectRow', {
      level: 1,
      group: { key: '', workspaceId: undefined, cwd: undefined, createdAt: undefined, label: '', sessionCount: ungroupedVisible.length,
        expanded: ungroupedExpanded, containsCurrent: ungrouped.some(key => key === 'session:' + props.currentId), sessions: [] },
      onToggle: () => {
        if (search.active) setSearchExpansion(current => ({ key: expansionKey, values: { ...current.values, ungrouped: !ungroupedExpanded } }))
        else props.actions.expand('ungrouped', !ungroupedExpanded)
      }, onCreate: () => {},
    })}
    {ungroupedExpanded && <div role="group">{ungroupedVisible.map(key => renderNode(key))}</div>}
  </div>)
  return <div className={css.treeContents}>
    {props.phase !== 'ready' && <div className={css.warning} role="status">{t(props.phase === 'error' ? 'loadFailed' : 'offline')} <button className={css.textButton} onClick={() => { void props.refresh() }}>{t('retry')}</button></div>}
    <HoverCardGroup><div role="tree" aria-label={t('title')} className={css.tree}
      onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return
        if (!(event.target instanceof HTMLElement) || event.target.closest('button,input')) return
        const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]')]
        const current = rows.findIndex(row => row === event.target || row.contains(event.target as Node))
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)))
        const row = rows[next]
        if (row) { event.preventDefault(); row.tabIndex = 0; row.focus() }
      }}>
      {rendered}
    </div></HoverCardGroup>
    {(search.active ? search.matches.size === 0 && !(props.query && currentContent.status === 'loading') : tree.order.length === 0)
      && <div className={css.empty}>{t(search.active ? 'noResults' : 'empty')}</div>}
    {interaction.drag.length > 0 && !search.active && <div className={css.rootDrop}
      onDragOver={event => { const target = resolveDrop(event); if (target) { event.preventDefault(); setDrop(target) } }}
      onDrop={event => { const target = resolveDrop(event); if (target) { event.preventDefault(); commitDrop(target) } }}>{t('root')}</div>}
    {props.query && currentContent.status === 'loading' && <div className={css.searchState} role="status"><Spinner /><span>{t('contentLoading')}</span></div>}
    {props.query && currentContent.status === 'error' && <div className={css.warning} role="status">{t('contentFailed')} <button className={css.textButton} onClick={() => { setRetry(value => value + 1) }}>{t('retry')}</button></div>}
    {search.hasMore && <div className={css.searchState} role="status">{t('more', { n: props.resultLimit })}</div>}
  </div>
}

function FolderRow(props: TreeProps & { node: TreeNode; tree: ClassifierTree; state: ClassifierState; expanded: boolean; disabled: boolean; toggle: () => void; dragStart: () => void; dragEnd: () => void; draggable: boolean }) {
  const [open, setOpen] = useState(false)
  const { node, state, t } = props
  const folder = state.folders.find(item => item.id === node.ref.id)!
  const fullPath = [...ancestorsOf(state, props.tree.catalog, node.ref, props.tree.lookup).reverse().map(ref => props.tree.nodes.get(entityKey(ref))?.label ?? ref.id), node.label].join(' / ')
  return <div className={css.folderRow} role="treeitem" aria-expanded={props.expanded} aria-level={node.depth + 1} tabIndex={0}
    onClick={props.toggle} onKeyDown={event => {
      if (event.target !== event.currentTarget || !['Enter', ' ', 'ArrowRight', 'ArrowLeft'].includes(event.key)) return
      event.preventDefault()
      if (event.key === 'Enter' || event.key === ' ' || (event.key === 'ArrowRight' && !props.expanded) || (event.key === 'ArrowLeft' && props.expanded)) props.toggle()
    }}
    draggable={props.draggable} onDragStart={event => { event.dataTransfer.setData('text/plain', entityKey(node.ref)); event.dataTransfer.effectAllowed = 'move'; props.dragStart() }} onDragEnd={props.dragEnd}>
    <span className={css.folderGlyph}>{props.expanded ? <IconFolderOpenRegular size={16} /> : <IconFolderCloseRegular size={16} />}</span>
    <span className={css.folderChevron} style={{ transform: props.expanded ? 'rotate(90deg)' : undefined }}><IconTriangleRightFillRegular size={12} /></span>
    <span className={css.folderText}><HoverCard anchor={<span className={css.folderLabel}>{node.label}</span>} content={<span>{fullPath}</span>} /></span>
    <span className={css.folderTags}><TagBadges {...props} target={node.ref} /></span>
    <Menu open={open} onClose={() => { setOpen(false) }} portal align="end" dense
      anchor={<button type="button" className={css.more} aria-label={t('folderActions', { name: node.label })} onClick={event => { event.stopPropagation(); setOpen(!open) }}>···</button>}
      items={[
        { id: 'create', label: t('newInside'), disabled: props.disabled }, { id: 'rename', label: t('rename'), disabled: props.disabled },
        { id: 'move', label: t('move'), disabled: props.disabled }, { id: 'tags', label: t('tags'), disabled: props.disabled },
        { type: 'separator', id: 'separator' }, { id: 'delete', label: t('delete'), danger: true, disabled: props.disabled },
      ]} onSelect={id => {
        setOpen(false)
        if (id === 'create') props.edit({ kind: 'folder.create', scope: folder.scope, parentId: folder.id, revision: state.revision })
        else if (id === 'rename' || id === 'delete') props.edit({ kind: id === 'rename' ? 'folder.rename' : 'folder.delete', id: folder.id, revision: state.revision })
        else props.edit({ kind: id === 'move' ? 'move' : 'tags', targets: [node.ref], revision: state.revision })
      }} />
  </div>
}
