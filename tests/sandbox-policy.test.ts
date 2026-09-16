/**
 * The per-call sandbox policy: `apply_patch` must be fenced exactly like the
 * native `write`/`edit` tools.
 *
 * Regression guard for the reported failure: with NO policy on the call, the
 * enforcing filesystem falls back to `ctx.sandboxPolicy.resolve()` with no
 * scope, which resolves the DEPLOYMENT workspace root (the server's launch
 * directory) rather than the session cwd — so a `danger-full-access` session
 * saw every apply_patch write refused as `workspace-write`.
 */
import { describe, expect, it } from 'vitest'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import { makeRig } from './helpers.js'
import { resolveSandboxPolicy, resolveSandboxPolicyService } from '../src/policy.js'
import type { SandboxPolicyFace } from '../src/policy.js'

const UNIFIED = ['--- a/a.txt', '+++ b/a.txt', '@@ -1,1 +1,1 @@', '-x', '+y'].join('\n')

/** A recording policy service: remembers the scope of every resolve() and returns a fixed policy. */
function makePolicyService(policy: SandboxExecutionPolicy): { face: SandboxPolicyFace; scopes: unknown[] } {
  const scopes: unknown[] = []
  return {
    scopes,
    face: {
      resolve(request?: { session?: unknown }): SandboxExecutionPolicy {
        scopes.push(request)
        return policy
      },
    },
  }
}

describe('apply_patch carries the per-call sandbox policy', () => {
  it('resolves the policy with the calling session in scope and forwards that exact policy to the write', async () => {
    const policy: SandboxExecutionPolicy = { mode: 'danger-full-access', workspaceRoot: '/work' }
    const service = makePolicyService(policy)
    const rig = makeRig(undefined, { 'a.txt': 'x\n' }, service.face)

    await rig.runTool(UNIFIED)

    expect(service.scopes).toHaveLength(1)
    expect((service.scopes[0] as { session?: unknown }).session).toBe(rig.exec.agent?.session)
    // Identity, not equality: the backend must receive the resolved policy itself.
    expect(rig.fs.writeCalls).toHaveLength(1)
    expect(rig.fs.writeCalls[0].sandboxPolicy).toBe(policy)
  })

  it('an agentless call resolves the unscoped deployment policy', async () => {
    const policy: SandboxExecutionPolicy = { mode: 'workspace-write', workspaceRoot: '/work' }
    const service = makePolicyService(policy)
    const rig = makeRig(undefined, { 'a.txt': 'x\n' }, service.face)
    const agentless = { ...rig.exec, agent: undefined }

    expect(resolveSandboxPolicy({ get: () => service.face } as never, agentless)).toBe(policy)
    expect(service.scopes[0]).toBeUndefined()
  })

  it("resolves every path against the policy's workspace root, not the session cwd", async () => {
    // A policy root that differs from the session cwd: the plan must follow the
    // root the fence will measure, or planned and fenced paths disagree.
    const policy: SandboxExecutionPolicy = { mode: 'workspace-write', workspaceRoot: '/elsewhere' }
    const service = makePolicyService(policy)
    const rig = makeRig(undefined, { '/elsewhere/a.txt': 'x\n' }, service.face)

    await rig.runTool(UNIFIED)

    expect(rig.exec.agent?.session.header.cwd).toBe('/work')
    expect(rig.fs.writeCalls).toHaveLength(1)
    expect(rig.fs.writeCalls[0].key).toBe('/elsewhere/a.txt')
    expect(rig.fs.writeCalls[0].content).toBe('y\n')
  })

  it('carries the same policy into the shell request used by Delete/Move', async () => {
    const policy: SandboxExecutionPolicy = { mode: 'danger-full-access', workspaceRoot: '/work' }
    const service = makePolicyService(policy)
    const rig = makeRig({ allowCodexPatch: true }, { 'old.txt': 'old\n' }, service.face)
    const requests: { sandboxPolicy?: unknown; command: string }[] = []
    const shell = {
      resolve: (request: unknown) => request,
      run: async (request: { sandboxPolicy?: unknown; command: string }) => {
        requests.push(request)
        rig.fs.files.delete('/work/old.txt')
        return { exitCode: 0, signal: null, timedOut: false, aborted: false, timeoutMs: 0, stdout: { text: '' }, stderr: { text: '' } }
      },
    }
    const { buildApplyPatchTool } = await import('../src/tool.js')
    const tool = buildApplyPatchTool('apply_patch', {
      fs: rig.fs,
      waterfall: async (_event: string, _target: unknown, _exec: unknown, next: () => unknown) => next(),
      emit: () => {},
      get: (name: string) => (name === 'sandboxPolicy' ? service.face : undefined),
      shell,
    } as never, rig.cfg)

    await tool.execute({ patch: '*** Begin Patch\n*** Delete File: old.txt\n*** End Patch' }, rig.exec)

    expect(requests).toHaveLength(1)
    expect(requests[0].sandboxPolicy).toBe(policy)
  })

  it('an unsandboxed profile (no policy owner mounted) still writes, with no policy stamped', async () => {
    const rig = makeRig(undefined, { 'a.txt': 'x\n' })

    await rig.runTool(UNIFIED)

    expect(rig.fs.writeCalls).toHaveLength(1)
    expect(rig.fs.writeCalls[0].sandboxPolicy).toBeUndefined()
  })

  it('structural service resolution never throws on a bare or hostile context', () => {
    expect(resolveSandboxPolicyService({} as never)).toBeUndefined()
    expect(resolveSandboxPolicyService({ get: () => undefined } as never)).toBeUndefined()
    expect(resolveSandboxPolicyService({ get: () => 'not-a-service' } as never)).toBeUndefined()
    expect(resolveSandboxPolicyService({ get: () => { throw new Error('no such service') } } as never)).toBeUndefined()
  })
})
