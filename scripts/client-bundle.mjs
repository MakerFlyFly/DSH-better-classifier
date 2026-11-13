/** DSH module-loader bundle and CSS Modules, built entirely from npm dependencies. */
import { readFile } from 'node:fs/promises'
import { dirname, resolve, relative } from 'node:path'
import { transform } from 'lightningcss'
const shared = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-api-workspace-controller/client', '@deepseek-ai/dsh-api-session-controller/client'])
export function clientBundle(root, name) {
  return {
    config: false, entry: { client: 'src/client/index.ts' }, outDir: 'lib', format: 'cjs', platform: 'browser',
    dts: false, clean: false, sourcemap: true, fixedExtension: false,
    deps: { neverBundle: id => shared.has(id), alwaysBundle: id => !shared.has(id) },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.MODE': '"production"', 'import.meta.env': '{"MODE":"production"}' },
    inputOptions: { resolve: { conditionNames: ['production', 'browser', 'import', 'module', 'default'] } },
    outputOptions: {
      entryFileNames: '[name].js',
      codeSplitting: false,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(name)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;', footer: 'return module.exports; } });',
    },
    plugins: [{ name: 'classifier-css',
      resolveId: { order: 'pre', handler(source, importer) {
        if (source.endsWith('.css') && importer) return '\0classifier-css:' + resolve(dirname(importer), source) + '.mjs'
      } },
      async load(id) {
        if (!id.startsWith('\0classifier-css:')) return
        const path = id.slice('\0classifier-css:'.length, -4)
        const output = transform({ filename: relative(root, path).replaceAll('\\', '/'), code: await readFile(path), cssModules: { pattern: 'bc_[name]_[local]_[hash]' }, minify: true })
        const classes = Object.fromEntries(Object.entries(output.exports ?? {}).map(([key, value]) => [key, value.name]))
        const tagId = name + '/' + relative(root, path).replaceAll('\\', '/')
        return `const tagId=${JSON.stringify(tagId)};if(!document.querySelector('style[data-plugin-css='+JSON.stringify(tagId)+']')){const tag=document.createElement('style');tag.dataset.plugin=${JSON.stringify(name)};tag.dataset.pluginCss=tagId;tag.textContent=${JSON.stringify(output.code.toString())};document.head.appendChild(tag);}export default ${JSON.stringify(classes)};`
      },
    }, { name: 'classifier-browser-imports',
      generateBundle(_options, output) {
        for (const value of Object.values(output)) if (value.type === 'chunk') {
          for (const id of value.imports) if (!shared.has(id)) throw new Error('Unexpected browser external: ' + id)
          for (const id of Object.keys(value.modules)) if (id.startsWith('node:')) throw new Error('Node module in browser: ' + id)
        }
      },
    }],
  }
}
