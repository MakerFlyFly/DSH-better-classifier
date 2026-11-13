/** Publish only the archive and checksums produced by the verified build. */
import './check-publish-ref.mjs'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
const { name, version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
if (!/^[a-z0-9-]+$/.test(name) || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Unexpected package name or version')
const filename = `${name}-${version}.tgz`
const checksum = createHash('sha256').update(await readFile(`dist/${filename}`)).digest('hex')
const sums = await readFile(`dist/SHA256SUMS-${version}.txt`, 'utf8')
if (!sums.split('\n').includes(`${checksum}  ${filename}`)) throw new Error('Archive checksum differs from the verified build')
const tag = version.includes('-') ? 'next' : 'latest'
const result = spawnSync(`npm publish dist/${filename} --ignore-scripts --access public --provenance --tag ${tag}`, { shell: true, stdio: 'inherit', windowsHide: true })
process.exitCode = result.status ?? 1
