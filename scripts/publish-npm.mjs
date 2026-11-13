/** Publish only the archive and checksums produced by the verified build. */
import './check-publish-ref.mjs'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { publishArchive } from './publish-target.mjs'
const { name, version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const { filename, spec, tag } = publishArchive(name, version)
const checksum = createHash('sha256').update(await readFile(spec)).digest('hex')
const sums = await readFile(`dist/SHA256SUMS-${version}.txt`, 'utf8')
if (!sums.split('\n').includes(`${checksum}  ${filename}`)) throw new Error('Archive checksum differs from the verified build')
const result = spawnSync(`npm publish ${spec} --ignore-scripts --access public --provenance --tag ${tag}`, { shell: true, stdio: 'inherit', windowsHide: true })
process.exitCode = result.status ?? 1
