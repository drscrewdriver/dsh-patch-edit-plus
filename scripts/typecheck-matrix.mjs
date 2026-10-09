#!/usr/bin/env node
/**
 * Static cross-version matrix: typecheck src against EACH retained host
 * generation's real peer packages. Every line installs its newest-rc peer set
 * into `.compat-<ver>/` and runs tsc with `paths` redirected there.
 *
 * This gate CLOSES the two former "real-host unknowns" before any deployment:
 * - defineTool export presence in dsh-tools (0.1.0-rc.8 / 0.1.1-rc.2),
 * - the fs API shape (writeText arity / write-intent era) on the old lines.
 * Only pure runtime behavior is left to the farm probes.
 */
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
// Per retained host line: the newest rc (what the farm cells run).
const MATRIX = [
  '0.1.0-rc.8',
  '0.1.1-rc.2',
  '0.1.2-rc.1',
  '0.1.5-rc.3',
  '0.1.7-rc.2',
  '0.2.0-rc.2',
]
// All host peers the plugin consumes (client packages included — the client
// half compiles against dsh-client-ui-slots; dsh-settings backs the 0.1.0/0.1.1
// settings module import).
const PEERS = [
  '@deepseek-ai/dsh-fs',
  '@deepseek-ai/dsh-shell',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-sandbox',
  '@deepseek-ai/dsh-settings',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-settings',
]
// cordis is versioned independently (4.x line) and identical across DSH versions.
const CORDIS = { '@deepseek-ai/cordis': '^4.0.2' }

let failed = 0

for (const VERSION of MATRIX) {
  const COMPAT = join(ROOT, `.compat-${VERSION}`)
  try {
    rmSync(COMPAT, { recursive: true, force: true })
    mkdirSync(COMPAT, { recursive: true })
    writeFileSync(join(COMPAT, 'package.json'), JSON.stringify({
      name: `dsh-patch-edit-plus-compat-${VERSION.replace(/\./g, '-')}`,
      private: true,
      version: '0.0.0',
      type: 'module',
      dependencies: Object.fromEntries([...PEERS.map(p => [p, VERSION]), ...Object.entries(CORDIS)]),
    }, null, 2))

    console.log(`\n=== ${VERSION}: installing ${PEERS.length} peers ...`)
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

    execSync(`npx tsc -p .compat-${VERSION}/tsconfig.json`, { cwd: ROOT, stdio: 'inherit' })
    console.log(`${VERSION} COMPAT TYPECHECK: PASS`)
  } catch (error) {
    failed += 1
    console.error(`${VERSION} COMPAT TYPECHECK: FAIL — ${error.message ?? error}`)
  } finally {
    rmSync(COMPAT, { recursive: true, force: true })
  }
}

if (failed > 0) {
  console.error(`\nMATRIX RESULT: ${failed}/${MATRIX.length} lines FAILED`)
  process.exit(1)
}
console.log(`\nMATRIX RESULT: all ${MATRIX.length} lines PASS`)
