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
import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { FsInfo, FsTarget, FsWriteOutcome } from '@deepseek-ai/dsh-fs';
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox';
/**
 * Write one file through the full intent dance. Must stay byte-for-byte the
 * official sequence — the verification script asserts it.
 * @throws {@link PatchError} code `IO` when the backend rejects the write.
 */
export declare function writeFile(ctx: Context, exec: ToolRunContext, target: FsTarget, content: string, sandboxPolicy: SandboxExecutionPolicy | undefined): Promise<FsWriteOutcome>;
/** Read one file's text (whole file). */
export declare function readFile(ctx: Context, exec: ToolRunContext, target: FsTarget): Promise<string>;
/** Stat one resolved target; `undefined` when absent. */
export declare function statFile(ctx: Context, exec: ToolRunContext, target: FsTarget): Promise<FsInfo | undefined>;
