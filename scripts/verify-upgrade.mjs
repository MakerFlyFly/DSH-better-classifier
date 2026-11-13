/** Boot a copy of an existing metadata file on stock DSH, without copying or changing its original profile. */
import { readFile, writeFile, mkdir, mkdtemp, copyFile } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { spawnSync, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { isolateFixture } from './fixture-module.mjs'
const root = resolve(import.meta.dirname, '..')
const { name, version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-upgrade.mjs <metadata.json>')
const input = resolve(process.argv[2])
const original = await readFile(input)
const hash = createHash('sha256').update(original).digest('hex')
const require = createRequire(import.meta.url)
const cli = join(dirname(require.resolve('@deepseek-ai/dsh/package.json')), 'lib/bin.js')
await mkdir(join(root, '.dev/upgrade-tests'), { recursive: true })
const temp = await mkdtemp(join(root, '.dev/upgrade-tests/case-'))
const home = join(temp, 'home')
const env = { ...process.env, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' }
function run(args) {
  const child = spawnSync(process.execPath, [cli, ...args], { cwd: root, env, encoding: 'utf8', windowsHide: true })
  if (child.status !== 0) throw new Error((child.stdout + child.stderr).replace(/token=\S+/g, 'token=[redacted]'))
}
run(['--profile', 'web', '--dump-config'])
run(['plugin', '--profile', 'web', 'add', join(root, `dist/${name}-${version}.tgz`)])
await mkdir(join(home, 'storages'), { recursive: true })
const file = join(home, 'storages/better_classifier.json')
await copyFile(input, file)
const report = join(temp, 'report.json')
const overlay = join(temp, 'probe.patch.yml')
await writeFile(overlay, JSON.stringify([{ id: 'workspace-controller', config: { documentsDirectory: join(temp, 'projects') } },
  { insert: [{ id: 'classifier-upgrade-probe', name: await isolateFixture(join(root, 'tests/fixtures/upgrade.ts'), join(temp, 'fixture-module')), config: { file, report, hash } }] }]))
const reservation = createServer().listen(0, '127.0.0.1'); await once(reservation, 'listening')
const port = reservation.address().port
await new Promise(resolve => reservation.close(resolve))
const child = spawn(process.execPath, [cli, '--profile', 'web', '--patch', overlay, '--no-open', '--port', String(port)], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
const stopped = once(child, 'exit')
let log = ''; child.stdout.on('data', data => { log += data }); child.stderr.on('data', data => { log += data })
try {
  const deadline = Date.now() + 60_000
  let result
  while (!result) {
    try { result = JSON.parse(await readFile(report, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (result) break
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(log.replace(/token=\S+/g, 'token=[redacted]'))
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!original.equals(await readFile(input))) throw new Error('Original metadata changed')
  console.log(JSON.stringify(result, null, 2))
} finally {
  if (child.exitCode === null) child.kill('SIGTERM')
  await stopped
}
