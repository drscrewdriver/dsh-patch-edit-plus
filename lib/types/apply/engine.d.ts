/**
 * Two-phase atomic application engine.
 *
 * Phase 1 (verify) reads every target and computes the full in-memory result;
 * ANY failure aborts the whole patch with zero bytes written. Phase 2 (apply)
 * only writes what verify already validated.
 * @module dsh-patch-edit-plus/apply/engine
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox';
import type { ResolvedConfig } from '../config.js';
import type { Hunk } from '../parse/types.js';
import { consumedLines } from './seek.js';
import type { PlannedEntry, PlannedPatch } from './plan.js';
/** One verified, ready-to-write change. */
export interface VerifiedChange {
    entry: PlannedEntry;
    /** Original content; `null` for adds. */
    before: string | null;
    /** Computed new content; `null` for deletes. */
    after: string | null;
}
/**
 * Verify the whole patch: read every file, locate every hunk, compute every
 * result. Throws on the first failure — nothing has been written.
 */
export declare function verifyPatch(ctx: Context, exec: ToolRunContext, plan: PlannedPatch, cfg: ResolvedConfig): Promise<VerifiedChange[]>;
/** Apply phase: writes only — verify already settled every decision. */
export declare function applyPatch(ctx: Context, exec: ToolRunContext, changes: readonly VerifiedChange[], cfg: ResolvedConfig, sandboxPolicy: SandboxExecutionPolicy | undefined): Promise<void>;
/** Pure-move entries (update with moveTo and no hunks) skip the write. */
export declare function isPureMove(change: VerifiedChange): boolean;
/**
 * Apply hunks to raw file content with newline fidelity: CRLF files are
 * normalized for matching and written back in their original style; the
 * trailing-newline state of the file tail is preserved exactly.
 */
export declare function applyHunksToContent(path: string, before: string, hunks: readonly Hunk[]): string;
export { consumedLines };
