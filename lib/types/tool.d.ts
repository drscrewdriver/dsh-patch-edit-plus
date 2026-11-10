/**
 * The single model-facing `apply_patch` tool definition.
 *
 * The description carries the short routing line; the long-form guidance is a
 * system-prompt section (see guidance.ts) so it survives across turns instead
 * of only riding on the per-call tool schema. Before 0.2.2 no host shipped
 * either surface for `apply_patch`, which is why the plugin has to supply both.
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
/** Build the (frozen) tool definition. The tool name is passed in resolved
 * form so registration-side rename avoidance can mint variant names.
 * Returns `null` when the host line's dsh-tools lacks `defineTool` — the
 * caller skips registration instead of failing the loader entry.
 */
export declare function buildApplyPatchTool(toolName: string, ctx: Context, cfg: ResolvedConfig): ToolDefinition | null;
/** Model-facing text: grouped added → modified → deleted listing. */
export declare function formatResultText(value: ApplyPatchResult): string;
