/** Pack the root bundle and a source archive without local profiles or build caches. */
import { mkdir, readFile, writeFile, readdir, copyFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { zipSync } from 'fflate'
const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const { name, version } = manifest
const dist = join(root, 'dist')
await mkdir(dist, { recursive: true })
const result = spawnSync('npm pack --json --ignore-scripts --pack-destination dist', { cwd: root, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true })
if (result.status !== 0) process.exit(result.status ?? 1)
const [packed] = JSON.parse(result.stdout)
const tarball = `${name}-${version}.tgz`
if (packed.filename !== tarball) throw new Error('Unexpected archive name')
for (const file of packed.files) {
  if (/(^|\/)(\.dev|\.build|node_modules|\.git|WORK_LOG\.md|\.env|\.npmrc)(\/|$)|\.tsbuildinfo$/.test(file.path)) throw new Error('Private file in archive: ' + file.path)
}
const sources = {}
async function include(path) { sources[path] = new Uint8Array(await readFile(join(root, path))) }
async function directory(path) {
  for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
    const next = path + '/' + entry.name
    if (entry.isDirectory()) await directory(next)
    else if (entry.isFile()) await include(next)
  }
}
for (const path of ['src', 'scripts', 'tests', 'locale', 'detail', 'docs', '.github']) await directory(path)
for (const path of ['README.md', 'README_ZH.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'icon.svg', 'screenshots.json', 'package.json', 'pnpm-lock.yaml', 'compatibility.json', 'cordis.patch.yml', '.gitignore', '.gitattributes',
  'tsconfig.json', 'tsconfig.base.json', 'tsconfig.host.json', 'tsconfig.client.json', 'vitest.config.ts']) await include(path)
const sourceZip = `DSH-better-classifier-${version}-source.zip`
const compatibilityFile = `compatibility-${version}.json`
const validationFile = `VALIDATION-${version}.md`
await writeFile(join(dist, sourceZip), zipSync(sources, { level: 6 }))
const compatibility = JSON.parse(await readFile(join(root, 'compatibility.json'), 'utf8'))
await writeFile(join(dist, compatibilityFile), JSON.stringify({ ...compatibility, pluginVersion: version }, null, 2) + '\n')
await copyFile(join(root, 'docs/validation.md'), join(dist, validationFile))
const files = [tarball, sourceZip, compatibilityFile, validationFile]
const checksums = await Promise.all(files.map(async file => createHash('sha256').update(await readFile(join(dist, file))).digest('hex') + '  ' + file))
const checksumFile = `SHA256SUMS-${version}.txt`
await writeFile(join(dist, checksumFile), checksums.join('\n') + '\n')
await writeFile(join(dist, 'release-manifest.json'), JSON.stringify({ name, version, tag: `v${version}`, files: [...files, checksumFile] }, null, 2) + '\n')
console.log(`Packed ${name}@${version}: ${packed.entryCount} files, ${packed.size} bytes`)
