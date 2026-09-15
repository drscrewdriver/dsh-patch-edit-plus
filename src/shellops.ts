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

import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import type { ShellExecRequest, ShellExecutor, ShellRunResult } from '@deepseek-ai/dsh-shell'
import type { ResolvedConfig } from './config.js'
import { PatchError, unsupportedShellError } from './errors.js'

/** Constant POSIX templates; paths arrive via env, never via interpolation. */
export const POSIX_REMOVE = 'rm -f -- "$DSH_PATCH_TARGET"'
export const POSIX_MOVE = 'mv -f -- "$DSH_PATCH_SOURCE" "$DSH_PATCH_TARGET"'
/** Constant PowerShell templates (Windows default). */
export const PWSH_REMOVE = 'Remove-Item -LiteralPath $env:DSH_PATCH_TARGET -Force'
export const PWSH_MOVE = 'Move-Item -LiteralPath $env:DSH_PATCH_SOURCE -Destination $env:DSH_PATCH_TARGET -Force'

const SHELL_TIMEOUT_MS = 30_000

export type Dialect = 'posix' | 'pwsh'

/** Resolve the configured dialect; `auto` picks pwsh on win32, posix elsewhere. */
export function resolveDialect(cfg: ResolvedConfig): Dialect {
  if (cfg.shellDialect === 'auto') return process.platform === 'win32' ? 'pwsh' : 'posix'
  return cfg.shellDialect
}

/** The constant delete template for the resolved dialect (config override wins). */
export function deleteTemplate(cfg: ResolvedConfig): string {
  return cfg.deleteCommand ?? (resolveDialect(cfg) === 'pwsh' ? PWSH_REMOVE : POSIX_REMOVE)
}

/** The constant move template for the resolved dialect (config override wins). */
export function moveTemplate(cfg: ResolvedConfig): string {
  return cfg.moveCommand ?? (resolveDialect(cfg) === 'pwsh' ? PWSH_MOVE : POSIX_MOVE)
}

/** Structurally resolve `ctx.shell` without assuming the service is mounted. */
export function resolveShell(ctx: Context): ShellExecutor | undefined {
  try {
    const shell = (ctx as unknown as { shell?: ShellExecutor }).shell
    return shell !== undefined && typeof shell.run === 'function' && typeof shell.resolve === 'function' ? shell : undefined
  } catch {
    return undefined
  }
}

/** True when Delete/Move can run at all under the current configuration. */
export function shellReady(ctx: Context, cfg: ResolvedConfig): boolean {
  return cfg.deleteBackend === 'shell' && resolveShell(ctx) !== undefined
}

/** Throw the precise structured UNSUPPORTED error when Delete/Move cannot run. */
export function assertShellReady(ctx: Context, cfg: ResolvedConfig): void {
  if (cfg.deleteBackend !== 'shell') {
    throw unsupportedShellError('Delete/Move operations are disabled by configuration (deleteBackend: "none").')
  }
  if (resolveShell(ctx) === undefined) {
    throw unsupportedShellError('Delete/Move operations need a shell capability, but no shell executor is mounted in this session.')
  }
}

/** Remove one file via the sandbox-aware shell. */
export async function removeFile(ctx: Context, exec: ToolRunContext, cfg: ResolvedConfig, target: FsTarget, sandboxPolicy: SandboxExecutionPolicy | undefined): Promise<void> {
  const shell = requireShell(ctx, cfg)
  const request: ShellExecRequest = {
    command: deleteTemplate(cfg),
    env: { DSH_PATCH_TARGET: ctx.fs.processPath(target) },
    signal: exec.signal,
    timeoutMs: SHELL_TIMEOUT_MS,
    sandboxPolicy,
  }
  const result = await runShell(shell, request)
  interpretResult(result, 'delete', target.displayPath)
}

/** Move (rename) one file via the sandbox-aware shell. */
export async function moveFile(ctx: Context, exec: ToolRunContext, cfg: ResolvedConfig, source: FsTarget, target: FsTarget, sandboxPolicy: SandboxExecutionPolicy | undefined): Promise<void> {
  const shell = requireShell(ctx, cfg)
  const request: ShellExecRequest = {
    command: moveTemplate(cfg),
    env: { DSH_PATCH_SOURCE: ctx.fs.processPath(source), DSH_PATCH_TARGET: ctx.fs.processPath(target) },
    signal: exec.signal,
    timeoutMs: SHELL_TIMEOUT_MS,
    sandboxPolicy,
  }
  const result = await runShell(shell, request)
  interpretResult(result, 'move', `${source.displayPath} -> ${target.displayPath}`)
}

function requireShell(ctx: Context, cfg: ResolvedConfig): ShellExecutor {
  assertShellReady(ctx, cfg)
  return resolveShell(ctx) as ShellExecutor
}

async function runShell(shell: ShellExecutor, request: ShellExecRequest): Promise<ShellRunResult> {
  try {
    return await shell.run(shell.resolve(request))
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new PatchError('IO', `shell execution failed: ${detail}`)
  }
}

/** Distinguish "sandbox policy denied" from "the command itself failed". */
function interpretResult(result: ShellRunResult, verb: string, subject: string): void {
  if (result.sandbox?.denied === true) {
    const mode = result.sandbox.mode ?? 'unknown'
    throw new PatchError(
      'VALIDATION',
      `The sandbox denied the ${verb} of "${subject}" (mode: ${mode}). `
        + 'The path is likely outside the writable workspace. Ask the user for a wider permission preset, or apply the change manually.',
    )
  }
  if (result.aborted || result.signal !== null) {
    throw new PatchError('IO', `The ${verb} of "${subject}" was aborted before it completed.`)
  }
  if (result.exitCode !== 0) {
    const stderrTail = result.stderr.text.trim().split('\n').at(-1) ?? ''
    throw new PatchError('IO', `The ${verb} of "${subject}" failed with exit code ${result.exitCode ?? 'null'}${stderrTail === '' ? '' : `: ${stderrTail.slice(0, 200)}`}`)
  }
}
