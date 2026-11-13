import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertPublicFiles, sourceFiles } from '../scripts/package-files.mjs'

const parent = resolve('.dev/package-tests')
const cases: string[] = []
afterEach(async () => {
  for (const path of cases.splice(0)) {
    if (dirname(resolve(path)) !== parent) throw new Error('Refusing to clean a path outside the package test workspace')
    await rm(path, { recursive: true, force: true })
  }
})

describe('release file boundaries', () => {
  it('selects source files without .git, respects nested ignores, and retains the lockfile and test configs', async () => {
    await mkdir(parent, { recursive: true })
    const root = await mkdtemp(join(parent, 'case-')); cases.push(root)
    const files: Record<string, string> = {
      '.gitignore': '.dev/\nlib/\nnode_modules/\n.env\n.env.*\n!.env.example\n.npmrc\n*.log\n',
      'package.json': '{}', 'pnpm-lock.yaml': 'lockfileVersion: 9',
      'tsconfig.tests-host.json': '{}', 'tsconfig.tests-client.json': '{}',
      'src/index.ts': 'export {}', 'src/.env.example': 'EXAMPLE=placeholder',
      'scripts/build.mjs': '', 'tests/example.spec.ts': '', 'docs/guide.md': '',
      'docs/.gitignore': 'local-note.txt\n', 'docs/local-note.txt': 'synthetic local note',
      'docs/.env.local': 'SYNTHETIC_SECRET=do-not-publish', 'scripts/.npmrc': 'synthetic', 'tests/secret.log': 'synthetic',
      'lib/client.js': '', '.dev/profile/config.json': '{}', 'node_modules/example/index.js': '',
    }
    for (const [path, content] of Object.entries(files)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), content) }
    await expect(access(join(root, '.git'))).rejects.toThrow()
    const selected = await sourceFiles(root)
    expect(selected).toEqual(expect.arrayContaining(['pnpm-lock.yaml', 'tsconfig.tests-host.json', 'tsconfig.tests-client.json', 'src/index.ts', 'src/.env.example', 'scripts/build.mjs', 'tests/example.spec.ts']))
    for (const forbidden of ['docs/.env.local', 'scripts/.npmrc', 'tests/secret.log', 'docs/local-note.txt', 'lib/client.js', '.dev/profile/config.json', 'node_modules/example/index.js']) expect(selected).not.toContain(forbidden)
  })

  it.each(['docs/.env.local', 'src/.env.production', 'scripts/.npmrc', 'tests/private.log', 'docs/.ENV.local', 'scripts/.NPMRC', 'tests/PRIVATE.LOG', '.dev/profile/config.json', 'src/WORK_LOG.md', 'lib/cache.tsbuildinfo', '../private.txt', 'D:/private.txt'])('rejects %s in either archive', path => {
    expect(() => assertPublicFiles([path])).toThrow('Private file')
  })

  it('allows npm runtime output and an explicit environment example', () => {
    expect(() => assertPublicFiles(['lib/client.js', 'lib/client.js.map', 'lib/types/index.d.ts', 'src/.env.example', 'CHANGELOG.md'])).not.toThrow()
  })
})
