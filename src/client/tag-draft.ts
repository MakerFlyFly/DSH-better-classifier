/** Unsaved tag edits with one final assignment command for the selected objects. */
import type { ClassifierCommand, ClassifierState, EntityCatalog, EntityRef } from '../types.ts'
import { reduceMutation } from '../domain/model.ts'

/** Definitions preserve operation order, including dependent renames; associations are coalesced. */
export interface TagDraft {
  state: ClassifierState
  definitions: ClassifierCommand[]
  add: string[]
  remove: string[]
}

/** @param state - immutable snapshot captured when the editor opens. @returns an unmodified local draft. */
export function createTagDraft(state: ClassifierState): TagDraft {
  return { state, definitions: [], add: [], remove: [] }
}

/** @returns ordered definitions followed by the final, atomic assignment changes. */
export function tagDraftCommands(draft: TagDraft, targets: EntityRef[]): ClassifierCommand[] {
  return [...draft.definitions, ...(draft.add.length || draft.remove.length ? [{ kind: 'tags.assign' as const, targets, add: draft.add, remove: draft.remove }] : [])]
}

/** Validate locally through the same reducer as the Host; rejected edits leave the draft intact. */
export function stageTagDraft(draft: TagDraft, commands: ClassifierCommand[], catalog: EntityCatalog, targets: EntityRef[]) {
  const result = reduceMutation(draft.state, { expectedRevision: draft.state.revision, commands }, catalog)
  if (!result.ok) return result
  const next: TagDraft = { state: result.state, definitions: [...draft.definitions], add: [...draft.add], remove: [...draft.remove] }
  for (const command of commands) {
    if (command.kind === 'tags.assign') {
      next.add = [...new Set([...next.add.filter(id => !command.remove.includes(id)), ...command.add])]
      // A removed then re-added tag must move to the end just as it did in the local draft.
      next.remove = [...new Set([...next.remove, ...command.remove])]
    } else next.definitions.push(command)
  }
  const retained = new Set(next.state.tags.map(tag => tag.id))
  next.add = next.add.filter(id => retained.has(id))
  next.remove = next.remove.filter(id => retained.has(id))
  if (tagDraftCommands(next, targets).length > 100) return { ok: false as const, code: 'tooManyChanges' as const }
  return { ok: true as const, draft: next }
}
