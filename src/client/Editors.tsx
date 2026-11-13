/** Frame-wide editors remain mounted independently from row menus. */
import { useMemo, useState } from 'react'
import { Button, Input, Menu, Modal, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ClassifierCommand, ClassifierState, ContainerRef, EntityRef } from '../types.ts'
import { ancestorsOf, entityKey, reduceMutation } from '../domain/model.ts'
import type { EditorProps } from './contract.ts'
import type { Editor } from './controller.ts'
import { TagEditorDialog } from './TagEditor.tsx'
import css from './classifier.module.css'

/** Root overlay owns both mutation errors and dialogs. */
export function ClassifierEditors(props: EditorProps) {
  const data = props.useClassifier(value => value)
  const interaction = props.useInteraction(value => value)
  const editor = interaction.editor
  const state = data.state
  return <>
    {interaction.notice && editor === null && <Toast key={interaction.noticeSeq} text={props.t(interaction.notice)}
      tone={interaction.notice === 'saved' ? 'success' : undefined} holdMs={interaction.notice === 'saved' ? 3000 : 6000}
      onDone={() => { props.notice(null) }} />}
    {editor && state && (editor.kind === 'tags'
      ? <TagEditorDialog key={JSON.stringify(editor)} {...props} editor={editor} state={state} />
      : <FolderEditorDialog key={JSON.stringify(editor)} {...props} editor={editor} state={state} />)}
  </>
}

