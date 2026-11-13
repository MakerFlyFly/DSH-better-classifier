/** Browser plugin: native sidebar extension, Remote state, and locale-owned interaction. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-context-menu/client'
import remote from 'dsh-better-classifier/remote'
import { ClassifierController, type Editor } from './controller.ts'
import { createClassifierViewStore } from './state.ts'
import { ClassifierTreeView } from './Tree.tsx'
import { ClassifierEditors } from './Editors.tsx'
import { ProjectTags, SessionTags } from './Tags.tsx'
import { TagLayoutOwner } from './tag-layout.ts'
import { BackgroundMenuOwner } from './background-menu.ts'
import { zh, en } from './locales.ts'
import type { ClassifierInjected } from './contract.ts'
import type { EntityRef } from '../types.ts'
import { installStockBrowser } from './compat/install.ts'

/** Native UI and Remote services required by this plugin. */
export const inject = ['slots', 'locale', 'remote', 'sessions', 'workspaces', 'contextMenus']

/** @param ctx - browser-side plugin context. */
export async function apply(ctx: Context): Promise<void> {
  await ctx.remote.$mount(remote)
  ctx.inject(['remote.betterClassifier'], install)
}

function install(ctx: Context): void {
  const adapter = installStockBrowser(ctx)
  const controller = new ClassifierController(ctx)
  const reportAdapter = (): void => {
    if (adapter.getSnapshot().phase === 'fallback') controller.notice('adapterUnavailable')
    else if (controller.interaction.getSnapshot().notice === 'adapterUnavailable') controller.notice(null)
  }
  ctx.effect(() => adapter.subscribe(reportAdapter), 'better-classifier: adapter availability')
  reportAdapter()
  const tagLayout = new TagLayoutOwner()
  ctx.effect(() => () => { tagLayout.dispose() }, 'better-classifier: tag measurement lifetime')
  const view = createClassifierViewStore()
  ctx.effect(() => ctx.locale.register('betterClassifier', { zh, en }), 'better-classifier: dictionaries')
  const t = ctx.locale.bind('betterClassifier')
  const background = new BackgroundMenuOwner(ctx, controller, t)
  const edit = (editor: Exclude<Editor, null>): void => {
    if (adapter.getSnapshot().phase !== 'ready') { controller.notice('adapterUnavailable'); return }
    if (controller.interaction.getSnapshot().busy) return
    controller.edit(editor)
  }
  const injectProps = (): ClassifierInjected => ({
    hooks: { classifier: controller.data, interaction: controller.interaction, adapter, tagLayout: tagLayout.values },
    measureTags: tagLayout.attach,
    edit, closeEditor: () => { controller.closeEditor() },
    notice: code => { controller.notice(code) }, refresh: () => controller.refresh(),
    mutate: (commands, revision) => {
      if (adapter.getSnapshot().phase !== 'ready') { controller.notice('adapterUnavailable'); return Promise.resolve(false) }
      return controller.mutate(commands, revision)
    },
    bindBackground: background.bind, folderCreated: background.created,
    drag: targets => { controller.drag(targets) },
    searchContent: async (query, signal, ids) => {
      const result = await ctx.remote.betterClassifier.searchContent({ query, sessionIds: [...ids] }, signal)
      if (!result.ok) throw result.error
      return result.value
    },
  })
  ctx.slots.inject('betterClassifier.tree', () => ctx.slots.register({ name: 'betterClassifier.tree', store: view, locale: 'betterClassifier', inject: injectProps }, ClassifierTreeView))
  ctx.slots.inject('betterClassifier.session.row.tags', () => ctx.slots.register({ name: 'betterClassifier.session.row.tags', id: 'better-classifier', store: view, locale: 'betterClassifier', inject: injectProps }, SessionTags))
  ctx.slots.inject('betterClassifier.workspace.row.tags', () => ctx.slots.register({ name: 'betterClassifier.workspace.row.tags', id: 'better-classifier', store: view, locale: 'betterClassifier', inject: injectProps }, ProjectTags))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'better-classifier', store: view, locale: 'betterClassifier', inject: injectProps }, ClassifierEditors))
  const items = (target: EntityRef) => {
    const data = controller.data.getSnapshot()
    if (adapter.getSnapshot().phase !== 'ready' || data.phase !== 'ready' || data.state === null) return []
    const revision = data.state.revision
    const movable = target.kind !== 'session' || ctx.workspaces.list.getSnapshot().items.some(project => project.sessionIds.includes(target.id as never))
    return [
      ...movable ? [{ id: 'move', label: t('move'), run: () => { edit({ kind: 'move' as const, targets: [target], revision }) } }] : [],
      { id: 'tags', label: t('tags'), run: () => { edit({ kind: 'tags', targets: [target], revision }) } },
    ]
  }
  ctx.effect(() => ctx.contextMenus.register({ id: 'better-classifier.session', target: 'session', order: 350,
    observe: () => [adapter, controller.data],
    resolve: target => items({ kind: 'session', id: target.sessionId }),
  }), 'better-classifier: Session menu')
  ctx.effect(() => ctx.contextMenus.register({ id: 'better-classifier.project', target: 'workspace', order: 200,
    observe: () => [adapter, controller.data],
    resolve: target => {
      const data = controller.data.getSnapshot()
      if (adapter.getSnapshot().phase !== 'ready' || data.phase !== 'ready' || data.state === null) return []
      const revision = data.state.revision
      return [
        { id: 'new-folder', label: t('newInside'), run: () => { edit({ kind: 'folder.create', scope: { kind: 'project', projectId: target.workspaceId }, parentId: null, revision }) } },
        ...items({ kind: 'project', id: target.workspaceId }),
      ]
    },
  }), 'better-classifier: Workspace menu')
}
