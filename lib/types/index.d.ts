/**
 * dsh-patch-edit-plus — patch-style file editing for DeepSeek Harness.
 *
 * One `apply_patch` tool accepting git/unified diff (default) and Codex
 * `apply_patch` syntax (opt-in). All-or-nothing application through the
 * official fs write-intent dance; delete/move through the sandbox-aware
 * shell. Targets DSH 0.1.7+: settings are declarative — the fields marked
 * `.volatile()` in `Config` render the settings form automatically (no
 * registration call), and `loader/volatile-update` drives re-registration
 * without a plugin remount. This line drops the pre-0.1.7 hosts; the
 * 0.1.2-rc.1 ~ 0.1.5-rc.2 line stays on its maintenance branch.
 *
 * @module dsh-patch-edit-plus
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Config as PluginConfig } from './config.js';
declare module '@deepseek-ai/cordis' {
    interface Events {
        'loader/volatile-update': (paths: string[]) => void;
    }
}
/** Cordis plugin name used by Loader diagnostics. */
export declare const name = "dsh-patch-edit-plus";
/**
 * Services this plugin reads, declared for the loader BEFORE `apply` runs.
 *
 * Cordis resolves `ctx.<service>` through a proxy that throws
 * `cannot get property "<name>" without inject` for anything not declared
 * here, and the loader surfaces that as a fatal `plugin tree failed to load`.
 * Both entries below are read unconditionally on the load path:
 * - `tools` — `registerApplyPatchTool` probes and registers (`ctx.tools`).
 * - `fs` — reads plus the official write-intent dance (`ctx.fs`).
 *
 * `shell` is deliberately NOT declared. Delete/Move is the only consumer and
 * `resolveShell` probes it inside a `try/catch`, returning `undefined` when no
 * executor is mounted; declaring it would instead refuse to load the plugin
 * in every profile that has no shell capability.
 */
export declare const inject: string[];
export { Config } from './config.js';
/**
 * Register the tool from the current config snapshot.
 *
 * 登记级 key。工具「描述」把可用语法固化进去了（tool.ts 拼 `Accepts ${styles}`），
 * 所以判定必须覆盖整份 resolved config，而不是只看 allowCodexPatch。
 */
export declare function apply(ctx: Context, config?: PluginConfig): void;
