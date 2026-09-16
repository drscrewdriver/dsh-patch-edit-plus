/**
 * Tool registration with three-layer name-conflict protection.
 *
 * Layer 1: probe `ctx.tools.get(name)` before building the definition.
 * Layer 2: `conflictPolicy` — `rename` (default) retries suffixed names,
 * `skip` logs and loads without the tool, `fail` throws.
 * Layer 3: `try/catch` around `register()` because get-then-register races.
 * @module dsh-patch-edit-plus/register
 */
import { PatchError } from './errors.js';
import { buildApplyPatchTool } from './tool.js';
const MAX_RENAME_ATTEMPTS = 9;
/**
 * Resolve an unused tool name and register the frozen definition.
 * @returns the registration disposer, or `null` when registration was skipped.
 * @throws {@link PatchError} only under `conflictPolicy: 'fail'`.
 */
export function registerApplyPatchTool(ctx, cfg, logger) {
    const log = logger ?? resolveLogger(ctx);
    const tools = ctx.tools;
    const base = cfg.toolName;
    let resolvedName = base;
    if (tools.get(resolvedName) !== undefined) {
        if (cfg.conflictPolicy === 'skip') {
            log.error?.(`dsh-patch-edit-plus: tool name "${base}" is already registered; conflictPolicy is "skip", so no tool was registered. `);
            return null;
        }
        if (cfg.conflictPolicy === 'fail') {
            throw new PatchError('CONFLICT', `Tool name "${base}" is already registered. Set a different dsh-patch-edit-plus toolName, or change conflictPolicy to "rename" (default) or "skip".`);
        }
        // rename
        const suffix = cfg.renameSuffix;
        let found = null;
        for (let attempt = 1; attempt <= MAX_RENAME_ATTEMPTS && found === null; attempt += 1) {
            const candidate = attempt === 1 ? `${base}${suffix}` : `${base}${suffix}${attempt}`;
            if (tools.get(candidate) === undefined)
                found = candidate;
        }
        if (found === null) {
            throw new PatchError('CONFLICT', `Could not find a free tool name for "${base}" after ${MAX_RENAME_ATTEMPTS} rename attempts. Set an explicit dsh-patch-edit-plus toolName.`);
        }
        log.warn?.(`dsh-patch-edit-plus: tool name "${base}" is already registered; registering as "${found}" instead.`);
        resolvedName = found;
    }
    const definition = buildApplyPatchTool(resolvedName, ctx, cfg);
    try {
        return tools.register(definition);
    }
    catch (error) {
        if (cfg.conflictPolicy === 'fail')
            throw error;
        const detail = error instanceof Error ? error.message : String(error);
        log.error?.(`dsh-patch-edit-plus: registering tool "${resolvedName}" failed (${detail}). The plugin stays loaded without the tool; set a unique toolName to resolve the conflict.`);
        return null;
    }
}
function resolveLogger(ctx) {
    const candidate = ctx.logger;
    return typeof candidate === 'object' && candidate !== null ? candidate : {};
}
