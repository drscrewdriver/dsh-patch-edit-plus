/**
 * Generation-compat seams for the single max-range build (0.1.0-rc.8 → 0.2.0).
 *
 * Three old-line traps live here:
 * 1. `.volatile()` — the schema method only exists on the 0.1.7+ schemastery
 *    line; calling it blind is a load-time TypeError on older hosts. Condition
 *    it with {@link maybeVolatile}.
 * 2. The settings registration API is three generations deep: instance
 *    `settings.installSection` (0.1.2/0.1.5, real-host verified), the module
 *    `installSettingsSection` export of `@deepseek-ai/dsh-settings`
 *    (0.1.0/0.1.1 — verified against the 0.1.0-rc.8 tarball; the
 *    dsh-client-ui-settings package is a host-side no-op there), and the
 *    declarative `.volatile()` form on 0.1.7+. {@link installSettingsCompat}
 *    picks by feature detection, never by version number.
 * 3. Every cross-generation import must ride a namespace soft-import: a static
 *    named import of an absent export dies at ESM link time and takes the
 *    whole loader entry down.
 * @module dsh-patch-edit-plus/compat
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Config as PluginConfig } from './config.js';
/** Wrap a schema field with `.volatile()` only when the host line supports it. */
export declare function maybeVolatile<T>(schema: T): T;
/** Settings service face covering both the 0.1.2+ and legacy registration APIs. */
export interface SettingsFace {
    installSection?(owner: unknown, namespace: string, schema: unknown, entry: unknown, hooks: {
        setSource(current: () => PluginConfig): void;
        onChange(): void;
    }): unknown;
    register?(namespace: string, schema: unknown, options: {
        base?: unknown;
    }): {
        get(): PluginConfig;
        watch(cb: () => void): void;
    } | undefined;
}
export interface SettingsHooks {
    setSource(current: () => PluginConfig): void;
    onChange(): void;
}
/**
 * Register the settings section across host generations. 0.1.7+ declarative
 * volatile hosts never call this (their schema fields are already volatile and
 * no registration call is wanted); this is the 0.1.5-and-below path.
 */
export declare function installSettingsCompat(ctx: Context, namespace: string, schema: unknown, entry: PluginConfig, hooks: SettingsHooks): void;
