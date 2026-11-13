/** Build both plugin faces against pinned published DSH packages. */
import { readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { build } from 'tsdown'
import { generateRemote } from './remote-generator.mjs'
import { clientBundle } from './client-bundle.mjs'
const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
function tsc(config) {
  const result = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', config, '--pretty', 'false'], { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
tsc('tsconfig.host.json')
await generateRemote(root)
await build({ config: false, entry: { index: 'lib/types/index.js', types: 'lib/types/types.js' }, outDir: 'lib', format: 'esm', platform: 'node', dts: false, clean: false,
  deps: { neverBundle: id => id.startsWith('@deepseek-ai/') || id === 'zod' }, fixedExtension: false })
if (process.argv.includes('--host-only')) process.exit(0)
tsc('tsconfig.client.json')
await build(clientBundle(root, manifest.name))
console.log('BetterClassifier built against stock DSH ' + manifest.engines.dsh)
