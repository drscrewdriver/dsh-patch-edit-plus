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
function isPolicyFace(value) {
    return typeof value === 'object' && value !== null && typeof value.resolve === 'function';
}
/**
 * Structurally resolve `ctx.sandboxPolicy`, the way {@link resolveShell} resolves
 * `ctx.shell`: `ctx.get` is the optional-service accessor, so a profile without a
 * policy owner yields `undefined` instead of a load failure.
 * @param ctx - the plugin context.
 * @returns the policy service, or `undefined` when none is mounted.
 */
export function resolveSandboxPolicyService(ctx) {
    try {
        const get = ctx.get;
        if (typeof get !== 'function')
            return undefined;
        const service = get.call(ctx, 'sandboxPolicy');
        return isPolicyFace(service) ? service : undefined;
    }
    catch {
        return undefined;
    }
}
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
export function resolveSandboxPolicy(ctx, exec) {
    const service = resolveSandboxPolicyService(ctx);
    if (service === undefined)
        return undefined;
    return exec.agent === undefined ? service.resolve() : service.resolve({ session: exec.agent.session });
}
