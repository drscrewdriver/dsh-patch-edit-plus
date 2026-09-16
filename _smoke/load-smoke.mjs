#!/usr/bin/env node
/**
 * Load-level smoke test for dsh-patch-edit-plus.
 *
 * Proves, without a running DSH:
 * 1. the built lib entry imports and exposes the plugin contract (name / Config / apply);
 * 2. apply() runs against a cordis-shaped stub context: exactly one tool is
 *    registered, rename avoidance works under a taken name, and dispose removes it;
 * 3. the tool executes end-to-end against a memory fs (unified + codex + dryRun);
 * 4. the only runtime externals of lib/index.js are the declared peers plus
 *    schemastery (host half — no client bundle, so no module-table requests);
 * 5. the assembly manifest (dsh.plugin.json + cordis.patch.yml) is present and
 *    the patch is a pure insert.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = join(import.meta.dirname, '..')
let failures = 0
const ok = (step, detail = '') => console.log(`  PASS  ${step}${detail ? ` — ${detail}` : ''}`)
const bad = (step, err) => { failures += 1; console.log(`  FAIL  ${step} — ${err?.stack ?? err}`) }

const { name, Config, apply, inject } = await import(pathToFileURL(join(ROOT, 'lib/index.js')))

try {
  if (name !== 'dsh-patch-edit-plus') throw new Error(`bad plugin name: ${name}`)
  if (typeof Config !== 'function' && typeof Config !== 'object') throw new Error('Config schema missing')
  if (typeof apply !== 'function') throw new Error('apply missing')
  if (!Array.isArray(inject)) throw new Error(`plugin must export an inject array, got: ${JSON.stringify(inject)}`)
  ok('plugin contract (name / Config / apply / inject)')
} catch (error) { bad('plugin contract', error) }

// cordis-shaped stub host context with a memory fs.
const files = new Map()
const dirs = new Set(['/work', '/work/src'])
const writeCalls = []
const fs = {
  resolve: (path, opts) => {
    let abs = path.startsWith('/') ? path : `${opts?.cwd ?? '/work'}/${path}`
    const out = []
    for (const seg of abs.split('/')) {
      if (seg === '' || seg === '.') continue
      if (seg === '..') out.pop()
      else out.push(seg)
    }
    abs = '/' + out.join('/')
    return Promise.resolve({ targetKey: abs, displayPath: abs })
  },
  contains: (parent, child) => child.targetKey.startsWith(parent.targetKey + '/'),
  lstat: async (p) => dirs.has(p.startsWith('/') ? p : `/work/${p}`) ? { type: 'directory' } : undefined,
  stat: async (t) => files.has(t.targetKey) ? { type: 'file', version: 'v' } : undefined,
  readText: async (t) => {
    const c = files.get(t.targetKey)
    if (c === undefined) throw new Error(`FS_NOT_FOUND ${t.targetKey}`)
    return c
  },
  writeText: async (t, content, intent, signal, sandboxPolicy) => {
    writeCalls.push({ target: t.targetKey, intent, signal, sandboxPolicy })
    files.set(t.targetKey, content)
    return { operation: 'update', version: 'v2', before: null, after: content }
  },
  processPath: (t) => t.targetKey,
}
const waterfallCalls = []
const emitCalls = []
const registered = new Map()
const disposers = []
/**
 * Cordis resolves `ctx.<service>` through a proxy: properties that exist on the
 * context object itself are returned directly, and everything else goes through
 * the inject gate, which throws `cannot get property "<name>" without inject`
 * for any service the plugin did not declare. In a real profile the services
 * are NOT properties of the context object — they live in the loader's store —
 * so the gate is the only way to reach them.
 *
 * This stub mirrors that split exactly. Mounting `tools` / `fs` straight onto
 * the context object (as this file used to) makes the gate unreachable, which
 * is how a missing `inject` declaration survived a green smoke run and then
 * took down `dsh web` with `plugin tree failed to load`.
 *
 * `shell` is intentionally NOT mounted and NOT declared: `resolveShell` probes
 * it inside a try/catch and must observe the same throw a profile without a
 * shell executor produces.
 */
const HOST_SERVICES = {
  tools: {
    get: (n) => registered.get(n),
    register: (def) => { registered.set(def.name, def); return () => registered.delete(def.name) },
    schemas: () => [...registered.keys()],
  },
  fs,
  // shell / sandbox / attachments / subprocess are not mounted in this stub.
}
const declaredServices = new Set(inject)

const rawCtx = {
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  effect: (fn) => { const d = fn(); if (typeof d === 'function') disposers.push(d); return d },
  inject: (deps, cb) => cb({ settings: { installSection: () => {} } }),
  get: () => undefined,
  waterfall: async (event, target, exec, next) => { waterfallCalls.push(event); return next() },
  emit: (event, ...args) => emitCalls.push([event, ...args]),
}

const ctx = new Proxy(rawCtx, {
  get(target, prop, receiver) {
    if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver)
    if (typeof prop === 'string' && Object.hasOwn(HOST_SERVICES, prop)) {
      if (!declaredServices.has(prop)) throw new Error(`cannot get property "${prop}" without inject`)
      return HOST_SERVICES[prop]
    }
    return undefined
  },
})

