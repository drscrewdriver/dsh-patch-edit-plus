import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.js'
import { makeRig } from './helpers.js'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'

/** Minimal live-ref shape the 0.1.7 loader hands `apply` for `.volatile()` fields. */
type VolatileRef<T> = { get(): T }

/** A cordis-shaped stub host context exercising the plugin's lifecycle. */
function makeHostCtx(options: { takenNames?: string[] } = {}) {
  const registered = new Map<string, ToolDefinition>()
  const disposers: (() => void)[] = []
  const listeners = new Map<string, ((paths: string[]) => void)[]>()
  let registerCount = 0
  const tools = {
    get(name: string) { return registered.get(name) },
    register(definition: ToolDefinition) {
      if (registered.has(definition.name)) throw new Error(`tool "${definition.name}" is already registered`)
      registerCount += 1
      registered.set(definition.name, definition)
      return () => registered.delete(definition.name)
    },
    schemas() { return [...registered.keys()] },
  }
  // Composition entry as the 0.1.7 loader presents it: `.volatile()` fields are
  // live refs; rejudge must re-resolve the whole entry on every update.
  let allowCodexValue = false
  const compositionEntry: Record<string, unknown> = {
    allowCodexPatch: { get: () => allowCodexValue } as VolatileRef<boolean>,
  }
  const ctx = {
    tools,
    fs: makeRig().fs,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    effect(fn: () => unknown) {
      const d = fn()
      if (typeof d === 'function') disposers.push(d as () => void)
      return d
    },
    on(event: string, fn: (paths: string[]) => void) {
      const list = listeners.get(event) ?? []
      list.push(fn)
      listeners.set(event, list)
    },
    get() { return undefined },
  }
  for (const name of options.takenNames ?? []) registered.set(name, { name } as unknown as ToolDefinition)
  return {
    ctx,
    entry: compositionEntry,
    registered,
    disposers,
    registerCount: () => registerCount,
    /** Simulate a committed volatile-field change: flip the live ref, emit once. */
    commitVolatile(value: boolean): void {
      allowCodexValue = value
      for (const fn of listeners.get('loader/volatile-update') ?? []) fn(['allowCodexPatch'])
    },
    /** Simulate a volatile update whose resolved values are unchanged (no-op). */
    emitUnchanged(): void {
      for (const fn of listeners.get('loader/volatile-update') ?? []) fn(['allowCodexPatch'])
    },
    disposAll: () => { for (const d of disposers.splice(0)) d() },
  }
}

describe('plugin lifecycle', () => {
  it('apply registers exactly one tool with no settings registration', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, host.entry)
    expect(host.registered.size).toBe(1)
    expect(host.registered.has('apply_patch')).toBe(true)
  })

  it('dispose removes the tool; a reload can register it again', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, host.entry)
    expect(host.registered.has('apply_patch')).toBe(true)
    host.disposAll()
    expect(host.registered.has('apply_patch')).toBe(false)
    apply(host.ctx as never, host.entry)
    expect(host.registered.has('apply_patch')).toBe(true)
  })

  it('a taken tool name does not break loading (rename avoidance)', () => {
    const host = makeHostCtx({ takenNames: ['apply_patch'] })
    apply(host.ctx as never, host.entry)
    expect(host.registered.has('apply_patch_1')).toBe(true)
  })

  it('native tool names are untouched — pure addition', () => {
    const host = makeHostCtx({ takenNames: ['read', 'write', 'edit', 'glob', 'grep'] })
    apply(host.ctx as never, host.entry)
    for (const native of ['read', 'write', 'edit', 'glob', 'grep']) {
      expect(host.registered.has(native)).toBe(true)
      expect(host.registered.get(native)?.name).toBe(native)
    }
    expect(host.registered.has('apply_patch')).toBe(true)
    expect(host.registered.size).toBe(6)
  })

  it('the frozen definition survives registration', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, host.entry)
    expect(Object.isFrozen(host.registered.get('apply_patch'))).toBe(true)
  })

  it('the tool definition declares the spec parameters and seven-field output', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, host.entry)
    const def = host.registered.get('apply_patch') as unknown as {
      parameters: { properties: Record<string, { type: string }>; required: string[] }
      output: { schema: { properties: Record<string, unknown>; required?: string[] } }
    }
    expect(def.parameters.properties.patch?.type).toBe('string')
    expect(def.parameters.required).toContain('patch')
    expect(def.parameters.properties.dryRun?.type).toBe('boolean')
    expect(def.output.schema.required).toEqual(expect.arrayContaining(['format', 'applied', 'summary', 'files', 'stats', 'wallTimeMs', 'diffs']))
  })

  it('a committed volatile change re-registers the same tool name with an updated description', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, host.entry)
    expect(host.registered.get('apply_patch')?.description).not.toContain('Codex apply_patch syntax')
    host.commitVolatile(true)
    expect([...host.registered.keys()]).toEqual(['apply_patch'])
    expect(host.registered.has('apply_patch_1')).toBe(false)
    expect(host.registered.get('apply_patch')?.description).toContain('Codex apply_patch syntax')
    host.commitVolatile(false)
    expect(host.registered.get('apply_patch')?.description).not.toContain('Codex apply_patch syntax')
  })

  it('repeated volatile updates with the same resolved value register only once (idempotent)', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, host.entry)
    const afterLoad = host.registerCount()
    host.commitVolatile(true)
    host.emitUnchanged()
    host.emitUnchanged()
    expect(host.registerCount()).toBe(afterLoad + 1)
  })
})
