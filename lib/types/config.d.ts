/**
 * Plugin configuration: Schemastery schema + resolved defaults.
 *
 * Every knob the tool honors lives here; the tool body only ever reads the
 * fully-resolved `ResolvedConfig` produced by `resolveConfig`.
 * @module dsh-patch-edit-plus/config
 */
import z from '@deepseek-ai/schemastery';
/** What to do when the configured tool name is already taken at registration. */
export type ConflictPolicy = 'rename' | 'skip' | 'fail';
/** Backend used for Delete/Move operations (`ctx.fs` has no delete/move). */
export type DeleteBackend = 'shell' | 'none';
/** Shell command dialect for the constant delete/move templates. */
export type ShellDialect = 'auto' | 'posix' | 'pwsh';
/** Deployment-owned configuration. */
export interface Config {
    /** Model-facing tool name. Defaults to `apply_patch`. */
    toolName?: string;
    /** Behavior when the tool name is already registered. Defaults to `rename`. */
    conflictPolicy?: ConflictPolicy;
    /** Suffix appended on rename avoidance. Defaults to `_1`. */
    renameSuffix?: string;
    /** Accept git/unified diff patches. Defaults to true. */
    allowUnifiedDiff?: boolean;
    /** Accept Codex `apply_patch` syntax. Defaults to false. */
    allowCodexPatch?: boolean;
    /** Delete/Move backend. Defaults to `shell`. `none` rejects Delete/Move with a structured error. */
    deleteBackend?: DeleteBackend;
    /** Shell dialect for the constant delete/move templates. Defaults to `auto` (pwsh on win32). */
    shellDialect?: ShellDialect;
    /** Custom delete command template; paths still arrive only via env `DSH_PATCH_TARGET`. */
    deleteCommand?: string;
    /** Custom move command template; paths arrive via env `DSH_PATCH_SOURCE`/`DSH_PATCH_TARGET`. */
    moveCommand?: string;
    /** Treat `apply_patch` calls as dry runs unless the call passes `dryRun: false`. Defaults to false. */
    dryRunByDefault?: boolean;
    /** Allow patch paths to traverse symbolic links. Defaults to false (symlinks are rejected). */
    followSymlinks?: boolean;
    /** Maximum file sections per patch. Defaults to 50. */
    maxFiles?: number;
    /** Maximum patch text size in bytes. Defaults to 524288 (512 KiB). */
    maxPatchBytes?: number;
    /** Maximum per-file diff size in bytes carried in the result metadata. Defaults to 16384. */
    maxDiffBytes?: number;
}
/** Schemastery schema for Loader defaults and generated configuration docs. */
export declare const Config: z<Config>;
/** Fully-resolved configuration used by the tool body. */
export interface ResolvedConfig {
    toolName: string;
    conflictPolicy: ConflictPolicy;
    renameSuffix: string;
    allowUnifiedDiff: boolean;
    allowCodexPatch: boolean;
    deleteBackend: DeleteBackend;
    shellDialect: ShellDialect;
    deleteCommand?: string;
    moveCommand?: string;
    dryRunByDefault: boolean;
    followSymlinks: boolean;
    maxFiles: number;
    maxPatchBytes: number;
    maxDiffBytes: number;
}
/** Fill user config with defaults; `undefined`/null entries fall back too. */
export declare function resolveConfig(config: Config | undefined): ResolvedConfig;