try {
  const lazy = ['shell', 'sandbox', 'attachments', 'subprocess'].filter(s => declaredServices.has(s))
  if (lazy.length > 0) throw new Error(`these services must stay out of inject (probed defensively): ${lazy.join(', ')}`)
  const uncovered = ['tools', 'fs'].filter(s => !declaredServices.has(s))
  if (uncovered.length > 0) throw new Error(`load-path services missing from inject: ${uncovered.join(', ')}`)
  ok('inject covers the load path; lazily probed services stay out')
} catch (error) { bad('inject shape', error) }

try {
  apply(ctx, {})
  if (registered.size !== 1 || !registered.has('apply_patch')) throw new Error(`expected exactly one tool "apply_patch", got: ${[...registered.keys()]}`)
  ok('apply() registers exactly one tool under the default name')
} catch (error) { bad('apply() registration', error) }

const exec = {
  callId: 's1', rootCallId: 's1', name: 'apply_patch', arguments: {},
  agent: { session: { header: { cwd: '/work' } } },
  signal: new AbortController().signal,
  deferContext: () => {}, concludeTurn: () => {}, token: Symbol('t'),
}

try {
  files.set('/work/a.txt', 'x\ny\n')
  const tool = registered.get('apply_patch')
  const result = await tool.execute({ patch: '--- a/a.txt\n+++ b/a.txt\n@@ -1,1 +1,1 @@\n-x\n+X\n' }, exec)
  if (result.applied !== true || files.get('/work/a.txt') !== 'X\ny\n') throw new Error(`bad result: ${JSON.stringify(result)}`)
  if (waterfallCalls[0] !== 'fs/write-intent' || emitCalls[0]?.[0] !== 'fs/observed') throw new Error('intent dance missing')
  if (writeCalls[0].intent !== undefined) throw new Error('intent not forwarded from waterfall')
  ok('unified patch applies through the intent dance')
} catch (error) { bad('unified end-to-end', error) }

try {
  const tool = registered.get('apply_patch')
  // Default: Codex style OFF — must return the actionable UNSUPPORTED hint.
  try {
    await tool.execute({ patch: '*** Begin Patch\n*** Add File: src/n.txt\n+hi\n*** End Patch\n' }, exec)
    throw new Error('codex patch unexpectedly applied while the style is disabled')
  } catch (error) {
    if (error?.code !== 'UNSUPPORTED' || !String(error.message).includes('allowCodexPatch')) throw error
  }
  ok('codex style disabled by default with the actionable hint')
} catch (error) { bad('codex default-deny', error) }

try {
  disposers.splice(0).forEach(d => d())
  registered.clear()
  apply(ctx, { allowCodexPatch: true })
  const tool = registered.get('apply_patch')
  await tool.execute({ patch: '*** Begin Patch\n*** Add File: src/n.txt\n+hi\n*** End Patch\n' }, exec)
  if (files.get('/work/src/n.txt') !== 'hi\n') throw new Error('codex add failed')
  const before = files.get('/work/a.txt')
  const dry = await tool.execute({ patch: '--- a/a.txt\n+++ b/a.txt\n@@ -1,1 +1,1 @@\n-X\n+Z\n', dryRun: true }, exec)
  if (dry.applied !== false || files.get('/work/a.txt') !== before) throw new Error('dryRun wrote to disk')
  ok('codex style applies when enabled; dryRun writes nothing')
} catch (error) { bad('codex/dryRun end-to-end', error) }

try {
  disposers.splice(0).forEach(d => d())
  if (registered.size !== 0) throw new Error('dispose left the tool registered')
  ok('dispose removes the tool (unload restores DSH state)')
} catch (error) { bad('dispose', error) }

try {
  const entry = readFileSync(join(ROOT, 'lib/index.js'), 'utf8')
  const externals = [...entry.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1])
    .concat([...entry.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]))
  const bare = externals.filter(s => !s.startsWith('.') && !s.startsWith('/'))
  const allowed = new Set(['@deepseek-ai/cordis', '@deepseek-ai/dsh-fs', '@deepseek-ai/dsh-shell', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-sandbox', '@deepseek-ai/schemastery'])
  const extra = bare.filter(s => !allowed.has(s))
  if (extra.length > 0) throw new Error(`undeclared runtime externals: ${extra.join(', ')}`)
  ok('runtime externals ⊆ declared peers + schemastery', bare.join(', ') || '(type-only, erased)')
} catch (error) { bad('runtime externals', error) }

try {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'dsh.plugin.json'), 'utf8'))
  if (manifest.id !== 'dsh-patch-edit-plus' || manifest.components.host !== 'lib/index.js') throw new Error('bad dsh.plugin.json')
  const patch = readFileSync(join(ROOT, 'cordis.patch.yml'), 'utf8')
  const code = patch.split('\n').filter(line => !line.trim().startsWith('#')).join('\n')
  if (!/^\s*-\s*insert:/m.test(code)) throw new Error('cordis.patch.yml has no insert block')
  if (/disabled:\s|replaced:|\brename\b/.test(code)) throw new Error('cordis.patch.yml is not a pure insert')
  ok('assembly manifest present; cordis.patch.yml is a pure insert')
} catch (error) { bad('assembly manifest', error) }

console.log(failures === 0 ? 'SMOKE PASS' : 'SMOKE FAIL')
process.exit(failures === 0 ? 0 : 1)
