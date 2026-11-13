/** Host entry: durable classification service exposed through the DSH Remote gateway. */
import { Service, type Context } from '@deepseek-ai/cordis'
import { defineDomain, domainTable, type Domain } from '@deepseek-ai/dsh-storage-domain'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-api-remote-access'
import { searchContent } from './host/search.ts'
import type { ContentSearchRequest, ContentSearchResult } from './types.ts'
import { emptyState, reduceMutation } from './domain/model.ts'
import { mutationSchema, stateSchema } from './domain/schema.ts'
import type { ClassifierFrame, ClassifierState, EntityCatalog, MutationRequest, MutationResult } from './types.ts'

export type * from './types.ts'

const domainSpec = defineDomain({ name: 'better_classifier', version: 1, tables: { state: domainTable(stateSchema) } })
type ClassifierDomain = Domain<typeof domainSpec>

/** Abort a rejected table update before it reaches durable storage. */
class RejectedMutation extends Error {
  constructor(readonly result: Extract<MutationResult, { ok: false }>) { super('Classification mutation rejected') }
}

declare module '@deepseek-ai/cordis' {
  interface Context { betterClassifier: BetterClassifier }
}

/** Host-owned classification state; metadata does not enter Session logs or prompts. */
export default class BetterClassifier extends TypertRemoteService {
  static inject = ['storageDomain', 'typert', 'workspaceRegistry', 'sessionQuery', 'remoteAccess']
  private domain: ClassifierDomain | undefined
  private readonly lifetime = new AbortController()

  /** @param ctx - Host context containing storage and identity authorities. */
  constructor(ctx: Context) {
    super(ctx, 'betterClassifier', { namespace: 'betterClassifier' })
  }

  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(domainSpec)
    try {
      if (!domain.table('state').get('root')) await domain.table('state').put('root', emptyState())
      this.domain = domain
    } catch (error) { await domain.close(); throw error }
    this.ctx.effect(() => async () => {
      this.lifetime.abort()
      await domain.close()
    }, 'better-classifier: storage lifetime')
  }

  private storage(): ClassifierDomain {
    if (this.domain === undefined) throw new Error('BetterClassifier storage is not initialized')
    return this.domain
  }

  /** @returns a detached committed snapshot, including its conflict-detection revision. */
  @Remote('snapshot')
  async snapshot(): Promise<ClassifierState> {
    const domain = this.storage()
    return structuredClone(domain.table('state').get('root')!)
  }

  /** Search authorized candidate sessions through the stock Host index. */
  @Remote('searchContent')
  async searchContent(request: ContentSearchRequest, signal: AbortSignal): Promise<ContentSearchResult> {
    return searchContent(this.ctx, request, AbortSignal.any([signal, this.lifetime.signal]))
  }

  /**
   * Commit a complete user intent atomically. A business rejection does not write or notify.
   * @param request - expected revision and commands to commit together.
   * @returns the committed state, or a business refusal with the current revision.
   */
  @Remote('apply')
  async apply(request: MutationRequest): Promise<MutationResult> {
    const domain = this.storage()
    const parsed = mutationSchema.safeParse(request)
    if (!parsed.success) return { ok: false, code: 'invalid-request', revision: domain.table('state').get('root')!.revision }
    const sessions = await this.ctx.sessionQuery.listSessions()
    const catalog: EntityCatalog = {
      projects: this.ctx.workspaceRegistry.list().map(project => ({ id: project.id, sessionIds: [...project.sessionIds] })),
      sessionIds: sessions.map(session => session.header.id),
    }
    try {
      const state = await domain.table('state').update('root', current => {
        const result = reduceMutation(current, parsed.data, catalog)
        if (!result.ok) throw new RejectedMutation(result)
        return stateSchema.parse(result.state)
      })
      return { ok: true, state: structuredClone(state) }
    } catch (error) {
      if (error instanceof RejectedMutation) return error.result
      throw error
    }
  }

  /**
   * Follow complete committed snapshots, coalescing intermediate updates for slow consumers.
   * @param signal - cancellation of this follow generation.
   * @returns the baseline and subsequent committed snapshots.
   */
  @Remote({ name: 'follow', mode: 'stream' })
  async *follow(signal: AbortSignal): AsyncIterable<ClassifierFrame> {
    const domain = this.storage()
    const lifetime = AbortSignal.any([signal, this.lifetime.signal])
    lifetime.throwIfAborted()
    let dirty = true
    let wake: (() => void) | undefined
    const notify = (): void => { dirty = true; wake?.() }
    const off = this.ctx.on('domain/changed', change => {
      if (change.domain === domainSpec.name && change.table === 'state') notify()
    })
    lifetime.addEventListener('abort', notify)
    try {
      while (!lifetime.aborted) {
        if (dirty) {
          dirty = false
          yield { type: 'snapshot', state: structuredClone(domain.table('state').get('root')!) }
        } else {
          await new Promise<void>(resolve => { wake = resolve; if (dirty || lifetime.aborted) resolve() })
          wake = undefined
        }
      }
    } finally { off(); lifetime.removeEventListener('abort', notify) }
  }
}
