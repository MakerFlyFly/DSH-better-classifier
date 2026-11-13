import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { publishArchive } from '../scripts/publish-target.mjs'

const root = resolve(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const parseSpec = createRequire(import.meta.url)('npm-package-arg') as (spec: string, where: string) => { type: string; fetchSpec: string }
function check(type: string, name: string) {
  return spawnSync(process.execPath, ['scripts/check-publish-ref.mjs'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_REF_TYPE: type, GITHUB_REF_NAME: name }, windowsHide: true,
  })
}
describe('immutable publish ref', () => {
  it('passes a local tarball to npm instead of a hosted Git shorthand', () => {
    const target = publishArchive('dsh-better-classifier', version)
    expect(parseSpec(`dist/${target.filename}`, root).type).toBe('git')
    expect(parseSpec(target.spec, root)).toMatchObject({ type: 'file', fetchSpec: resolve(root, 'dist', target.filename) })
    expect(target.tag).toBe('latest')
    expect(publishArchive('dsh-better-classifier', version + '-rc.1').tag).toBe('next')
  })
  it('refuses unsafe package identities before composing a publication command', () => {
    for (const [name, release] of [['bad;command', version], ['../outside', version], ['dsh-better-classifier', '1.0.0;command']]) {
      expect(() => publishArchive(name, release)).toThrow('Unexpected package')
    }
  })
  it('accepts exactly the version tag', () => { expect(check('tag', `v${version}`).status).toBe(0) })
  it('rejects branches, missing refs and another version', () => {
    for (const [type, name] of [['branch', 'main'], ['', ''], ['tag', 'v999.0.0']]) expect(check(type!, name!).status).not.toBe(0)
  })
})
