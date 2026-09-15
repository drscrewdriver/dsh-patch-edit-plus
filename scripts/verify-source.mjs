#!/usr/bin/env node
/**
 * Source assertions — static guarantees that the plugin stays harmless to DSH.
 * Exits non-zero on the first violated invariant.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', 'src')

function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) collect(full, out)
    else if (name.endsWith('.ts')) out.push(full)
  }
  return out
}

const files = collect(SRC)
let failures = 0
const check = (name, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures += 1
}
const all = (predicate) => files.every(predicate)

// T2: no node:fs writes/deletes — everything goes through ctx.fs / ctx.shell.
check('no node:fs import anywhere in src/', files.every(f => !/from ['"]node:fs['"]/.test(readFileSync(f, 'utf8'))))
check('no node:fs write/unlink/rm/mkdir calls', all(f => !/writeFile|unlink|rmSync|mkdirSync|rm\(/.test(readFileSync(f, 'utf8')) || f.endsWith('errors.ts') === false))
// T4: pure addition — no restriction or override of the native tool surface.
check('no ctx.tools.restrict( call', all(f => !/tools\.restrict\(/.test(readFileSync(f, 'utf8'))))
// T5/T9: no global service registration.
check('no ctx.provide( / ctx.set( calls', all(f => !/ctx\.provide\(|ctx\.set\(/.test(readFileSync(f, 'utf8'))))
// K11: no 0.1.5-only PTC strings.
check('no 0.1.5-only PTC identifiers (":code:", "tool/code-dispatch", "tools-code-mode")',
  all(f => !/`:code:`|tool\/code-dispatch|tools-code-mode/.test(readFileSync(f, 'utf8'))))

// K8: every writeText goes through the intent dance in fsops.ts.
const fsops = readFileSync(join(SRC, 'fsops.ts'), 'utf8')
check('fsops: waterfall("fs/write-intent", target, exec, ...) precedes writeText',
  /waterfall\('fs\/write-intent', target, exec, \(\) => undefined\)/.test(fsops)
  && fsops.indexOf("waterfall('fs/write-intent'") < fsops.lastIndexOf('ctx.fs.writeText'))
check('fsops: writeText 3rd arg is the waterfall intent variable',
  /writeText\(target, content, intent, exec\.signal, sandboxPolicy\)/.test(fsops))
check('fsops: emit("fs/observed", target, { kind: "present", version }) after write',
  /emit\('fs\/observed', target, \{ kind: 'present', version: outcome\.version \}, exec\)/.test(fsops))

// Exactly one registration call site (single-tool delivery boundary).
const registerSrc = files.map(f => readFileSync(f, 'utf8')).join('\n')
const registerCalls = [...registerSrc.matchAll(/tools\.register\(/g)].length
check(`exactly one tools.register( call site (found ${registerCalls})`, registerCalls === 1)

// Tool definition is frozen after build.
const toolSrc = readFileSync(join(SRC, 'tool.ts'), 'utf8')
check('tool definition is Object.freeze-d', /Object\.freeze\(definition\)/.test(toolSrc))

console.log(failures === 0 ? 'SOURCE ASSERTIONS: ALL PASS' : `SOURCE ASSERTIONS: ${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
