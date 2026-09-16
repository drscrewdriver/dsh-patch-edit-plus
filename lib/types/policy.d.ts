/**
 * Sandbox-policy seam: the per-call policy every mutation must carry.
 *
 * `ctx.fs.writeText` and a shell run both take an OPTIONAL `sandboxPolicy`, and
 * omitting it is not "no policy" — the enforcing backends fall back to
 * `ctx.sandboxPolicy.resolve()` with NO scope, which resolves the DEPLOYMENT
 * defaults: the configured fallback workspace root (the server's launch
 * directory) rather than this call's session cwd, plus the deployment default
 * mode rather than the session's `sandbox/mode` override.
 *
 * That fallback is what made every `apply_patch` write fail with
 * `file access denied under workspace-write mode` in a `danger-full-access`
 * session: the fenced path was inside the session workspace, but containment
 * was measured against the launch directory. The error text names the wrong
 * party, so the failure reads like a bad path rather than a lost policy.
 *
 * The official `write`/`edit` tools avoid it by resolving the policy PER CALL
 * with the calling session in scope, which stamps both the session's mode
 * override and `session.header.cwd` as the workspace root. This module does the
 * same, so `apply_patch` is fenced exactly like the native tools: a wider
 * session mode is honored and a narrower one is enforced against the real
 * workspace instead of the launch directory.
 *
 * @module dsh-patch-edit-plus/policy
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox';
/** The `ctx.sandboxPolicy` face this plugin reads (structurally — never a runtime import). */
export interface SandboxPolicyFace {
    /** Resolve the complete policy for one call; with a session it stamps that session's mode and cwd. */
    resolve(request?: {
        session?: unknown;
    }): SandboxExecutionPolicy;
}
/**
 * Structurally resolve `ctx.sandboxPolicy`, the way {@link resolveShell} resolves
 * `ctx.shell`: `ctx.get` is the optional-service accessor, so a profile without a
 * policy owner yields `undefined` instead of a load failure.
 * @param ctx - the plugin context.
 * @returns the policy service, or `undefined` when none is mounted.
 */
export declare function resolveSandboxPolicyService(ctx: Context): SandboxPolicyFace | undefined;
/**
 * The policy to stamp onto every mutation of one tool call: the calling
 * session's standing policy (its mode override, its cwd as the workspace root).
 * An agentless call resolves the unscoped deployment policy, which is the correct
 * fence when there is no session to name.
 * @param ctx - the plugin context.
 * @param exec - the tool-execution context supplying the calling session.
 * @returns the policy to pass to the mutation, or `undefined` when the mounted
 *   filesystem is not sandboxed (the argument is then ignored by the backend).
 */
export declare function resolveSandboxPolicy(ctx: Context, exec: ToolRunContext): SandboxExecutionPolicy | undefined;
