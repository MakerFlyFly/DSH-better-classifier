import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { RemoteAccessService } from '@deepseek-ai/dsh-api-remote-access'
import { TYPERT } from 'dsh-better-classifier/typert'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface PrincipalMap { classifierReviewRestricted: { kind: 'classifierReviewRestricted' } }
}

describe('stock authorization and generated Remote input boundary', () => {
  it('rejects ungranted classification actions for a restricted principal and allows the owner', async () => {
    const ctx = new Context()
    ctx.provide('typert', {} as never)
    try {
      await ctx.plugin(RemoteAccessService)
      for (const method of ['snapshot', 'follow', 'apply', 'searchContent'] as const) {
        const action = `betterClassifier/${method}` as const
        expect(ctx.remoteAccess.decide({ principal: { kind: 'classifierReviewRestricted' }, action, resources: [{ kind: 'global' }] }))
          .toEqual({ kind: 'deny', reason: 'no-allow' })
        expect(ctx.remoteAccess.decide({ principal: { kind: 'owner' }, action, resources: [{ kind: 'global' }] })).toEqual({ kind: 'allow' })
      }
    } finally { await ctx.fiber.dispose() }
  })

  it('ships a strict search codec that rejects malformed requests before service dispatch', () => {
    const metadata = TYPERT as { invocations: readonly InvocationDescriptor[] }
    const descriptor = metadata.invocations.find(item => item.namespace === 'betterClassifier' && item.method === 'searchContent')!
    const codec = descriptor.parameters[0]!.codec
    expect(codec.mode).toBe('strict')
    if (codec.mode !== 'strict') throw new Error('Missing generated strict codec')
    for (const malformed of [{ query: 'q', sessionIds: 's' }, { query: 42, sessionIds: [] }, { query: 'q', sessionIds: [42] }]) {
      expect(() => codec.create().parse(malformed)).toThrow()
    }
    expect(codec.create().parse({ query: 'q', sessionIds: ['s'] })).toEqual({ query: 'q', sessionIds: ['s'] })
  })
})
