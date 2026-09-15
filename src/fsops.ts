/**
 * Filesystem seam: reads plus the official write-intent dance.
 *
 * DSH providers NEVER dispatch `fs/*` events — the tool layer is the only
 * initiator — so a bare `ctx.fs.writeText` would silently bypass the
 * read-before-write gate. Every write here therefore replicates the official
 * `write` tool verbatim:
 * 1. `ctx.waterfall('fs/write-intent', target, exec, () => undefined)`
 * 2. `ctx.fs.writeText(target, content, intent, exec.signal, sandboxPolicy)`
 * 3. `ctx.emit('fs/observed', target, { kind: 'present', version }, exec)`
 * With no policy plugin mounted the waterfall returns `undefined`, which is
 * itself the correct "unconditional write" probe.
 * @module dsh-patch-edit-plus/fsops
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { FsInfo, FsTarget, FsWriteOutcome } from '@deepseek-ai/dsh-fs'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import { ioError } from './errors.js'

/**
 * Write one file through the full intent dance. Must stay byte-for-byte the
 * official sequence — the verification script asserts it.
 * @throws {@link PatchError} code `IO` when the backend rejects the write.
 */
export async function writeFile(
  ctx: Context,
  exec: ToolRunContext,
  target: FsTarget,
  content: string,
  sandboxPolicy: SandboxExecutionPolicy | undefined,
): Promise<FsWriteOutcome> {
  try {
    const intent = await ctx.waterfall('fs/write-intent', target, exec, () => undefined)
    const outcome = await ctx.fs.writeText(target, content, intent, exec.signal, sandboxPolicy)
    ctx.emit('fs/observed', target, { kind: 'present', version: outcome.version }, exec)
    return outcome
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'PatchError') throw error
    throw ioError(`failed to write "${target.displayPath}"`, error)
  }
}

/** Read one file's text (whole file). */
export async function readFile(ctx: Context, exec: ToolRunContext, target: FsTarget): Promise<string> {
  try {
    return await ctx.fs.readText(target, exec.signal)
  } catch (error: unknown) {
    throw ioError(`failed to read "${target.displayPath}"`, error)
  }
}

/** Stat one resolved target; `undefined` when absent. */
export async function statFile(ctx: Context, exec: ToolRunContext, target: FsTarget): Promise<FsInfo | undefined> {
  try {
    return await ctx.fs.stat(target, exec.signal)
  } catch (error: unknown) {
    throw ioError(`failed to stat "${target.displayPath}"`, error)
  }
}
