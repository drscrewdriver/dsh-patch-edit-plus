import { describe, expect, it } from 'vitest'
import { makeRig } from './helpers.js'
import type { ApplyPatchResult } from '../src/tool.js'

const UNIFIED = ['--- a/a.txt', '+++ b/a.txt', '@@ -1,1 +1,1 @@', '-x', '+y'].join('\n')

describe('official write-intent dance', () => {
  it('calls waterfall → writeText → emit in order, passing the waterfall result as the 3rd writeText arg', async () => {
    const rig = makeRig(undefined, { 'a.txt': 'x\n' })
    await rig.runTool(UNIFIED)

    expect(rig.recorder.waterfalls).toHaveLength(1)
    expect(rig.recorder.waterfalls[0].event).toBe('fs/write-intent')
    expect((rig.recorder.waterfalls[0].target as { targetKey: string }).targetKey).toBe('/work/a.txt')
    // The exec passed to the waterfall carries the agent session (gate owner判定).
    expect(rig.recorder.waterfalls[0].exec).toBe(rig.exec)
    expect((rig.recorder.waterfalls[0].exec as { agent?: unknown }).agent).toBeDefined()

    expect(rig.fs.writeCalls).toHaveLength(1)
    const write = rig.fs.writeCalls[0]
    expect(write.key).toBe('/work/a.txt')
    expect(write.content).toBe('y\n')
    // intent === the waterfall's return value (undefined from the bare next()),
    // NOT an invented literal — the spy asserted the exact identity chain.
    expect(write.intent).toBeUndefined()

    expect(rig.recorder.emits).toHaveLength(1)
    expect(rig.recorder.emits[0].event).toBe('fs/observed')
    const [target, observation] = rig.recorder.emits[0].args
    expect((target as { targetKey: string }).targetKey).toBe('/work/a.txt')
    expect(observation).toMatchObject({ kind: 'present' })
    expect(typeof (observation as { version?: unknown }).version).toBe('string')
  })

  it('emits one write per changed file, not per hunk', async () => {
    const patch = [
      '--- a/multi.txt', '+++ b/multi.txt',
      '@@ -1,1 +1,1 @@', '-one', '+ONE',
      '@@ -3,1 +3,1 @@', '-three', '+THREE',
    ].join('\n')
    const rig = makeRig(undefined, { 'multi.txt': 'one\ntwo\nthree\n' })
    await rig.runTool(patch)
    expect(rig.fs.writeCalls).toHaveLength(1)
  })

  it('an intent returned by the policy waterfall is forwarded verbatim', async () => {
    const fs = makeRig(undefined, { 'a.txt': 'x\n' }).fs
    const intent = { kind: 'replaceIfVersion', version: 'v:test' }
    const writes: unknown[] = []
    const { buildApplyPatchTool } = await import('../src/tool.js')
    const { resolveConfig } = await import('../src/config.js')
    const cfg = resolveConfig(undefined)
    const tool = buildApplyPatchTool('apply_patch', {
      fs,
      waterfall: async () => intent,
      emit: () => {},
    } as never, cfg)
    const exec = makeRig().exec
    await tool.execute({ patch: UNIFIED }, exec)
    expect(fs.writeCalls[0].intent).toEqual(intent)
    void writes
  })

  it('a dry run never reaches the intent dance', async () => {
    const rig = makeRig(undefined, { 'a.txt': 'x\n' })
    await rig.runTool(UNIFIED, { dryRun: true })
    expect(rig.recorder.waterfalls).toHaveLength(0)
    expect(rig.fs.writeCalls).toHaveLength(0)
    expect(rig.recorder.emits).toHaveLength(0)
  })

  it('renders grouped Codex-semantics output', async () => {
    const rig = makeRig({ allowCodexPatch: true }, { 'm.txt': 'a\n', 'old.txt': 'old\n' })
    const patch = [
      '*** Begin Patch',
      '*** Add File: n.txt',
      '+x',
      '*** Update File: m.txt',
      '@@',
      '-a',
      '+b',
      '*** Delete File: old.txt',
      '*** End Patch',
    ].join('\n')
    const shell = { resolve: (r: unknown) => r, run: async (r: { command: string; env?: Record<string, string> }) => { rig.fs.files.delete(r.env?.DSH_PATCH_TARGET ?? ''); return { exitCode: 0, signal: null, timedOut: false, aborted: false, timeoutMs: 0, stdout: { text: '' }, stderr: { text: '' } } } }
    const { buildApplyPatchTool } = await import('../src/tool.js')
    const tool = buildApplyPatchTool('apply_patch', { fs: rig.fs, waterfall: async (_e: string, _t: unknown, _x: unknown, next: () => unknown) => next(), emit: () => {}, shell } as never, rig.cfg)
    const value = await tool.execute({ patch }, rig.exec) as ApplyPatchResult
    const rendered = tool.output?.render
    expect(typeof rendered).toBe('function')
    const text = (rendered as (_a: unknown, v: unknown) => { text: string }[])(null, value)[0].text
    const aIdx = text.indexOf('A n.txt')
    const mIdx = text.indexOf('M m.txt')
    const dIdx = text.indexOf('D old.txt')
    expect(aIdx).toBeGreaterThanOrEqual(0)
    expect(mIdx).toBeGreaterThan(aIdx)
    expect(dIdx).toBeGreaterThan(mIdx)
  })

  it('presentationMeta derives diffs purely from the value', async () => {
    const rig = makeRig(undefined, { 'a.txt': 'x\n' })
    const value = await rig.runTool(UNIFIED) as ApplyPatchResult
    const meta = (rig.tool.output as { presentationMeta: (a: unknown, v: unknown) => unknown }).presentationMeta(null, value)
    expect(meta).toEqual({ diffs: value.diffs })
    expect(value.diffs[0]).toMatchObject({ path: 'a.txt', oldText: 'x\n', newText: 'y\n' })
  })

  it('diffs over maxDiffBytes are emptied and marked truncated', async () => {
    const big = `${'content\n'.repeat(4000)}`
    const rig = makeRig({ maxDiffBytes: 256 }, { 'big.txt': big })
    const patch = '--- a/big.txt\n+++ b/big.txt\n@@ -1,1 +1,1 @@\n-content\n+CONTENT\n'
    const value = await rig.runTool(patch) as ApplyPatchResult
    expect(value.diffs[0].truncated).toBe(true)
    expect(value.diffs[0].oldText ?? '').toBe('')
    expect(value.diffs[0].newText).toBe('')
    // The write itself is unaffected by the presentation cap.
    expect(rig.fs.files.get('/work/big.txt')).toContain('CONTENT')
  })
})
