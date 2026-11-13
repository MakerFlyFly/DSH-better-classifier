/** Build-only compatibility for the pinned generator's external protocol symbol discovery. */
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
export async function generateRemote(root) {
  const original = await readFile(require.resolve('@deepseek-ai/dsh-typert-generator'), 'utf8')
  const marker = '\tisTypeMetaSymbol(node, name) {\n\t\tconst symbol = this.checker.getSymbolAtLocation(node);'
  if (!original.includes(marker)) throw new Error('Unsupported Typert generator: expected 0.2.2-rc.2')
  const replacement = marker + `
    if (symbol !== undefined) {
      for (const declaration of symbol.declarations ?? []) {
        if (!ts.isImportSpecifier(declaration) || (declaration.propertyName ?? declaration.name).text !== name) continue;
        const statement = declaration.parent.parent.parent;
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
          && statement.moduleSpecifier.text === '@deepseek-ai/dsh-typert-protocol') return true;
      }
    }`
  const cache = join(root, '.build')
  await mkdir(cache, { recursive: true })
  const generated = join(cache, 'generator.mjs')
  const staged = join(cache, 'packages/classifier')
  await mkdir(staged, { recursive: true })
  await cp(join(root, 'src'), join(staged, 'src'), { recursive: true })
  await cp(join(root, 'package.json'), join(staged, 'package.json'))
  for (const face of ['host', 'client']) {
    const leaf = JSON.parse(await readFile(join(root, `tsconfig.${face}.json`), 'utf8'))
    leaf.extends = '../../../tsconfig.base.json'
    leaf.compilerOptions = { rootDir: 'src', outDir: 'lib/types' }
    await writeFile(join(staged, `tsconfig.${face}.json`), JSON.stringify(leaf))
    await writeFile(join(cache, `tsconfig.${face}.json`), JSON.stringify({ extends: '../tsconfig.base.json', files: [], references: [{ path: `./packages/classifier/tsconfig.${face}.json` }] }))
  }
  await writeFile(generated, original.replace(marker, replacement))
  const { WorkspaceTypertGenerator, writePackageArtifacts } = await import(pathToFileURL(generated).href)
  const artifacts = new WorkspaceTypertGenerator(cache, { checkDiagnostics: false }).generateContributors(['host'])
  if (!artifacts.some(artifact => artifact.remote)) throw new Error('No Remote methods generated')
  writePackageArtifacts(root, artifacts)
  const client = await readFile(join(root, 'lib/typert.remote-client.js'), 'utf8')
  for (const method of ['snapshot', 'apply', 'follow', 'searchContent']) if (!client.includes(method)) throw new Error('Missing generated method: ' + method)
}
