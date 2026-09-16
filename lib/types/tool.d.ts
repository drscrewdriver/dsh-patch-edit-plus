/**
 * The single model-facing `apply_patch` tool definition.
 *
 * The description carries an explicit routing guide so the model reaches for
 * the native `edit` tool on cheap single-point changes instead of paying for
 * a patch, and reserves `apply_patch` for large-file small edits, cross-file
 * batch edits, creation, deletion and renames.
 * @module dsh-patch-edit-plus/tool
 */
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { Context } from '@deepseek-ai/cordis';
import type { ResolvedConfig } from './config.js';
import type { FileAction } from './parse/types.js';
/** Per-file diff carried in the canonical value (replay-safe presentationMeta source). */
export type ResultDiff = {
    path: string;
    oldText: string | null;
    newText: string;
    /** True when the diff was dropped because of `maxDiffBytes`. */
    truncated?: boolean;
};
/** Canonical tool output value. */
export type ApplyPatchResult = {
    format: 'unified' | 'codex';
    applied: boolean;
    summary: string;
    files: {
        path: string;
        action: FileAction;
        from?: string;
    }[];
    stats: {
        files: number;
        added: number;
        removed: number;
    };
    wallTimeMs: number;
    diffs: ResultDiff[];
};
/**
 * Build the (frozen) tool definition. The tool name is passed in resolved
 * form so registration-side rename avoidance can mint variant names.
 */
export declare function buildApplyPatchTool(toolName: string, ctx: Context, cfg: ResolvedConfig): ToolDefinition;
/** Model-facing text: grouped added → modified → deleted listing. */
export declare function formatResultText(value: ApplyPatchResult): string;
