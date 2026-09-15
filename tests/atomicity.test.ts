import { describe, expect, it } from 'vitest'
import { makeRig } from './helpers.js'
import { PatchError } from '../src/errors.js'

describe('atomicity (mutation tests)', () => {
  it('breaking the 2nd hunk of a multi-file patch leaves every file byte-identical', async () => {
    const files = {
      'one.txt': 'aaa\nbbb\nccc\n',
      'two.txt': '111\n222\n333\n',
    }
    const rig = makeRig({ allowCodexPatch: true }, files)
    const snapshot = new Map(rig.fs.files)
    const patch = [
      '*** Begin Patch',
      '*** Update File: one.txt',
      '@@',
      ' aaa',
      '-bbb',
      '+BBB',
      '*** Update File: two.txt',
      '@@',
      ' 111',
      '-WRONG',
      '+999',
      '*** End Patch',
    ].join('\n')
    try {
      await rig.runTool(patch)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(PatchError)
      expect((error as PatchError).message).toContain('two.txt')
    }
    expect([...rig.fs.files]).toEqual([...snapshot])
    expect(rig.fs.writeCalls).toHaveLength(0)
  })

  it('the same path hit by two ops is rejected with zero writes', async () => {
    const rig = makeRig({ allowCodexPatch: true }, { 'dup.txt': 'x\n' })
    const patch = [
      '*** Begin Patch',
      '*** Update File: dup.txt',
      '@@',
      '-x',
      '+y',
      '*** Delete File: dup.txt',
      '*** End Patch',
    ].join('\n')
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'CONFLICT', message: /more than one/ })
    expect(rig.fs.files.get('/work/dup.txt')).toBe('x\n')
  })

  it('a failing write in the apply phase surfaces as IO', async () => {
    const rig = makeRig(undefined, { 'a.txt': 'x\n' })
    rig.fs.failNextWrite = new Error('disk on fire')
    await expect(rig.runTool('--- a/a.txt\n+++ b/a.txt\n@@ -1,1 +1,1 @@\n-x\n+y\n')).rejects.toMatchObject({ code: 'IO', message: /disk on fire/ })
  })

  it('an aborted signal fails fast', async () => {
    const rig = makeRig(undefined, { 'a.txt': 'x\n' })
    const controller = new AbortController()
    controller.abort()
    ;(rig.exec as { signal: AbortSignal }).signal = controller.signal
    await expect(rig.runTool('--- a/a.txt\n+++ b/a.txt\n@@ -1,1 +1,1 @@\n-x\n+y\n')).rejects.toBeDefined()
  })
})
