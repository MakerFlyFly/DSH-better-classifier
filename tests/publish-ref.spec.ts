import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
function check(type: string, name: string) {
  return spawnSync(process.execPath, ['scripts/check-publish-ref.mjs'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_REF_TYPE: type, GITHUB_REF_NAME: name }, windowsHide: true,
  })
}
describe('immutable publish ref', () => {
  it('accepts exactly the version tag', () => { expect(check('tag', `v${version}`).status).toBe(0) })
  it('rejects branches, missing refs and another version', () => {
    for (const [type, name] of [['branch', 'main'], ['', ''], ['tag', 'v999.0.0']]) expect(check(type!, name!).status).not.toBe(0)
  })
})
