/** Source selection works in a checkout or in an extracted archive with no Git repository. */
import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import walk from 'ignore-walk'

const sourceDirectories = new Set(['src', 'scripts', 'tests', 'locale', 'detail', 'docs', '.github'])
const sourceRootFiles = new Set(['README.md', 'README_ZH.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'icon.svg', 'screenshots.json',
  'package.json', 'pnpm-lock.yaml', 'compatibility.json', 'cordis.patch.yml', '.gitignore', '.gitattributes',
  'tsconfig.json', 'tsconfig.base.json', 'tsconfig.host.json', 'tsconfig.client.json', 'tsconfig.tests-host.json', 'tsconfig.tests-client.json', 'vitest.config.ts'])

/** Shared final boundary for both the npm archive and the source ZIP. */
export function assertPublicFiles(paths) {
  for (const path of paths) {
    const normalized = path.replaceAll('\\', '/')
    const segments = normalized.split('/')
    if (normalized.startsWith('/') || /^[a-z]:/i.test(normalized) || segments.includes('..') || segments.some(raw => {
      const part = raw.toLowerCase()
      return ['.dev', '.build', '.git', 'node_modules', 'coverage', 'work_log.md', '.npmrc', '.env'].includes(part)
      || (part.startsWith('.env.') && part !== '.env.example') || /\.(?:log|tsbuildinfo)$/i.test(part)
    })) {
      throw new Error('Private file in archive: ' + path)
    }
  }
}

/** Respect root and nested ignore rules without applying them to required npm build output. */
export async function sourceFiles(root) {
  const candidates = await walk({ path: root, ignoreFiles: ['.gitignore'], follow: false })
  const selected = []
  for (const candidate of candidates) {
    const path = candidate.replaceAll('\\', '/')
    if (!sourceRootFiles.has(path) && !sourceDirectories.has(path.split('/')[0])) continue
    if (!(await lstat(join(root, path))).isFile()) continue
    selected.push(path)
  }
  selected.sort()
  assertPublicFiles(selected)
  return selected
}
