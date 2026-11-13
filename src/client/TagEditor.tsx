/** Tag association, selection and definition pages share one uncommitted editor draft. */
import { useCallback, useMemo, useRef, useState } from 'react'
import { Button, HoverCard, IconCloseOutlineRegular, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ClassifierCommand, ClassifierState, Tag } from '../types.ts'
import { entityKey } from '../domain/model.ts'
import type { EditorProps } from './contract.ts'
import type { Editor } from './controller.ts'
import type { ClassifierKey } from './locales.ts'
import { tagColors } from './tag-colors.ts'
import { createTagDraft, stageTagDraft, tagDraftCommands } from './tag-draft.ts'
import css from './classifier.module.css'

const COLORS = ['#4D6BFE', '#0E7490', '#0F766E', '#15803D', '#A16207', '#C2410C', '#B91C1C', '#BE185D', '#7E22CE', '#475569']
type TagEditor = Extract<Exclude<Editor, null>, { kind: 'tags' }>
type Page = { kind: 'assigned' } | { kind: 'definition'; key: string }
interface Fields { id: string; name: string; color: string; creating: boolean }

/** @param props - existing Slot bindings and the immutable opening revision. */
export function TagEditorDialog(props: EditorProps & { editor: TagEditor; state: ClassifierState }) {
  const { t, editor } = props
  const interaction = props.useInteraction(value => value)
  const phase = props.useClassifier(value => value.phase)
  const adapterReady = props.useAdapter(value => value.phase === 'ready')
  const projects = props.useWorkspaces(value => value.items)
  const sessionIds = props.useSessions(value => value.ids)
  const catalog = useMemo(() => ({ projects: projects.map(project => ({ id: project.workspaceId, sessionIds: [...project.sessionIds] })), sessionIds: [...sessionIds] }), [projects, sessionIds])
  const targets = editor.targets
  const [draft, setDraft] = useState(() => createTagDraft(props.state))
  const [page, setPage] = useState<Page>({ kind: 'assigned' })
  const [fields, setFields] = useState<Record<string, Fields>>({})
  const [error, setError] = useState<ClassifierKey | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const pageFocus = useCallback((element: HTMLDivElement | null) => { element?.focus({ preventScroll: true }) }, [])
  const form = page.kind === 'definition' ? fields[page.key]! : null
  const commands = tagDraftCommands(draft, targets)
  const rootPage = page.kind === 'assigned'
  const blocked = interaction.busy || interaction.notice === 'conflict' || phase !== 'ready' || !adapterReady
  const validColor = form !== null && /^#[\da-fA-F]{6}$/.test(form.color)
  const validForm = form !== null && form.name.trim().length > 0 && validColor
  const state = draft.state

  const navigate = (next: Page): void => { setError(null); setPage(next) }
  const stage = (changes: ClassifierCommand[]): boolean => {
    const result = stageTagDraft(draft, changes, catalog, targets)
    if (!result.ok) { setError(result.code); return false }
    setDraft(result.draft); setError(null); return true
  }
  const define = (tag: Tag | null): void => {
    const key = tag?.id ?? '$new'
    setFields(current => ({ ...current, [key]: current[key] ?? { id: tag?.id ?? crypto.randomUUID(), name: tag?.name ?? '', color: tag?.color ?? COLORS[0]!, creating: tag === null } }))
    navigate({ kind: 'definition', key })
  }
  const editField = (change: Partial<Pick<Fields, 'name' | 'color'>>): void => {
    if (page.kind !== 'definition') return
    setFields(current => ({ ...current, [page.key]: { ...current[page.key]!, ...change } })); setError(null)
  }
  const finishDefinition = (): void => {
    if (page.kind !== 'definition' || !form || !validForm || interaction.busy) return
    const existing = draft.state.tags.find(tag => tag.id === form.id)
    if (!form.creating && existing && form.name.trim() === existing.name && form.color.toUpperCase() === existing.color.toUpperCase()) {
      navigate({ kind: 'assigned' }); return
    }
    const changes: ClassifierCommand[] = [{ kind: form.creating ? 'tag.create' : 'tag.update', id: form.id, name: form.name, color: form.color }]
    if (form.creating && targets.length) changes.push({ kind: 'tags.assign', targets, add: [form.id], remove: [] })
    if (!stage(changes)) return
    setFields(current => { const next = { ...current }; delete next[page.key]; return next })
    navigate({ kind: 'assigned' })
  }
  const save = (): void => { if (!blocked && commands.length) void props.mutate(commands, editor.revision) }
  const closePage = (): void => {
    if (interaction.busy) return
    if (rootPage) props.closeEditor()
    else navigate({ kind: 'assigned' })
  }
  const nextChip = (button: HTMLButtonElement): HTMLButtonElement | null => {
    const chip = button.closest('[data-editor-tag]')
    return chip?.nextElementSibling?.querySelector<HTMLButtonElement>('[data-tag-action]')
      ?? chip?.previousElementSibling?.querySelector<HTMLButtonElement>('[data-tag-action]') ?? addButton.current
  }
  const remove = (id: string, button: HTMLButtonElement): void => {
    const next = nextChip(button)
    if (stage([{ kind: 'tags.assign', targets, add: [], remove: [id] }])) next?.focus({ preventScroll: true })
  }
  const assignedIds = [...new Set(targets.flatMap(target => state.assignments.find(item => entityKey(item.target) === entityKey(target))?.tagIds ?? []))]
  const shown = assignedIds.map(id => state.tags.find(tag => tag.id === id)!)
  const assignedSet = new Set(assignedIds)
  const available = state.tags.filter(tag => !assignedSet.has(tag.id))
  const title = page.kind === 'assigned' ? t('tags') : form?.creating ? t('addTag') : t('editTag')

  return <Modal open title={title} closeLabel={rootPage ? t('close') : t('back')} onClose={closePage} className={`${css.editor} ${css.tagEditor}`} contentClassName={css.tagEditorContent}
    footer={<div className={css.footer}>
      <Button variant="ghost" disabled={interaction.busy} onClick={closePage}>{rootPage ? t('cancel') : t('back')}</Button>
      {rootPage && <Button variant="primary" disabled={blocked || commands.length === 0} onClick={save}>{interaction.busy ? t('saving') : t('save')}</Button>}
      {page.kind === 'definition' && <Button variant="primary" disabled={interaction.busy || !validForm} onClick={finishDefinition}>{t('done')}</Button>}
    </div>}>
    <div key={page.kind + (form?.id ?? '')} ref={pageFocus} tabIndex={-1} className={css.tagPage}>
      {page.kind === 'assigned' && <>
        <div className={`${css.tagScroll} ${css.tagAssignedScroll}`}>
          <div className={css.tagPills} role="group" aria-label={t('assignedTags')}>
            {shown.map(tag => <TagPill key={tag.id} tag={tag} disabled={interaction.busy}
              label={t('editNamedTag', { name: tag.name })}
              onClick={() => { define(tag) }}
              removeLabel={t('removeTag', { name: tag.name })} onRemove={button => { remove(tag.id, button) }} />)}
          </div>
          {shown.length === 0 && <div className={css.tagEmpty}>{t('noAssignedTags')}</div>}
        </div>
        {page.kind === 'assigned' && <div className={css.tagAvailableSection}>
          <span className={css.tagSectionLabel}>{t('availableTags')}</span>
          <div className={`${css.tagScroll} ${css.tagAvailableScroll}`}>
            <div className={css.tagPills} role="group" aria-label={t('availableTags')}>
              {available.map(tag => <TagPill key={tag.id} tag={tag} disabled={interaction.busy}
                label={t('addNamedTag', { name: tag.name })} onClick={button => {
                  const next = nextChip(button)
                  if (stage([{ kind: 'tags.assign', targets, add: [tag.id], remove: [] }])) next?.focus({ preventScroll: true })
                }} />)}
            </div>
            {available.length === 0 && <div className={css.tagEmpty}>{t('noAvailableTags')}</div>}
          </div>
        </div>}
        <Button ref={addButton} variant="outline" className={css.tagAddButton} disabled={interaction.busy}
          onClick={() => { define(null) }}>
          {t('addTags')}
        </Button>
      </>}
      {page.kind === 'definition' && form && <form className={css.form} onSubmit={event => { event.preventDefault(); finishDefinition() }}>
        <label className={css.field}><span>{t('tagName')}</span><Input value={form.name} maxLength={120} disabled={interaction.busy}
          onChange={event => { editField({ name: event.target.value }) }} /></label>
        <label className={css.field}><span>{t('color')}</span><div className={css.colorEditor}>
          <input type="color" aria-label={t('color')} value={validColor ? form.color : COLORS[0]} disabled={interaction.busy}
            onChange={event => { editField({ color: event.target.value }) }} />
          <Input className={css.hexInput} aria-label={t('hex')} value={form.color} maxLength={7} disabled={interaction.busy}
            onChange={event => { editField({ color: event.target.value }) }} />
          {validColor && <HoverCard anchor={<span className={css.previewTag} style={tagColors(form.color)}>{form.name || t('tagName')}</span>} content={<span>{form.name || t('tagName')}</span>} />}
        </div></label>
        <div role="group" aria-label={t('presets')} className={css.palette}>{COLORS.map(color => <button key={color} type="button" aria-label={color}
          aria-pressed={form.color.toUpperCase() === color} style={{ backgroundColor: color }} disabled={interaction.busy} onClick={() => { editField({ color }) }} />)}</div>
        {!validColor && <div className={css.error} role="alert">{t('invalid-color')}</div>}
        <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
      </form>}
      {error && <div className={css.error} role="alert">{t(error)}</div>}
      {interaction.notice && interaction.notice !== 'saved' && <div className={css.error} role="alert">{t(interaction.notice)}</div>}
      {phase !== 'ready' && <div className={css.error} role="status">{t(phase === 'offline' ? 'offline' : 'loadFailed')}
        <Button size="sm" variant="ghost" onClick={() => { props.notice(null); void props.refresh() }}>{t('retry')}</Button>
      </div>}
    </div>
  </Modal>
}

function TagPill({ tag, label, disabled, onClick, removeLabel, onRemove }: {
  tag: Tag; label: string; disabled: boolean; onClick: (button: HTMLButtonElement) => void
  removeLabel?: string; onRemove?: (button: HTMLButtonElement) => void
}) {
  return <span className={css.tagPill} data-editor-tag={tag.id}>
    <HoverCard inline anchor={<button type="button" className={css.tagPillBody} data-tag-action aria-label={label} disabled={disabled} onClick={event => { onClick(event.currentTarget) }}>
      <span className={css.colorDot} style={{ backgroundColor: tag.color }} /><span className={css.tagPillName}>{tag.name}</span>
    </button>} content={<span>{tag.name}</span>} />
    {onRemove && removeLabel && <span className={css.tagRemoveAnchor}>
      <button type="button" className={css.tagRemove} aria-label={removeLabel} disabled={disabled}
        onClick={event => { event.stopPropagation(); onRemove(event.currentTarget) }}><IconCloseOutlineRegular size={12} /></button>
    </span>}
  </span>
}
