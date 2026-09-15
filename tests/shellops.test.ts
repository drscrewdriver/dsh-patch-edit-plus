import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.js'
import { makeRig, MemoryFs } from './helpers.js'
import { buildApplyPatchTool } from '../src/tool.js'
import { POSIX_MOVE, POSIX_REMOVE, PWSH_MOVE, PWSH_REMOVE, deleteTemplate, moveTemplate, resolveDialect } from '../src/shellops.js'
import { PatchError } from '../src/errors.js'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'

const cfg = () => resolveConfig({ allowCodexPatch: true })

function shellExec() {
  return makeRig().exec
}

function makeShellTool(fs: MemoryFs, shell: unknown) {
  return buildApplyPatchTool('apply_patch', { fs, waterfall: async (_e: string, _t: unknown, _x: unknown, next: () => unknown) => next(), emit: () => {}, shell } as never, cfg())
}

const DELETE_PATCH = '*** Begin Patch\n*** Delete File: gone.txt\n*** End Patch\n'

function result(exitCode: number, extra: Record<string, unknown> = {}) {
  return { exitCode, signal: null, timedOut: false, aborted: false, timeoutMs: 30_000, stdout: { text: '' }, stderr: { text: 'some error' }, ...extra }
}

describe('shell ops', () => {
  it('command templates are constants and paths travel via env only', async () => {
    const fs = new MemoryFs()
    fs.addFile('gone.txt', 'x\n')
    const requests: { command: string; env?: Record<string, string> }[] = []
    const shell = { resolve: (r: unknown) => r, run: async (r: { command: string; env?: Record<string, string> }) => { requests.push(r); return result(0) } }
    const tool = makeShellTool(fs, shell)
    await tool.execute({ patch: DELETE_PATCH }, shellExec())
    expect(requests).toHaveLength(1)
    expect(requests[0].command).toBe(process.platform === 'win32' ? PWSH_REMOVE : POSIX_REMOVE)
    expect(requests[0].env?.DSH_PATCH_TARGET).toBe('/work/gone.txt')
    expect(requests[0].command).not.toContain('gone.txt')
  })

  it('paths with shell metacharacters cannot inject commands', async () => {
    const fs = new MemoryFs()
    const evil = 'x"; rm -rf /; #'
    fs.addFile(evil, 'x\n')
    const requests: { command: string; env?: Record<string, string> }[] = []
    const shell = { resolve: (r: unknown) => r, run: async (r: { command: string; env?: Record<string, string> }) => { requests.push(r); return result(0) } }
    const tool = makeShellTool(fs, shell)
    const patch = `*** Begin Patch\n*** Delete File: ${evil}\n*** End Patch\n`
    await tool.execute({ patch }, shellExec())
    expect(requests[0].command).toBe(process.platform === 'win32' ? PWSH_REMOVE : POSIX_REMOVE)
    expect(requests[0].env?.DSH_PATCH_TARGET).toBe(`/work/${evil}`)
  })

  it('template backtick and $() injection attempts stay in env', async () => {
    const fs = new MemoryFs()
    const evil = 'a`id`b$(whoami)c'
    fs.addFile(evil, 'x\n')
    const requests: { command: string; env?: Record<string, string> }[] = []
    const shell = { resolve: (r: unknown) => r, run: async (r: { command: string; env?: Record<string, string> }) => { requests.push(r); return result(0) } }
    const tool = makeShellTool(fs, shell)
    await tool.execute({ patch: `*** Begin Patch\n*** Delete File: ${evil}\n*** End Patch\n` }, shellExec())
    expect(requests[0].command).toBe(process.platform === 'win32' ? PWSH_REMOVE : POSIX_REMOVE)
    expect(requests[0].env?.DSH_PATCH_TARGET).toContain('`id`')
  })

  it('a sandbox denial reports policy rejection, not command failure', async () => {
    const fs = new MemoryFs()
    fs.addFile('gone.txt', 'x\n')
    const shell = { resolve: (r: unknown) => r, run: async () => result(1, { sandbox: { mode: 'workspace-write', denied: true } }) }
    const tool = makeShellTool(fs, shell)
    try {
      await tool.execute({ patch: DELETE_PATCH }, shellExec())
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(PatchError)
      expect((error as PatchError).code).toBe('VALIDATION')
      expect((error as PatchError).message).toContain('sandbox denied')
    }
  })

  it('a plain nonzero exit reports command failure', async () => {
    const fs = new MemoryFs()
    fs.addFile('gone.txt', 'x\n')
    const shell = { resolve: (r: unknown) => r, run: async () => result(1) }
    const tool = makeShellTool(fs, shell)
    try {
      await tool.execute({ patch: DELETE_PATCH }, shellExec())
      expect.unreachable()
    } catch (error) {
      expect((error as PatchError).code).toBe('IO')
      expect((error as PatchError).message).toContain('exit code 1')
    }
  })

  it('missing shell degrades to a structured UNSUPPORTED error', async () => {
    const rig = makeRig({ allowCodexPatch: true }, { 'gone.txt': 'x\n' })
    try {
      await rig.runTool(DELETE_PATCH)
      expect.unreachable()
    } catch (error) {
      expect((error as PatchError).code).toBe('UNSUPPORTED')
      expect((error as PatchError).message).toContain('shell')
    }
  })

  it('deleteBackend: none rejects delete/move with a structured error and keeps other ops working', async () => {
    const fs = new MemoryFs()
    fs.addFile('gone.txt', 'x\n')
    const shell = { resolve: (r: unknown) => r, run: async () => result(0) }
    const { resolveConfig } = await import('../src/config.js')
    const noneCfg = { ...resolveConfig({ deleteBackend: 'none', allowCodexPatch: true }) }
    const noneTool = buildApplyPatchTool('apply_patch', { fs, waterfall: async (_e: string, _t: unknown, _x: unknown, next: () => unknown) => next(), emit: () => {}, shell } as never, noneCfg)
    await expect(noneTool.execute({ patch: DELETE_PATCH }, shellExec())).rejects.toMatchObject({ code: 'UNSUPPORTED', message: /deleteBackend/ })
  })

  it('dialect resolution: auto follows win32, explicit overrides win', () => {
    const auto = resolveDialect(cfg())
    expect(auto).toBe(process.platform === 'win32' ? 'pwsh' : 'posix')
    const posix = resolveConfig({ shellDialect: 'posix' })
    expect(deleteTemplate(posix)).toBe(POSIX_REMOVE)
    expect(moveTemplate(posix)).toBe(POSIX_MOVE)
    const pwsh = resolveConfig({ shellDialect: 'pwsh' })
    expect(deleteTemplate(pwsh)).toBe(PWSH_REMOVE)
    expect(moveTemplate(pwsh)).toBe(PWSH_MOVE)
  })

  it('custom command templates are honored and still env-driven', async () => {
    const fs = new MemoryFs()
    fs.addFile('gone.txt', 'x\n')
    const requests: { command: string; env?: Record<string, string> }[] = []
    const shell = { resolve: (r: unknown) => r, run: async (r: { command: string; env?: Record<string, string> }) => { requests.push(r); return result(0) } }
    const custom = { ...cfg(), deleteCommand: 'myrm "$DSH_PATCH_TARGET"' }
    const tool = buildApplyPatchTool('apply_patch', { fs, waterfall: async (_e: string, _t: unknown, _x: unknown, next: () => unknown) => next(), emit: () => {}, shell } as never, custom)
    await tool.execute({ patch: DELETE_PATCH }, shellExec())
    expect(requests[0].command).toBe('myrm "$DSH_PATCH_TARGET"')
    expect(requests[0].env?.DSH_PATCH_TARGET).toBe('/work/gone.txt')
  })

  it('shell deletion requests carry the per-call sandboxPolicy slot', async () => {
    const fs = new MemoryFs()
    fs.addFile('gone.txt', 'x\n')
    const requests: Record<string, unknown>[] = []
    const shell = { resolve: (r: unknown) => r, run: async (r: Record<string, unknown>) => { requests.push(r); return result(0) } }
    const tool = makeShellTool(fs, shell)
    await tool.execute({ patch: DELETE_PATCH }, shellExec())
    expect('sandboxPolicy' in requests[0]).toBe(true)
    void (0 as unknown as ToolRunContext)
  })
})
