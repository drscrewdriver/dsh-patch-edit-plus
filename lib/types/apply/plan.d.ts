/**
 * Operation planning: path resolution, workspace containment, symlink policy
 * and duplicate detection. Pure resolution work — no file content is read
 * here (the engine's verify stage does that).
 * @module dsh-patch-edit-plus/apply/plan
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { FsTarget } from '@deepseek-ai/dsh-fs';
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox';
import type { ResolvedConfig } from '../config.js';
import type { ParsedPatch, PatchOp } from '../parse/types.js';
/** One planned, fully-resolved operation. */
export interface PlannedEntry {
    op: PatchOp;
    /** Resolved target of `op.path`. */
    target: FsTarget;
    /** Resolved move destination, when the operation renames/moves the file. */
    moveToTarget?: FsTarget;
}
/** A fully planned patch: every path resolved and validated, nothing touched. */
export interface PlannedPatch {
    format: 'unified' | 'codex';
    entries: PlannedEntry[];
}
/**
 * Plan a parsed patch against the filesystem backend.
 * @param sandboxPolicy - the per-call policy the mutations will carry; its
 *   workspace root, when set, is the resolution cwd AND the containment root, so
 *   the path the engine writes is exactly the path the fence will measure.
 * @throws {@link PatchError} on limits, path escapes, symlinks, missing parents or duplicate targets.
 */
export declare function buildPlan(ctx: Context, exec: ToolRunContext, parsed: ParsedPatch, cfg: ResolvedConfig, sandboxPolicy?: SandboxExecutionPolicy): Promise<PlannedPatch>;
/** True when the operation needs the shell backend (delete or move). */
export declare function needsShell(op: PatchOp): boolean;
