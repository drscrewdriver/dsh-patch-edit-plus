import { describe, expect, it } from 'vitest'
import { makeRig } from './helpers.js'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'

/**
 * A policy service pinning `workspace-write` at `/work`.
 *
 * Containment is enforced by the mounted filesystem provider, not by a
 * planner-side fence, so "an escape is refused" is only meaningful with a
 * policy present — without one, nothing confines (which is exactly the host's
 * contract for an unsandboxed profile).
 * @returns the policy face a rig expects.
 */
function confinedAtWork(): { resolve: () => SandboxExecutionPolicy } {
  return { resolve: () => ({ mode: 'workspace-write', workspaceRoot: '/work' }) }
}

describe('path safety (mutation tests)', () => {
  // The file must EXIST so the plan reaches the mutation: the host's sandboxed
  // filesystem fences writes (`writeText`/`editText`/`patchText`/`deleteFile`/
  // move all go through `checkedTarget`) but NOT reads, so a missing file would
  // fail earlier as an `IO` read error and never exercise the policy.
  it('rejects ../ traversal out of the workspace', async () => {
    const rig = makeRig(undefined, { '/etc/passwd': 'root\n' }, confinedAtWork())
    const patch = '--- /work/../../etc/passwd\n+++ /work/../../etc/passwd\n@@ -1,1 +1,1 @@\n-root\n+cracked\n'
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'FS_SANDBOX_DENIED' })
  })

  it('rejects codex traversal out of the workspace', async () => {
    // The parent must exist, or the plan stops at `checkParent` (a missing
    // directory is a VALIDATION error raised before any mutation) and the
    // sandbox never gets to rule on the write.
    const rig = makeRig({ allowCodexPatch: true }, { '/outside.txt': 'x\n' }, confinedAtWork())
    const patch = '*** Begin Patch\n*** Update File: ../../outside.txt\n@@\n-x\n+y\n*** End Patch\n'
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'FS_SANDBOX_DENIED' })
  })

  it('rejects an absolute path outside the workspace', async () => {
    const rig = makeRig(undefined, { '/elsewhere/file.txt': 'a\n' }, confinedAtWork())
    const patch = '--- /elsewhere/file.txt\n+++ /elsewhere/file.txt\n@@ -1,1 +1,1 @@\n-a\n+b\n'
    await expect(rig.runTool(patch)).rejects.toMatchObject({ code: 'FS_SANDBOX_DENIED' })
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
