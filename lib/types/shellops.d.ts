/**
 * Shell seam for Delete / Move (the `ctx.fs` contract has no delete/rename).
 *
 * Security posture:
 * - Command templates are CONSTANTS; paths travel only via the environment
 *   (`DSH_PATCH_SOURCE` / `DSH_PATCH_TARGET`), never interpolated into the
 *   command string — shell metacharacters in a path cannot inject commands.
 * - Every run carries a `sandboxPolicy` so sandboxing executors fence it, and
 *   the reported `ShellSandboxInfo` distinguishes "policy denied" from
 *   "command failed".
 * @module dsh-patch-edit-plus/shellops
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { FsTarget } from '@deepseek-ai/dsh-fs';
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox';
import type { ShellExecutor } from '@deepseek-ai/dsh-shell';
import type { ResolvedConfig } from './config.js';
/** Constant POSIX templates; paths arrive via env, never via interpolation. */
export declare const POSIX_REMOVE = "rm -f -- \"$DSH_PATCH_TARGET\"";
export declare const POSIX_MOVE = "mv -f -- \"$DSH_PATCH_SOURCE\" \"$DSH_PATCH_TARGET\"";
/** Constant PowerShell templates (Windows default). */
export declare const PWSH_REMOVE = "Remove-Item -LiteralPath $env:DSH_PATCH_TARGET -Force";
export declare const PWSH_MOVE = "Move-Item -LiteralPath $env:DSH_PATCH_SOURCE -Destination $env:DSH_PATCH_TARGET -Force";
export type Dialect = 'posix' | 'pwsh';
/** Resolve the configured dialect; `auto` picks pwsh on win32, posix elsewhere. */
export declare function resolveDialect(cfg: ResolvedConfig): Dialect;
/** The constant delete template for the resolved dialect (config override wins). */
export declare function deleteTemplate(cfg: ResolvedConfig): string;
/** The constant move template for the resolved dialect (config override wins). */
export declare function moveTemplate(cfg: ResolvedConfig): string;
/** Structurally resolve `ctx.shell` without assuming the service is mounted. */
export declare function resolveShell(ctx: Context): ShellExecutor | undefined;
/** True when Delete/Move can run at all under the current configuration. */
export declare function shellReady(ctx: Context, cfg: ResolvedConfig): boolean;
/** Throw the precise structured UNSUPPORTED error when Delete/Move cannot run. */
export declare function assertShellReady(ctx: Context, cfg: ResolvedConfig): void;
/** Remove one file via the sandbox-aware shell. */
export declare function removeFile(ctx: Context, exec: ToolRunContext, cfg: ResolvedConfig, target: FsTarget, sandboxPolicy: SandboxExecutionPolicy | undefined): Promise<void>;
/** Move (rename) one file via the sandbox-aware shell. */
export declare function moveFile(ctx: Context, exec: ToolRunContext, cfg: ResolvedConfig, source: FsTarget, target: FsTarget, sandboxPolicy: SandboxExecutionPolicy | undefined): Promise<void>;
