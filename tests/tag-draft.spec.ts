import { describe, expect, it } from 'vitest'
import { tagColors } from '../src/client/tag-colors.ts'
import { createTagDraft, stageTagDraft, tagDraftCommands } from '../src/client/tag-draft.ts'
import { emptyState, reduceMutation } from '../src/domain/model.ts'

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(value => Number.parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4))
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!
}

describe('tag display contrast', () => {
  it('uses white for the reported blue and dark palette, black for light fills, and preserves exact readable fills', () => {
    expect(tagColors('#4D6BFE').color).toBe('#FFFFFF')
    expect(tagColors('#4D6BFE').backgroundColor).not.toBe('#4D6BFE')
    expect(tagColors('#7E22CE')).toEqual({ backgroundColor: '#7E22CE', color: '#FFFFFF' })
    expect(tagColors('#475569')).toEqual({ backgroundColor: '#475569', color: '#FFFFFF' })
    expect(tagColors('#FACC15')).toEqual({ backgroundColor: '#FACC15', color: '#000000' })
  })
  it('keeps contrast at least 4.5 across a sampled RGB space and the blue threshold regression', () => {
    const colors = ['#4D6BFE']
    for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
      colors.push('#' + [r, g, b].map(value => value.toString(16).padStart(2, '0')).join(''))
    }
    for (const color of colors) {
      const result = tagColors(color)
      const levels = [luminance(result.backgroundColor), luminance(result.color)].sort((a, b) => b - a)
      expect((levels[0]! + .05) / (levels[1]! + .05), color).toBeGreaterThanOrEqual(4.5)
    }
  })
})

it('coalesces more than 100 association gestures and commits the same draft in one transaction', () => {
  const initial = emptyState()
  initial.tags = Array.from({ length: 130 }, (_, i) => ({ id: String(i), name: `tag ${i}`, color: '#4D6BFE' }))
  const catalog = { projects: [], sessionIds: ['s'] }
  const targets = [{ kind: 'session' as const, id: 's' }]
  let draft = createTagDraft(initial)
  for (const tag of initial.tags) {
    const result = stageTagDraft(draft, [{ kind: 'tags.assign', targets, add: [tag.id], remove: [] }], catalog, targets)
    expect(result.ok).toBe(true)
    if (result.ok) draft = result.draft
  }
  const commands = tagDraftCommands(draft, targets)
  expect(commands).toHaveLength(1)
  expect(initial.assignments).toEqual([])
  const committed = reduceMutation(initial, { expectedRevision: 0, commands }, catalog)
  expect(committed.ok).toBe(true)
  if (committed.ok) expect(committed.state.assignments).toEqual(draft.state.assignments)
})

it('preserves the displayed order when an assigned tag is removed and re-added', () => {
  const initial = emptyState()
  initial.tags = [{ id: 'a', name: 'A', color: '#4D6BFE' }, { id: 'b', name: 'B', color: '#123456' }]
  const targets = [{ kind: 'session' as const, id: 's' }]
  initial.assignments = [{ target: targets[0]!, tagIds: ['a', 'b'] }]
  const catalog = { projects: [], sessionIds: ['s'] }
  let draft = createTagDraft(initial)
  for (const change of [{ add: [], remove: ['a'] }, { add: ['a'], remove: [] }]) {
    const result = stageTagDraft(draft, [{ kind: 'tags.assign', targets, ...change }], catalog, targets)
    if (!result.ok) throw new Error(result.code)
    draft = result.draft
  }
  expect(draft.state.assignments[0]!.tagIds).toEqual(['b', 'a'])
  const commands = tagDraftCommands(draft, targets)
  expect(commands).toHaveLength(1)
  const committed = reduceMutation(initial, { expectedRevision: 0, commands }, catalog)
  if (!committed.ok) throw new Error(committed.code)
  expect(committed.state.assignments).toEqual(draft.state.assignments)
})
