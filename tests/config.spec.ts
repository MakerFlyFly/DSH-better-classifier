import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = createRequire(import.meta.url)
const dsh = createRequire(here.resolve('@deepseek-ai/dsh/package.json'))
const boot = createRequire(dsh.resolve('@deepseek-ai/dsh-app-boot/package.json'))
const { loadOverlayPatches } = await import(pathToFileURL(dsh.resolve('@deepseek-ai/dsh-app-boot')).href)
const { applyEntryPatches } = await import(pathToFileURL(boot.resolve('@deepseek-ai/cordis-plugin-include')).href)
const base = [{ id: 'session-query-sqlite', name: '@deepseek-ai/dsh-session-query-sqlite', config: { path: ':memory:', openAt: 'never' } }]
const plugin = loadOverlayPatches('dsh', resolve('cordis.patch.yml'))

describe('stock bundle and user configuration layers', () => {
  it('uses the real bundle to enable the derived index on first search', () => {
    expect(applyEntryPatches(base, plugin)[0].config).toEqual({ path: { __jsExpr: "dshHomePath('storages', 'better_classifier_search.sqlite')" }, openAt: 'first-search' })
  })
  it.each([{ path: 'user.sqlite', openAt: 'never' }, { path: ':memory:', openAt: 'first-search' }])('preserves later user configuration %j', config => {
    expect(applyEntryPatches(base, [...plugin, { id: 'session-query-sqlite', config }])[0].config).toEqual(config)
  })
  it('restores remaining layers when the plugin bundle is absent', () => {
    const custom = { id: 'session-query-sqlite', config: { path: 'custom.sqlite', openAt: 'never' } }
    expect(applyEntryPatches(base, [custom])[0].config).toEqual(custom.config)
    expect(applyEntryPatches(base, [])[0].config).toEqual(base[0]!.config)
  })
})
