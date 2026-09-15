import { describe, expect, it } from 'vitest'
import { makeRig } from './helpers.js'

describe('path safety (mutation tests)', () => {
  it('rejects ../ traversal out of the workspace', async () => {
    const rig = makeRig()
    const patch = '--- /work/../../etc/passwd\n+++ /work/../../etc/passwd\n@@ -1,1 +1,1 @@\n-root\n+cracked\n'
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'VALIDATION', message: /escapes the session workspace/ })
  })

  it('rejects codex traversal out of the workspace', async () => {
    const rig = makeRig({ allowCodexPatch: true })
    const patch = '*** Begin Patch\n*** Add File: ../../outside.txt\n+x\n*** End Patch\n'
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'VALIDATION', message: /escapes/ })
  })

  it('rejects an absolute path outside the workspace', async () => {
    const rig = makeRig()
    const patch = '--- /elsewhere/file.txt\n+++ /elsewhere/file.txt\n@@ -1,1 +1,1 @@\n-a\n+b\n'
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'VALIDATION', message: /escapes/ })
  })

  it('rejects a symlink leaf under followSymlinks: false', async () => {
    const rig = makeRig(undefined, {})
    rig.fs.addFile('real.txt', 'x\n')
    rig.fs.addSymlink('link.txt', 'real.txt')
    const patch = '--- a/link.txt\n+++ b/link.txt\n@@ -1,1 +1,1 @@\n-x\n+y\n'
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'VALIDATION', message: /symbolic link/ })
  })

  it('rejects a symlink ancestor', async () => {
    const rig = makeRig()
    rig.fs.addDir('/elsewhere')
    rig.fs.addSymlink('sneaky', '/elsewhere')
    const patch = '--- a/sneaky/f.txt\n+++ b/sneaky/f.txt\n@@ -1,1 +1,1 @@\n-a\n+b\n'
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'VALIDATION', message: /sneaky/ })
  })

  it('followSymlinks: true permits symlink paths', async () => {
    const rig = makeRig({ followSymlinks: true }, {})
    rig.fs.addFile('real.txt', 'x\n')
    rig.fs.addSymlink('link.txt', 'real.txt')
    const patch = '--- a/link.txt\n+++ b/link.txt\n@@ -1,1 +1,1 @@\n-x\n+y\n'
    await rig.runTool(patch)
    expect(rig.fs.files.get('/work/real.txt')).toBe('y\n')
  })
})
