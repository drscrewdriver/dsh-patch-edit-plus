import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.js'
import { makeRig } from './helpers.js'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'

type SectionHooks = { setSource(current: () => unknown): void; onChange(): void }

/** A cordis-shaped stub host context exercising the plugin's lifecycle. */
function makeHostCtx(options: { takenNames?: string[]; missingShell?: boolean } = {}) {
  const registered = new Map<string, ToolDefinition>()
  const disposers: (() => void)[] = []
  const injected: string[][] = []
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
  // Mirrors the real installSection: capture the hooks, drive setSource then
  // onChange at attach, and keep the section handle. A stub that ignored the
  // hooks is exactly how the wiring defect stayed invisible to the suite.
  let hooks: SectionHooks | undefined
  const compositionEntry: Record<string, unknown> = {}
  let currentSource: () => unknown = () => compositionEntry
  const settingsFace = {
    installSection: (owner: unknown, ns: string, schema: unknown, entry: unknown, h: SectionHooks) => {
      hooks = h
      currentSource = () => entry
      hooks.setSource(currentSource)
      hooks.onChange()
      return { owner, ns, schema }
    },
    register: () => { throw new Error('should not fall back when installSection exists') },
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
    inject(deps: string[], cb: (scoped: unknown) => void) {
      injected.push(deps)
      cb({ settings: settingsFace, effect: (fn: () => unknown) => ctx.effect(fn) })
    },
    get() { return undefined },
  }
  for (const name of options.takenNames ?? []) registered.set(name, { name } as unknown as ToolDefinition)
  return {
    ctx,
    registered,
    disposers,
    injected,
    registerCount: () => registerCount,
    /** Simulate a committed settings change: the resolved source switches. */
    commitSettings(source: Record<string, unknown>): void {
      if (hooks === undefined) throw new Error('settings section not installed')
      currentSource = () => source
      hooks.setSource(currentSource)
      hooks.onChange()
    },
    /** Simulate the settings service detaching: the source falls back to the composition entry. */
    detachSettings(): void {
      if (hooks === undefined) throw new Error('settings section not installed')
      currentSource = () => compositionEntry
      hooks.setSource(currentSource)
      hooks.onChange()
    },
    disposAll: () => { for (const d of disposers.splice(0)) d() },
  }
}

describe('plugin lifecycle', () => {
  it('apply registers exactly one tool and the settings section', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, {})
    expect(host.registered.size).toBe(1)
    expect(host.registered.has('apply_patch')).toBe(true)
    expect(host.injected).toEqual([['settings']])
  })

  it('dispose removes the tool; a reload can register it again', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, {})
    expect(host.registered.has('apply_patch')).toBe(true)
    host.disposAll()
    expect(host.registered.has('apply_patch')).toBe(false)
    apply(host.ctx as never, {})
    expect(host.registered.has('apply_patch')).toBe(true)
  })

  it('a taken tool name does not break loading (rename avoidance)', () => {
    const host = makeHostCtx({ takenNames: ['apply_patch'] })
    apply(host.ctx as never, {})
    expect(host.registered.has('apply_patch_1')).toBe(true)
  })

  it('native tool names are untouched — pure addition', () => {
    const host = makeHostCtx({ takenNames: ['read', 'write', 'edit', 'glob', 'grep'] })
    apply(host.ctx as never, {})
    for (const native of ['read', 'write', 'edit', 'glob', 'grep']) {
      expect(host.registered.has(native)).toBe(true)
      expect(host.registered.get(native)?.name).toBe(native)
    }
    expect(host.registered.has('apply_patch')).toBe(true)
    expect(host.registered.size).toBe(6)
  })

  it('the frozen definition survives registration', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, {})
    expect(Object.isFrozen(host.registered.get('apply_patch'))).toBe(true)
  })

  it('the tool definition declares the spec parameters and seven-field output', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, {})
    const def = host.registered.get('apply_patch') as unknown as {
      parameters: { properties: Record<string, { type: string }>; required: string[] }
      output: { schema: { properties: Record<string, unknown>; required?: string[] } }
    }
    expect(def.parameters.properties.patch?.type).toBe('string')
    expect(def.parameters.required).toContain('patch')
    expect(def.parameters.properties.dryRun?.type).toBe('boolean')
    expect(def.output.schema.required).toEqual(expect.arrayContaining(['format', 'applied', 'summary', 'files', 'stats', 'wallTimeMs', 'diffs']))
  })

  it('a committed settings change re-registers the same tool name with an updated description', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, {})
    expect(host.registered.get('apply_patch')?.description).not.toContain('Codex apply_patch syntax')
    host.commitSettings({ allowCodexPatch: true })
    expect([...host.registered.keys()]).toEqual(['apply_patch'])
    expect(host.registered.has('apply_patch_1')).toBe(false)
    expect(host.registered.get('apply_patch')?.description).toContain('Codex apply_patch syntax')
  })

  it('repeated onChange with the same resolved value registers only once (idempotent)', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, {})
    const afterLoad = host.registerCount()
    const source = { allowCodexPatch: true }
    host.commitSettings(source)
    host.commitSettings(source)
    expect(host.registerCount()).toBe(afterLoad + 1)
  })

  it('detaching the settings service falls back to the composition entry', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, {})
    host.commitSettings({ allowCodexPatch: true })
    expect(host.registered.get('apply_patch')?.description).toContain('Codex apply_patch syntax')
    host.detachSettings()
    expect([...host.registered.keys()]).toEqual(['apply_patch'])
    expect(host.registered.get('apply_patch')?.description).not.toContain('Codex apply_patch syntax')
  })

  it('a change to a non-description field still re-registers (key covers the whole config)', () => {
    const host = makeHostCtx()
    apply(host.ctx as never, { maxFiles: 4 })
    const before = host.registerCount()
    host.commitSettings({ maxFiles: 9 })
    expect(host.registerCount()).toBe(before + 1)
    expect([...host.registered.keys()]).toEqual(['apply_patch'])
  })
})
