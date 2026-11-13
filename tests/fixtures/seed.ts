/** Test-only real-profile driver: uses real storage and Session APIs without submitting a model request. */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-session-title'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from 'dsh-better-classifier'
import type { ClassifierCommand } from '../../src/types.ts'

export const name = 'better-classifier-fixture'
export const inject = ['betterClassifier', 'workspaceRegistry', 'sessions', 'sessionTitle', 'sessionController', 'sessionPersistence']

export async function apply(ctx: Context, config: { root: string; report: string; verify?: boolean }): Promise<void> {
  const checks: string[] = []
  try {
    const initial = await ctx.betterClassifier.snapshot()
    const projects = []
    for (const [directory, title] of [['dsh-project', 'DSH 插件开发'], ['design-project', '产品设计']]) {
      const path = join(config.root, directory!)
      await mkdir(path, { recursive: true })
      projects.push(await ctx.workspaceRegistry.create(path, title))
    }
    const sessionIds: string[] = []
    const seedFile = join(config.root, 'classifier-fixture-v2.json')
    let seeded: string[] | undefined
    try { seeded = JSON.parse(await readFile(seedFile, 'utf8')).sessionIds }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    if (seeded === undefined) {
      for (const [projectIndex, title, text] of [
        [0, '搜索优化', '测试正文关键字：蓝鲸检索。讨论文件夹搜索和筛选。'],
        [0, '拖拽与标签', '验证分类移动后，工作目录保持原样。'],
        [1, '界面评审', '浅色、深色主题和长标签的视觉检查。'],
      ] as const) {
        const created = await ctx.sessionController.create({ workspaceId: projects[projectIndex]!.id })
        const session = ctx.sessions.get(created.sessionId)
        assert.ok(session)
        session.append('turn/start', { turn: 1 })
        session.append('user/message', createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }), { surfaceOp: 'append' })
        session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
        ctx.sessionTitle.rename(session, title)
        sessionIds.push(created.sessionId)
      }
      await ctx.sessionPersistence.flush()
      await writeFile(seedFile, JSON.stringify({ sessionIds }))
    } else sessionIds.push(...seeded)
    const primarySessionId = initial.placements.find(item => item.folderId === 'qa-inner' && item.target.kind === 'session')?.target.id ?? sessionIds[0]!
    checks.push('real Workspace and Session creation without LLM calls')
    if (config.verify) {
      const mutate = async (commands: ClassifierCommand[]) => {
        const before = await ctx.betterClassifier.snapshot()
        const result = await ctx.betterClassifier.apply({ expectedRevision: before.revision, commands })
        if (!result.ok) throw new Error(result.code)
        return result.state
      }
      if (!initial.folders.some(folder => folder.id === 'qa-outer')) {
        await mutate([
          { kind: 'folder.create', id: 'qa-outer', name: '工作', scope: { kind: 'global' }, parentId: null },
          { kind: 'folder.create', id: 'qa-inner', name: '插件', scope: { kind: 'project', projectId: projects[0]!.id }, parentId: null },
          { kind: 'entities.move', targets: [{ kind: 'project', id: projects[0]!.id }], destination: { kind: 'folder', id: 'qa-outer' } },
          { kind: 'entities.move', targets: [{ kind: 'session', id: primarySessionId }], destination: { kind: 'folder', id: 'qa-inner' } },
          { kind: 'tag.create', id: 'qa-tag', name: '重点', color: '#E34A72' },
          { kind: 'tags.assign', targets: [{ kind: 'folder', id: 'qa-outer' }], add: ['qa-tag'], remove: [] },
        ])
      } else checks.push('restart retained folders, placements and tag color')
      const first = await ctx.betterClassifier.snapshot()
      assert.equal(first.tags.find(tag => tag.id === 'qa-tag')?.color, '#E34A72')
      const cancellation = new AbortController()
      const stream = ctx.betterClassifier.follow(cancellation.signal)[Symbol.asyncIterator]()
      const baseline = await stream.next()
      assert.equal(baseline.value.state.revision, first.revision)
      const requests = ['任务一', '任务二'].map(name => ctx.betterClassifier.apply({ expectedRevision: first.revision, commands: [{ kind: 'folder.rename', id: 'qa-inner', name }] }))
      const concurrent = await Promise.all(requests)
      assert.equal(concurrent.filter(result => result.ok).length, 1)
      assert.equal(concurrent.filter(result => !result.ok && result.code === 'conflict').length, 1)
      const changed = await stream.next()
      assert.equal(changed.value.state.revision, first.revision + 1)
      cancellation.abort()
      await stream.return?.()
      checks.push('atomic compare-and-swap admits exactly one concurrent writer')
      checks.push('follow emits baseline and committed update and closes on cancellation')
      const beforeRejection = await ctx.betterClassifier.snapshot()
      const rejected = await ctx.betterClassifier.apply({ expectedRevision: beforeRejection.revision, commands: [
        { kind: 'folder.rename', id: 'qa-inner', name: '不应提交' },
        { kind: 'entities.move', targets: [{ kind: 'session', id: primarySessionId }], destination: { kind: 'project', id: projects[1]!.id } },
      ] })
      assert.equal(rejected.ok, false)
      assert.deepEqual(await ctx.betterClassifier.snapshot(), beforeRejection)
      checks.push('failed batch leaves durable state and revision unchanged')
      await mutate([{ kind: 'folder.rename', id: 'qa-inner', name: '插件' }])
      const found = await ctx.betterClassifier.searchContent({ query: '蓝鲸检索', sessionIds: [primarySessionId] }, new AbortController().signal)
      assert.equal(found.items[0]?.sessionId, primarySessionId)
      checks.push('real SQLite body index respects candidate filtering')
    }
    await ctx.sessionPersistence.flush()
    await writeFile(config.report, JSON.stringify({ ok: true, checks, projects: projects.map(project => ({ id: project.id, title: project.title })), sessionIds, revision: (await ctx.betterClassifier.snapshot()).revision }, null, 2))
  } catch (error) {
    await writeFile(config.report, JSON.stringify({ ok: false, checks, error: String(error), stack: error instanceof Error ? error.stack : undefined }, null, 2))
    throw error
  }
}
