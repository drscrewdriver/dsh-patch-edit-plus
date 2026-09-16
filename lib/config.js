/**
 * Plugin configuration: Schemastery schema + resolved defaults.
 *
 * Every knob the tool honors lives here; the tool body only ever reads the
 * fully-resolved `ResolvedConfig` produced by `resolveConfig`.
 * @module dsh-patch-edit-plus/config
 */
import z from '@deepseek-ai/schemastery';
/** Schemastery schema for Loader defaults and generated configuration docs. */
export const Config = z.object({
    toolName: z.string().default('apply_patch'),
    conflictPolicy: z.union(['rename', 'skip', 'fail']).default('rename'),
    renameSuffix: z.string().default('_1'),
    allowUnifiedDiff: z.boolean().default(true),
    allowCodexPatch: z.boolean().default(false),
    deleteBackend: z.union(['shell', 'none']).default('shell'),
    shellDialect: z.union(['auto', 'posix', 'pwsh']).default('auto'),
    deleteCommand: z.string(),
    moveCommand: z.string(),
    dryRunByDefault: z.boolean().default(false),
    followSymlinks: z.boolean().default(false),
    maxFiles: z.number().step(1).min(1).max(500).default(50),
    maxPatchBytes: z.number().step(1).min(1024).default(512 * 1024),
    maxDiffBytes: z.number().step(1).min(256).default(16 * 1024),
});
/** Fill user config with defaults; `undefined`/null entries fall back too. */
export function resolveConfig(config) {
    const c = config ?? {};
    return {
        toolName: typeof c.toolName === 'string' && c.toolName.trim() !== '' ? c.toolName : 'apply_patch',
        conflictPolicy: c.conflictPolicy ?? 'rename',
        renameSuffix: typeof c.renameSuffix === 'string' ? c.renameSuffix : '_1',
        allowUnifiedDiff: c.allowUnifiedDiff ?? true,
        allowCodexPatch: c.allowCodexPatch ?? false,
        deleteBackend: c.deleteBackend ?? 'shell',
        shellDialect: c.shellDialect ?? 'auto',
        deleteCommand: typeof c.deleteCommand === 'string' && c.deleteCommand !== '' ? c.deleteCommand : undefined,
        moveCommand: typeof c.moveCommand === 'string' && c.moveCommand !== '' ? c.moveCommand : undefined,
        dryRunByDefault: c.dryRunByDefault ?? false,
        followSymlinks: c.followSymlinks ?? false,
        maxFiles: c.maxFiles ?? 50,
        maxPatchBytes: c.maxPatchBytes ?? 512 * 1024,
        maxDiffBytes: c.maxDiffBytes ?? 16 * 1024,
    };
}
