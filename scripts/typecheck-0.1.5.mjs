#!/usr/bin/env node
/**
 * Static cross-version verification: typecheck the plugin's src against the
 * 0.1.5-rc.2 peer packages (the local machine runs 0.1.2-rc.1, whose packages
 * are the regular devDependencies). Installs the 0.1.5 peer set into
 * `.compat-0.1.5/` and runs tsc with `paths` redirected there.
 */
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const COMPAT = join(ROOT, '.compat-0.1.5')
const PEERS = ['@deepseek-ai/dsh-fs', '@deepseek-ai/dsh-shell', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-sandbox']
// cordis is versioned independently (4.x line) and identical across DSH versions.
const CORDIS = { '@deepseek-ai/cordis': '^4.0.2' }
const VERSION = '0.1.5-rc.2'

rmSync(COMPAT, { recursive: true, force: true })
mkdirSync(COMPAT, { recursive: true })
writeFileSync(join(COMPAT, 'package.json'), JSON.stringify({
  name: 'dsh-patch-edit-plus-compat-015',
  private: true,
  version: '0.0.0',
  type: 'module',
  dependencies: Object.fromEntries([...PEERS.map(p => [p, VERSION]), ...Object.entries(CORDIS)]),
}, null, 2))

console.log(`installing ${PEERS.join(', ')} @ ${VERSION} ...`)
execSync('npm install --no-audit --no-fund --loglevel=error', { cwd: COMPAT, stdio: 'inherit' })

const tsconfig = {
  extends: '../tsconfig.json',
  compilerOptions: {
    noEmit: true,
    composite: false,
    declarationDir: undefined,
    baseUrl: '.',
    paths: Object.fromEntries([...PEERS, '@deepseek-ai/cordis'].map(p => [p, [`./node_modules/${p}`]])),
  },
}
writeFileSync(join(COMPAT, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))

try {
  execSync('npx tsc -p .compat-0.1.5/tsconfig.json', { cwd: ROOT, stdio: 'inherit' })
  console.log('0.1.5-rc.2 COMPAT TYPECHECK: PASS')
} finally {
  rmSync(COMPAT, { recursive: true, force: true })
}