function FolderEditorDialog(props: EditorProps & { editor: Exclude<Editor, null | { kind: 'tags' }>; state: ClassifierState }) {
  const { editor, state, t } = props
  const interaction = props.useInteraction(value => value)
  const projects = props.useWorkspaces(value => value.items)
  const phase = props.useClassifier(value => value.phase)
  const adapterReady = props.useAdapter(value => value.phase === 'ready')
  const sessions = props.useSessions(value => value)
  const folder = 'id' in editor ? state.folders.find(item => item.id === editor.id) : undefined
  const [name, setName] = useState(folder?.name ?? '')
  const [destination, setDestination] = useState<ContainerRef | null>(null)
  const [destinationOpen, setDestinationOpen] = useState(false)
  const catalog = useMemo(() => ({ projects: projects.map(project => ({ id: project.workspaceId, sessionIds: [...project.sessionIds] })), sessionIds: [...sessions.ids] }), [projects, sessions.ids])
  const targets = editor.kind === 'move' ? editor.targets : []
  const label = (ref: EntityRef): string => ref.kind === 'folder' ? state.folders.find(item => item.id === ref.id)?.name ?? ref.id
    : ref.kind === 'project' ? projects.find(item => item.workspaceId === ref.id)?.title ?? ref.id
      : sessions.byId[ref.id as keyof typeof sessions.byId]?.displayTitle ?? ref.id
  const choices: { container: ContainerRef; label: string }[] = [
    { container: { kind: 'root' as const }, label: t('root') },
    ...projects.map(project => ({ container: { kind: 'project' as const, id: project.workspaceId }, label: project.title + ' / ' + t('projectRoot') })),
    ...state.folders.map(item => ({ container: { kind: 'folder' as const, id: item.id }, label: folderPath(item.id, state, projects.map(project => ({ id: project.workspaceId, title: project.title }))) })),
  ].filter(choice => editor.kind !== 'move' || reduceMutation(state, { expectedRevision: state.revision, commands: [{ kind: 'entities.move', targets, destination: choice.container }] }, catalog).ok)
  const title = editor.kind === 'folder.create' ? t('newFolder') : editor.kind === 'folder.rename' ? t('rename') : editor.kind === 'folder.delete' ? t('delete') : t('move')
  const invalid = (editor.kind === 'folder.create' || editor.kind === 'folder.rename') && (!name.trim() || (editor.kind === 'folder.rename' && name.trim() === folder?.name))
  const blocked = interaction.busy || phase !== 'ready' || !adapterReady
  const conflict = interaction.notice === 'conflict'
  const submit = (): void => {
    let commands: ClassifierCommand[]
    if (editor.kind === 'folder.create') commands = [{ kind: 'folder.create', id: crypto.randomUUID(), name, scope: editor.scope, parentId: editor.parentId }]
    else if (editor.kind === 'folder.rename') commands = [{ kind: 'folder.rename', id: editor.id, name }]
    else if (editor.kind === 'folder.delete') commands = [{ kind: 'folder.delete', id: editor.id }]
    else { if (!destination) return; commands = [{ kind: 'entities.move', targets, destination }] }
    void props.mutate(commands, editor.revision).then(ok => {
      if (!ok) return
      if (editor.kind === 'folder.create') {
        const creation = commands.find(command => command.kind === 'folder.create')!
        if (editor.background !== undefined) props.folderCreated(editor.background, creation.id)
        const parent: EntityRef | null = editor.parentId !== null ? { kind: 'folder', id: editor.parentId }
          : editor.scope.kind === 'project' ? { kind: 'project', id: editor.scope.projectId } : null
        if (parent) props.actions.reveal([entityKey(parent), ...ancestorsOf(state, catalog, parent).map(entityKey)])
      }
      if (editor.kind === 'move' && destination && destination.kind !== 'root') {
        const parent: EntityRef = { kind: destination.kind, id: destination.id }
        props.actions.reveal([entityKey(parent), ...ancestorsOf(state, catalog, parent).map(entityKey)])
      }
    })
  }
  return <Modal open title={title} description={editor.kind === 'folder.delete' ? t('deleteDescription') : undefined} closeLabel={t('close')} onClose={props.closeEditor}
    className={css.editor} tone={editor.kind === 'folder.delete' ? 'warning' : undefined}
    footer={<div className={css.footer}><Button variant="ghost" disabled={interaction.busy} onClick={props.closeEditor}>{t('cancel')}</Button>
      <Button variant="primary" disabled={blocked || invalid || conflict || (editor.kind === 'move' && !destination)} onClick={submit}>{interaction.busy ? t('saving') : editor.kind === 'folder.delete' ? t('confirm') : t('save')}</Button></div>}>
    <form onSubmit={event => { event.preventDefault(); if (!invalid && !blocked && !conflict) submit() }} className={css.form}>
      {(editor.kind === 'folder.create' || editor.kind === 'folder.rename') && <label className={css.field}><span>{t('folderName')}</span>
        <Input value={name} onChange={event => { setName(event.target.value) }} maxLength={120} data-modal-autofocus disabled={interaction.busy} />
      </label>}
      {editor.kind === 'move' && <>
        <div>{targets.map(label).join('、')}</div>
        <Menu open={destinationOpen} onClose={() => { setDestinationOpen(false) }} portal
          anchor={<button type="button" className={css.destination} onClick={() => { setDestinationOpen(!destinationOpen) }} disabled={interaction.busy || !choices.length}>{destination ? choices.find(choice => JSON.stringify(choice.container) === JSON.stringify(destination))?.label : t('chooseTarget')}</button>}
          items={choices.map((choice, index) => ({ id: String(index), label: choice.label }))}
          onSelect={id => { setDestination(choices[Number(id)]!.container); setDestinationOpen(false) }} />
        {!choices.length && <div className={css.error}>{t('noTargets')}</div>}
      </>}
      {editor.kind === 'folder.delete' && <div className={css.deletionName}>{folder?.name ?? editor.id}</div>}
      {interaction.notice && interaction.notice !== 'saved' && <div className={css.error} role="alert">{t(interaction.notice)}</div>}
      {phase !== 'ready' && <div className={css.error} role="status">{t(phase === 'offline' ? 'offline' : 'loadFailed')}
        <Button size="sm" variant="ghost" disabled={interaction.busy} onClick={() => { props.notice(null); void props.refresh() }}>{t('retry')}</Button>
      </div>}
    </form>
  </Modal>
}

function folderPath(id: string, state: ClassifierState, projects: { id: string; title: string }[]): string {
  const parts: string[] = []
  const seen = new Set<string>()
  let current = state.folders.find(folder => folder.id === id)
  while (current && !seen.has(current.id)) {
    seen.add(current.id); parts.unshift(current.name)
    if (current.parentId !== null) current = state.folders.find(folder => folder.id === current!.parentId)
    else { if (current.scope.kind === 'project') { const projectId = current.scope.projectId; parts.unshift(projects.find(project => project.id === projectId)?.title ?? projectId) }; break }
  }
  return parts.join(' / ')
}
