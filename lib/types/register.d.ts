/**
 * Tool registration with three-layer name-conflict protection.
 *
 * Layer 1: probe `ctx.tools.get(name)` before building the definition.
 * Layer 2: `conflictPolicy` — `rename` (default) retries suffixed names,
 * `skip` logs and loads without the tool, `fail` throws.
 * Layer 3: `try/catch` around `register()` because get-then-register races.
 * @module dsh-patch-edit-plus/register
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ResolvedConfig } from './config.js';
/** A logger face; falls back to no-ops when the host exposes none. */
export interface LoggerFace {
    info?(message: string): void;
    warn?(message: string): void;
    error?(message: string): void;
}
/**
 * Resolve an unused tool name and register the frozen definition.
 * @returns the registration disposer, or `null` when registration was skipped.
 * @throws {@link PatchError} only under `conflictPolicy: 'fail'`.
 */
export declare function registerApplyPatchTool(ctx: Context, cfg: ResolvedConfig, logger?: LoggerFace): (() => void) | null;
