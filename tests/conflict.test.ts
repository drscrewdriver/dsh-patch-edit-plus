import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.js'
import { registerApplyPatchTool } from '../src/register.js'
import { PatchError } from '../src/errors.js'
import { makeRig } from './helpers.js'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'

/** A minimal tools-registry face over a Map, mirroring DSH's same-layer duplicate throw. */
function makeTools(names: string[]) {
  const map = new Map<string, ToolDefinition>()
  for (const name of names) map.set(name, { name } as unknown as ToolDefinition)
  return {
    map,
    get(name: string) { return map.get(name) },
    register(definition: ToolDefinition) {
      if (map.has(definition.name)) throw new Error(`tool "${definition.name}" is already registered (for a per-agent variant, register through that agent's \`agent.ctx\` instead)`)
      map.set(definition.name, definition)
      return () => map.delete(definition.name)
    },
    schemas() { return [...map.values()] },
  }
}

describe('tool name conflict handling', () => {
  it('rename (default) registers under a suffixed name and keeps the plugin loaded', () => {
    const rig = makeRig()
    const tools = makeTools(['apply_patch'])
    const disposer = registerApplyPatchTool({ tools } as never, rig.cfg, console)
    expect(disposer).toBeTypeOf('function')
    expect(tools.map.has('apply_patch_1')).toBe(true)
    disposer?.()
    expect(tools.map.has('apply_patch_1')).toBe(false)
  })

  it('rename walks further candidates when the first suffix is taken too', () => {
    const rig = makeRig()
    const tools = makeTools(['apply_patch', 'apply_patch_1'])
    registerApplyPatchTool({ tools } as never, rig.cfg, console)
    expect(tools.map.has('apply_patch_12')).toBe(true)
  })

  it('skip logs and registers nothing', () => {
    const rig = makeRig()
    const tools = makeTools(['apply_patch'])
    const errors: string[] = []
    const disposer = registerApplyPatchTool({ tools } as never, { ...rig.cfg, conflictPolicy: 'skip' }, { error: (m: string) => errors.push(m) })
    expect(disposer).toBeNull()
    expect(tools.map.size).toBe(1)
    expect(errors[0]).toContain('apply_patch')
  })

  it('fail throws with the conflict name and guidance', () => {
    const rig = makeRig()
    const tools = makeTools(['apply_patch'])
    expect(() => registerApplyPatchTool({ tools } as never, { ...rig.cfg, conflictPolicy: 'fail' }, console)).toThrowError(PatchError)
  })

  it('a racing duplicate register is caught and degrades instead of crashing the load', () => {
    const rig = makeRig()
    const tools = {
      get: () => undefined,
      register: () => { throw new Error('tool "apply_patch" is already registered in this scope') },
    }
    const errors: string[] = []
    const disposer = registerApplyPatchTool({ tools } as never, rig.cfg, { error: (m: string) => errors.push(m) })
    expect(disposer).toBeNull()
    expect(errors[0]).toContain('already registered')
  })

  it('fail policy rethrows the racing register error', () => {
    const rig = makeRig()
    const tools = {
      get: () => undefined,
      register: () => { throw new Error('tool "apply_patch" is already registered in this scope') },
    }
    expect(() => registerApplyPatchTool({ tools } as never, { ...rig.cfg, conflictPolicy: 'fail' }, console)).toThrowError(/already registered/)
  })

  it('default config matches the spec defaults', () => {
    const cfg = resolveConfig(undefined)
    expect(cfg.toolName).toBe('apply_patch')
    expect(cfg.conflictPolicy).toBe('rename')
    expect(cfg.allowUnifiedDiff).toBe(true)
    expect(cfg.allowCodexPatch).toBe(false)
    expect(cfg.deleteBackend).toBe('shell')
    expect(cfg.followSymlinks).toBe(false)
  })
})
