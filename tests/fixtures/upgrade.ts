/** Read-only upgrade probe: unloaded object identities must survive activation untouched. */
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type {} from 'dsh-better-classifier'
export const inject = ['betterClassifier']
export async function apply(ctx: Context, config: { file: string; report: string; hash: string }): Promise<void> {
  const snapshot = await ctx.betterClassifier.snapshot()
  const hash = createHash('sha256').update(await readFile(config.file)).digest('hex')
  if (hash !== config.hash) throw new Error('Classification file changed during upgrade')
  await writeFile(config.report, JSON.stringify({ ok: true, hash, revision: snapshot.revision,
    folders: snapshot.folders.length, tags: snapshot.tags.length, assignments: snapshot.assignments.length,
    placements: snapshot.placements.length, orders: snapshot.orders.length }, null, 2))
}
