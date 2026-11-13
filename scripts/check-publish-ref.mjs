/** A real CI publish must build the immutable tag matching the package version. */
import { readFile } from 'node:fs/promises'
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
if (process.env.GITHUB_REF_TYPE !== 'tag' || process.env.GITHUB_REF_NAME !== `v${version}`) {
  throw new Error(`Real publishing requires the v${version} tag`)
}
console.log('Release tag matches package version')
