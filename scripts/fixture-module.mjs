/** Keep test-only Host modules outside the installable package's Client discovery boundary. */
import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

export async function isolateFixture(source, directory) {
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'better-classifier-test-fixture', private: true, type: 'module' }) + '\n')
  const target = join(directory, basename(source))
  await copyFile(source, target)
  return target
}
