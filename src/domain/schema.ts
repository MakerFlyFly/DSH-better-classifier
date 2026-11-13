/** Validation at the durable and wire input boundaries. */
import { z } from 'zod'
import type { ClassifierState, MutationRequest } from '../types.ts'

const id = z.string().min(1).max(256)
const entity = z.object({ kind: z.enum(['folder', 'project', 'session']), id })
const scope = z.discriminatedUnion('kind', [z.object({ kind: z.literal('global') }), z.object({ kind: z.literal('project'), projectId: id })])
const container = z.discriminatedUnion('kind', [z.object({ kind: z.literal('root') }), z.object({ kind: z.literal('project'), id }), z.object({ kind: z.literal('folder'), id })])
const name = z.string().min(1).max(120)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)

/** The durable record format, independent from Session log versions. */
export const stateSchema: z.ZodType<ClassifierState> = z.object({
  revision: z.number().int().nonnegative(),
  folders: z.array(z.object({ id, name, scope, parentId: id.nullable() })),
  tags: z.array(z.object({ id, name, color })),
  assignments: z.array(z.object({ target: entity, tagIds: z.array(id) })),
  placements: z.array(z.object({ target: entity, folderId: id })),
  orders: z.array(z.object({ container, entities: z.array(entity) })),
})

/** Parse requests without altering existing stored state. */
export const mutationSchema: z.ZodType<MutationRequest> = z.object({
  expectedRevision: z.number().int().nonnegative(),
  commands: z.array(z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('folder.create'), id, name: z.string(), scope, parentId: id.nullable() }),
    z.object({ kind: z.literal('folder.rename'), id, name: z.string() }),
    z.object({ kind: z.literal('folder.delete'), id }),
    z.object({ kind: z.literal('entities.move'), targets: z.array(entity).min(1), destination: container, before: entity.optional(), visibleOrder: z.array(entity).optional() }),
    z.object({ kind: z.literal('tag.create'), id, name: z.string(), color: z.string() }),
    z.object({ kind: z.literal('tag.update'), id, name: z.string(), color: z.string() }),
    z.object({ kind: z.literal('tag.delete'), id }),
    z.object({ kind: z.literal('tags.assign'), targets: z.array(entity).min(1), add: z.array(id), remove: z.array(id) }),
  ])).min(1).max(100),
})
