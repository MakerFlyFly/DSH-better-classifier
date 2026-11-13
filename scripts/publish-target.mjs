/** An explicit local spec prevents npm from treating dist/name.tgz as a GitHub shorthand. */
export function publishArchive(name, version) {
  if (!/^[a-z0-9-]+$/.test(name) || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Unexpected package name or version')
  const filename = `${name}-${version}.tgz`
  return { filename, spec: `./dist/${filename}`, tag: version.includes('-') ? 'next' : 'latest' }
}
