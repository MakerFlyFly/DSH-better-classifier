/** Compact badges for tags directly assigned to the row's object. */
import { HoverCard } from '@deepseek-ai/dsh-client-ui-primitives'
import { useCallback, useId } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import type { EntityRef, Tag } from '../types.ts'
import { entityKey } from '../domain/model.ts'
import type { ClassifierSharedProps, ProjectTagsProps, SessionTagsProps } from './contract.ts'
import css from './classifier.module.css'
import { tagColors } from './tag-colors.ts'

/** Render the same direct-tag treatment for folders, projects and sessions. */
export function TagBadges({ target, ...props }: ClassifierSharedProps & { target: EntityRef }) {
  const data = props.useClassifier(value => value)
  if (data.state === null) return null
  const state = data.state
  const ids = state.assignments.find(item => entityKey(item.target) === entityKey(target))?.tagIds ?? []
  const tags = ids.flatMap(id => { const tag = state.tags.find(item => item.id === id); return tag ? [tag] : [] })
  if (!tags.length) return null
  const open = (): void => { props.edit({ kind: 'tags', targets: [target], revision: state.revision }) }
  return <FittedTags {...props} tags={tags} open={open} />
}

function FittedTags(props: ClassifierSharedProps & { tags: Tag[]; open: () => void }) {
  const { tags, open, measureTags } = props
  const key = useId()
  const layout = props.useTagLayout(value => value[key])
  // Text changes can redistribute individual widths without changing the group's total width.
  const signature = JSON.stringify(tags.map(tag => [tag.id, tag.name]))
  const ref = useCallback((element: HTMLSpanElement | null) => { measureTags(key, element) }, [key, measureTags, signature])
  const count = Math.min(tags.length, layout?.count ?? 0)
  const counters = Array.from({ length: String(tags.length).length }, (_, index) => 10 ** index)
  const activate = (event: MouseEvent<HTMLButtonElement>): void => { event.stopPropagation(); open() }
  return <span ref={ref} className={css.badges} style={{ '--classifier-tag-minimum': layout ? `${layout.minimum}px` : undefined } as CSSProperties}>
    <span className={css.badgeMeasurements} aria-hidden="true">
      {tags.map(tag => <span key={tag.id} className={css.badge} data-tag-measure>{tag.name}</span>)}
      {counters.map(value => <span key={value} className={css.moreBadge} data-tag-counter>+{value}</span>)}
    </span>
    {tags.slice(0, count).map((tag, index) => <HoverCard key={tag.id}
      anchor={<button type="button" className={css.badge} data-tag-index={index}
        style={tagColors(tag.color)} onClick={activate} aria-label={props.t('tags') + ': ' + tag.name}>{tag.name}</button>}
      content={<span>{tag.name}</span>} />)}
    {tags.length > count && <HoverCard anchor={<button type="button" className={css.moreBadge} data-tag-overflow onClick={activate} aria-label={props.t('tagDetails')}>+{tags.length - count}</button>}
      content={<span>{tags.map(tag => tag.name).join(' · ')}</span>} />}
  </span>
}
/** Slot occupant of the native Session row. */
export function SessionTags(props: SessionTagsProps) { return <TagBadges {...props} target={{ kind: 'session', id: props.sessionId }} /> }
/** Slot occupant of the native Workspace row. */
export function ProjectTags(props: ProjectTagsProps) { return <TagBadges {...props} target={{ kind: 'project', id: props.workspaceId }} /> }
