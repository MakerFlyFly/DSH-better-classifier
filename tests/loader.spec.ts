/** Real CLI + profile + Loader + JSON storage + SQLite query integration. */
import { mkdir, mkdtemp, readFile, writeFile, access, realpath } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { expect, it } from 'vitest'

it('boots the actual installed bundle and retains its metadata across a Host restart', async () => {
  const root = resolve(import.meta.dirname, '..')
  const { name, version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const require = createRequire(import.meta.url)
  const dsh = root
  await mkdir(join(root, '.dev/loader-tests'), { recursive: true })
  const temp = await mkdtemp(join(root, '.dev/loader-tests/case-'))
  const env = { ...process.env, DSH_HOME: join(temp, 'home'), DSH_TELEMETRY_DISABLED: '1' }
  const launcher = [join(dirname(require.resolve('@deepseek-ai/dsh/package.json')), 'lib/bin.js')]
  function cli(args: string[]): void {
    const child = spawnSync(process.execPath, [...launcher, ...args], { cwd: dsh, env, encoding: 'utf8', timeout: 60_000, windowsHide: true })
    if (child.status !== 0) throw new Error((child.stdout + child.stderr).replace(/token=\S+/g, 'token=[redacted]'))
  }
  cli(['--profile', 'web', '--dump-config'])
  const archive = process.env.BETTER_CLASSIFIER_TEST_TARBALL ?? join(root, `dist/${name}-${version}.tgz`)
  const packageSpec = process.env.BETTER_CLASSIFIER_TEST_INSTALL_SPEC ?? archive
  cli(['plugin', '--profile', 'web', 'add', packageSpec])
  const installed = await realpath(join(env.DSH_HOME, 'profiles/web/node_modules/dsh-better-classifier'))
  expect(installed).not.toBe(await realpath(root))
  // External CI artifacts need not be byte-identical to a local rebuild (paths/CSS export order).
  // Verify installation against the archive itself, including for registry-based installation.
  const packedClient = spawnSync('tar', ['-xOf', archive, 'package/lib/client.js'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true })
  expect(packedClient.status, packedClient.stderr).toBe(0)
  expect(await readFile(join(installed, 'lib/client.js'), 'utf8')).toBe(packedClient.stdout)
  const report = join(temp, 'report.json')
  const overlay = join(temp, 'fixture.patch.yml')
  await writeFile(overlay, JSON.stringify([
    { id: 'workspace-controller', config: { documentsDirectory: join(temp, 'projects') } },
    { insert: [{ id: 'classifier-fixture', name: join(root, 'tests/fixtures/seed.ts'), config: { root: join(temp, 'projects'), report, verify: true } }] },
  ]))
  const portOwner = createServer(); portOwner.listen(0, '127.0.0.1'); await once(portOwner, 'listening')
  const address = portOwner.address(); if (!address || typeof address === 'string') throw new Error('Missing test port')
  const port = address.port; await new Promise<void>((resolve, reject) => { portOwner.close(error => error ? reject(error) : resolve()) })
  for (let pass = 0; pass < 2; pass++) {
    const reportPath = pass === 0 ? report : join(temp, 'restart-report.json')
    if (pass) {
      const metadata = join(env.DSH_HOME, 'storages/better_classifier.json')
      const before = await readFile(metadata)
      cli(['plugin', '--profile', 'web', 'remove', 'dsh-better-classifier'])
      expect((JSON.parse(await readFile(join(env.DSH_HOME, 'profiles/web/package.json'), 'utf8')).dependencies ?? {})['dsh-better-classifier']).toBeUndefined()
      expect(await readFile(metadata)).toEqual(before)
      cli(['plugin', '--profile', 'web', 'add', packageSpec])
      const rows = JSON.parse(await readFile(overlay, 'utf8'))
      rows[1].insert[0].config.report = reportPath
      await writeFile(overlay, JSON.stringify(rows))
    }
    const child = spawn(process.execPath, [...launcher, '--profile', 'web', '--patch', overlay, '--no-open', '--port', String(port)], { cwd: dsh, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let log = ''
    child.stdout.on('data', chunk => { log += String(chunk) }); child.stderr.on('data', chunk => { log += String(chunk) })
    const exited = once(child, 'exit')
    try {
      const deadline = Date.now() + 60_000
      while (true) {
        try { await access(reportPath); break } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
        if (child.exitCode !== null || Date.now() > deadline) throw new Error('Fixture did not finish: ' + log.replace(/token=\S+/g, 'token=[redacted]'))
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const result = JSON.parse(await readFile(reportPath, 'utf8'))
      expect(result, result.error).toMatchObject({ ok: true })
      expect(result.checks).toContain('atomic compare-and-swap admits exactly one concurrent writer')
      expect(result.checks).toContain('real SQLite body index respects candidate filtering')
      if (pass) expect(result.checks).toContain('restart retained folders, placements and tag color')
    } finally {
      if (child.exitCode === null) child.kill('SIGTERM')
      await exited
      await writeFile(join(temp, 'host-' + pass + '.log'), log.replace(/token=\S+/g, 'token=[redacted]'))
    }
  }
}, 150_000)
