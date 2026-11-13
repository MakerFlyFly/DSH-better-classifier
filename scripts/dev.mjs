/** Launch the published, unmodified DSH CLI with an isolated review profile. */
import { existsSync } from 'node:fs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { spawn, spawnSync } from 'node:child_process'
import { isolateFixture } from './fixture-module.mjs'
const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..')
const dshRoot = dirname(require.resolve('@deepseek-ai/dsh/package.json'))
const dsh = join(dshRoot, 'lib/bin.js')
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const review = join(root, `.dev/review-${version}`)
const home = join(review, 'home')
const env = { ...process.env, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' }
await mkdir(home, { recursive: true })
function cli(args) {
  const run = spawnSync(process.execPath, [dsh, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true })
  if (run.status !== 0) process.exit(run.status ?? 1)
}
if (!existsSync(join(home, 'profiles/web/package.json'))) cli(['--profile', 'web', '--dump-config'])
if (!process.argv.includes('--installed')) cli(['plugin', '--profile', 'web', 'add', join(root, `dist/dsh-better-classifier-${version}.tgz`)])
if (process.argv.includes('--install-only')) process.exit(0)
const projects = join(review, 'projects')
const overlay = join(review, 'review.patch.yml')
const rows = [{ id: 'workspace-controller', config: { documentsDirectory: projects } }]
if (process.argv.includes('--fixture')) rows.push({ insert: [{ id: 'classifier-fixture', name: await isolateFixture(join(root, 'tests/fixtures/seed.ts'), join(review, 'fixture-module')), config: { root: projects, report: join(review, 'fixture-report.json'), verify: true } }] })
await writeFile(overlay, JSON.stringify(rows))
const port = process.argv.find(arg => arg.startsWith('--port='))?.slice(7) ?? '3085'
const child = spawn(process.execPath, [dsh, '--profile', 'web', '--patch', overlay, '--no-open', '--port', port], { cwd: root, env, stdio: 'inherit', windowsHide: true })
child.on('exit', code => { process.exitCode = code ?? 1 })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(signal) })
