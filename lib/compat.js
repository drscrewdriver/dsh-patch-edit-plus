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
/** Wrap a schema field with `.volatile()` only when the host line supports it. */
export function maybeVolatile(schema) {
    const candidate = schema;
    if (typeof candidate?.volatile === 'function') {
        try {
            return candidate.volatile();
        }
        catch {
            return schema;
        }
    }
    return schema;
}
/**
 * Register the settings section across host generations. 0.1.7+ declarative
 * volatile hosts never call this (their schema fields are already volatile and
 * no registration call is wanted); this is the 0.1.5-and-below path.
 */
export function installSettingsCompat(ctx, namespace, schema, entry, hooks) {
    console.log('[dsh-patch-edit-plus] compat waist mounted');
    try {
        ctx.inject(['settings'], (settingsCtx) => {
            try {
                const settings = settingsCtx.settings
                    ?? settingsCtx;
                if (typeof settings?.installSection === 'function') {
                    try {
                        settings.installSection(ctx, namespace, schema, entry, hooks);
                        console.log('[dsh-patch-edit-plus] settings via installSection (0.1.2/0.1.5 line)');
                    }
                    catch (error) {
                        console.warn('[dsh-patch-edit-plus] settings.installSection unavailable:', error);
                    }
                    return;
                }
                if (typeof settings?.register === 'function') {
                    // 0.1.0–0.1.5 imperative register（宿主模块级 installSettingsSection 的
                    // 内部实现就是这一段）。0.1.7+ 声明式线永远走不到这里——本函数只在组合
                    // 条目携带普通布尔（非 live ref）时才会被调用。真机注：0.1.0 沙盒根本
                    // 不发货 @deepseek-ai/dsh-settings 包，模块级 helper 不可解析，实例
                    // register 是唯一可达面。
                    try {
                        const scope = settings.register(namespace, schema, { base: entry });
                        if (scope !== undefined) {
                            hooks.setSource(() => scope.get());
                            scope.watch(() => { hooks.onChange(); });
                            hooks.onChange();
                            console.log('[dsh-patch-edit-plus] settings via register (0.1.0-0.1.5 imperative face)');
                        }
                    }
                    catch (error) {
                        console.warn('[dsh-patch-edit-plus] settings.register unavailable:', error);
                    }
                    return;
                }
                // 0.1.0/0.1.1: no instance API — the module-level helper wraps
                // settings.register with the resolved-scope plumbing.
                import('@deepseek-ai/dsh-settings').then((mod) => {
                    const m = mod;
                    const helper = m?.installSettingsSection ?? m?.default?.installSettingsSection;
                    if (typeof helper === 'function') {
                        try {
                            helper(ctx, namespace, schema, entry, hooks);
                        }
                        catch (error) {
                            console.warn('[dsh-patch-edit-plus] installSettingsSection unavailable:', error);
                        }
                    }
                }).catch(() => {
                    // Module absent on this line — no settings surface, tool still works.
                });
            }
            catch (cbError) {
                console.warn('[dsh-patch-edit-plus] settings callback threw:', cbError);
            }
        });
    }
    catch (error) {
        // Hosts without the sub-inject seam (very old cordis) skip settings entirely.
        console.warn('[dsh-patch-edit-plus] settings sub-inject unavailable on this host line:', error);
    }
}
