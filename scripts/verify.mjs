/** Use the invoking package manager so one command follows the supported verification order. */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
const runner = process.env.npm_execpath
if (!runner) throw new Error('Run this script with pnpm verify')
const scripted = /\.[cm]?js$/i.test(runner)
for (const script of ['build', 'typecheck', 'package', 'test']) {
  const result = spawnSync(scripted ? process.execPath : runner, [...(scripted ? [runner] : []), 'run', script], {
    cwd: resolve(import.meta.dirname, '..'), env: process.env, stdio: 'inherit', windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
