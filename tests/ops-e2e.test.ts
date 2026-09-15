import { describe, expect, it } from 'vitest'
import { makeRig } from './helpers.js'
import { PatchError } from '../src/errors.js'
import type { ApplyPatchResult } from '../src/tool.js'

const UNIFIED = [
  '--- a/a.txt', '+++ b/a.txt',
  '@@ -1,3 +1,3 @@', ' first', '-old', '+new', ' tail',
].join('\n')

describe('end-to-end operations', () => {
  it('applies a unified update via the full pipeline', async () => {
    const rig = makeRig(undefined, { 'a.txt': 'first\nold\ntail\n' })
    const value = await rig.runTool(UNIFIED) as ApplyPatchResult
    expect(value.applied).toBe(true)
    expect(value.format).toBe('unified')
    expect(value.files[0]).toMatchObject({ path: 'a.txt', action: 'modified' })
    expect(value.stats).toEqual({ files: 1, added: 1, removed: 1 })
    expect(rig.fs.files.get('/work/a.txt')).toBe('first\nnew\ntail\n')
  })

  it('applies a codex update when the style is enabled', async () => {
    const rig = makeRig({ allowCodexPatch: true }, { 'c.txt': 'keep\ngone\n' })
    const patch = ['*** Begin Patch', '*** Update File: c.txt', '@@', ' keep', '-gone', '+here', '*** End Patch'].join('\n')
    const value = await rig.runTool(patch) as ApplyPatchResult
    expect(value.format).toBe('codex')
    expect(rig.fs.files.get('/work/c.txt')).toBe('keep\nhere\n')
  })

  it('creates a file with add', async () => {
    const rig = makeRig({ allowCodexPatch: true })
    rig.fs.addDir('src')
    const patch = ['*** Begin Patch', '*** Add File: src/new.txt', '+line one', '+line two', '*** End Patch'].join('\n')
    const value = await rig.runTool(patch) as ApplyPatchResult
    expect(value.files[0]).toMatchObject({ path: 'src/new.txt', action: 'added' })
    expect(rig.fs.files.get('/work/src/new.txt')).toBe('line one\nline two\n')
  })

  it('deletes a file through the shell face', async () => {
    const rig = makeRig({ allowCodexPatch: true }, { 'bye.txt': 'x\n' })
    const calls: unknown[] = []
    const shell = { resolve: (r: unknown) => r, run: async (r: { command: string; env?: Record<string, string> }) => { rig.fs.files.delete(r.env?.DSH_PATCH_TARGET ?? ''); calls.push(r); return { exitCode: 0, signal: null, timedOut: false, aborted: false, timeoutMs: 0, stdout: { text: '' }, stderr: { text: '' } } } }
    const { buildApplyPatchTool } = await import('../src/tool.js')
    const tool = buildApplyPatchTool('apply_patch', { fs: rig.fs, waterfall: async (_e: string, _t: unknown, _x: unknown, next: () => unknown) => next(), emit: () => {}, shell } as never, rig.cfg)
    const patch = ['*** Begin Patch', '*** Delete File: bye.txt', '*** End Patch'].join('\n')
    const value = await tool.execute({ patch }, rig.exec) as ApplyPatchResult
    expect(value.files[0]).toMatchObject({ path: 'bye.txt', action: 'deleted' })
    expect(calls).toHaveLength(1)
    expect((calls[0] as { command: string }).command).toContain('DSH_PATCH_TARGET')
    expect(rig.fs.files.has('/work/bye.txt')).toBe(false)
  })

  it('moves a file via shell and rewrites content in one update op', async () => {
    const rig = makeRig({ allowCodexPatch: true }, { 'orig.txt': 'aaa\nbbb\n' })
    const moves: Record<string, string> = {}
    const shell = {
      resolve: (r: unknown) => r,
      run: async (r: { command: string; env: Record<string, string> }) => {
        moves[r.env.DSH_PATCH_SOURCE] = r.env.DSH_PATCH_TARGET
        const content = rig.fs.files.get(r.env.DSH_PATCH_SOURCE) ?? ''
        rig.fs.files.delete(r.env.DSH_PATCH_SOURCE)
        rig.fs.files.set(r.env.DSH_PATCH_TARGET, content)
        return { exitCode: 0, signal: null, timedOut: false, aborted: false, timeoutMs: 0, stdout: { text: '' }, stderr: { text: '' } }
      },
    }
    const { buildApplyPatchTool } = await import('../src/tool.js')
    const tool = buildApplyPatchTool('apply_patch', { fs: rig.fs, waterfall: async (_e: string, _t: unknown, _x: unknown, next: () => unknown) => next(), emit: () => {}, shell } as never, rig.cfg)
    const patch = ['*** Begin Patch', '*** Update File: orig.txt', '*** Move to: moved.txt', '@@', '-aaa', '+AAA', '*** End Patch'].join('\n')
    const value = await tool.execute({ patch }, rig.exec) as ApplyPatchResult
    expect(value.files[0]).toMatchObject({ path: 'moved.txt', action: 'modified', from: 'orig.txt' })
    expect(moves['/work/orig.txt']).toBe('/work/moved.txt')
    expect(rig.fs.files.get('/work/moved.txt')).toBe('AAA\nbbb\n')
  })

  it('dryRun leaves the disk untouched and reports applicability', async () => {
    const rig = makeRig(undefined, { 'a.txt': 'first\nold\ntail\n' })
    const value = await rig.runTool(UNIFIED, { dryRun: true }) as ApplyPatchResult
    expect(value.applied).toBe(false)
    expect(value.summary).toContain('Dry run')
    expect(rig.fs.files.get('/work/a.txt')).toBe('first\nold\ntail\n')
  })

  it('multi-hunk update with drift applies at located positions', async () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`)
    lines[9] = 'target one'
    lines[29] = 'target two'
    const rig = makeRig(undefined, { 'big.txt': `${lines.join('\n')}\n` })
    const patch = [
      '--- a/big.txt', '+++ b/big.txt',
      '@@ -10,1 +10,1 @@', '-target one', '+CHANGED ONE',
      '@@ -30,1 +30,1 @@', '-target two', '+CHANGED TWO',
    ].join('\n')
    await rig.runTool(patch)
    const after = (rig.fs.files.get('/work/big.txt') ?? '').split('\n')
    expect(after[9]).toBe('CHANGED ONE')
    expect(after[29]).toBe('CHANGED TWO')
    expect(after.length).toBe(41) // 40 lines + the trailing-newline artifact
  })

  it('preserves CRLF style and no-trailing-newline state', async () => {
    const rig = makeRig(undefined, { 'win.txt': 'a\r\nb\r\nc\r\n' })
    const patch = '--- a/win.txt\n+++ b/win.txt\n@@ -2,1 +2,1 @@\n-b\n+B\n'
    await rig.runTool(patch)
    expect(rig.fs.files.get('/work/win.txt')).toBe('a\r\nB\r\nc\r\n')
  })

  it('keeps the no-trailing-newline state when a context line is the untouched tail', async () => {
    const rig = makeRig(undefined, { 'noeol.txt': 'x\ny' })
    const patch = '--- a/noeol.txt\n+++ b/noeol.txt\n@@ -1,2 +1,2 @@\n-x\n+X\n y\n'
    await rig.runTool(patch)
    expect(rig.fs.files.get('/work/noeol.txt')).toBe('X\ny')
  })

  it('a marker-less update of the last line adds the trailing newline (git semantics)', async () => {
    const rig = makeRig(undefined, { 'noeol.txt': 'x\ny' })
    const patch = '--- a/noeol.txt\n+++ b/noeol.txt\n@@ -2,1 +2,1 @@\n-y\n+Y\n'
    await rig.runTool(patch)
    expect(rig.fs.files.get('/work/noeol.txt')).toBe('x\nY\n')
  })

  it('add onto an existing file is a structured conflict', async () => {
    const rig = makeRig({ allowCodexPatch: true }, { 'exists.txt': 'x\n' })
    const patch = ['*** Begin Patch', '*** Add File: exists.txt', '+x', '*** End Patch'].join('\n')
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'CONFLICT', message: /already exists/ })
  })

  it('add with a missing parent directory names the missing directory', async () => {
    const rig = makeRig({ allowCodexPatch: true })
    const patch = ['*** Begin Patch', '*** Add File: no/such/dir/f.txt', '+x', '*** End Patch'].join('\n')
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'VALIDATION', message: /no\/such\/dir/ })
  })

  it('delete of a missing file is a structured conflict', async () => {
    const rig = makeRig({ allowCodexPatch: true })
    const patch = ['*** Begin Patch', '*** Delete File: ghost.txt', '*** End Patch'].join('\n')
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'UNSUPPORTED', message: /shell capability/ })
    // With a shell mounted the missing file becomes a CONFLICT at verify time.
    const shell = { resolve: (r: unknown) => r, run: async () => ({ exitCode: 0, signal: null, timedOut: false, aborted: false, timeoutMs: 0, stdout: { text: '' }, stderr: { text: '' } }) }
    const { buildApplyPatchTool } = await import('../src/tool.js')
    const tool = buildApplyPatchTool('apply_patch', { fs: rig.fs, waterfall: async (_e: string, _t: unknown, _x: unknown, next: () => unknown) => next(), emit: () => {}, shell } as never, rig.cfg)
    await expect(tool.execute({ patch }, rig.exec)).rejects.toMatchObject({ code: 'CONFLICT', message: /does not exist/ })
  })

  it('empty or non-string patch is structurally rejected', async () => {
    const rig = makeRig()
    await expect(rig.runTool('')).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(rig.runTool('   ')).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(rig.runTool('hello world\n')).rejects.toMatchObject({ code: 'PARSE' })
  })

  it('a recognized codex patch while disabled returns the actionable hint', async () => {
    const rig = makeRig({ allowCodexPatch: false })
    const patch = ['*** Begin Patch', '*** Add File: a.txt', '+x', '*** End Patch'].join('\n')
    try {
      await rig.runTool(patch)
      expect.unreachable()
    } catch (error) {
      expect((error as PatchError).code).toBe('UNSUPPORTED')
      expect((error as PatchError).message).toContain('allowCodexPatch: true')
    }
  })

  it('exceeding maxPatchBytes is rejected with the limit', async () => {
    const rig = makeRig({ maxPatchBytes: 32 })
    await expect(rig.runTool('x'.repeat(64))).rejects.toMatchObject({ code: 'LIMIT', message: /32/ })
  })

  it('whitespace-only text falls through to the structured empty-patch rejection', async () => {
    const rig = makeRig()
    await expect(rig.runTool('\n\n')).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
