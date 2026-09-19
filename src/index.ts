/**
 * dsh-patch-edit-plus — patch-style file editing for DeepSeek Harness.
 *
 * One `apply_patch` tool accepting git/unified diff (default) and Codex
 * `apply_patch` syntax (opt-in). All-or-nothing application through the
 * official fs write-intent dance; delete/move through the sandbox-aware
 * shell. Compatible with DSH 0.1.2-rc.1 through 0.1.5-rc.2: the tool
 * authoring contract is byte-identical across those versions, so a single
 * code path serves both; only settings registration needs the dual-API
 * fallback (`installSection` first, `register` second).
 *
 * @module dsh-patch-edit-plus
 */

import type { Context } from '@deepseek-ai/cordis'
import { Config, resolveConfig } from './config.js'
import type { Config as PluginConfig } from './config.js'
import { registerApplyPatchTool } from './register.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'dsh-patch-edit-plus'

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
export const inject = ['tools', 'fs']

/**
 * Settings namespace. Must match dsh-settings `NAMESPACE_PATTERN`
 * (`/^[a-z][a-z0-9-]*$/`) on every target version: letters, digits and
 * hyphens only — an underscore made `register()` throw before anything
 * persisted, so no migration is needed.
 */
export const SETTINGS_NAMESPACE = 'patch-edit-plus'

export { Config }

/** Owner-facing handle returned by the legacy `register` API. */
interface SettingsScopeFace {
  get(): PluginConfig
  watch(callback: () => void): () => void
}

/** Settings service face covering both the 0.1.2+ and legacy registration APIs. */
interface SettingsFace {
  installSection?(
    owner: unknown,
    namespace: string,
    schema: unknown,
    entry: unknown,
    hooks: { setSource(current: () => PluginConfig): void; onChange(): void },
  ): unknown
  register?(
    namespace: string,
    schema: unknown,
    options: { base?: unknown },
  ): SettingsScopeFace | undefined
}

/** Register the tool and the settings namespace. Every registration is scoped to this plugin. */
export function apply(ctx: Context, config?: PluginConfig): void {
  const compositionEntry = config ?? {}

  // 权威来源：设置层挂载时是解析后的 scope，否则是组合条目。
  // installSection 保证在每次匹配的 onChange 之前先调用 setSource（attach 与 detach 各一次）。
  let readSource: () => PluginConfig = () => compositionEntry

  let disposer: (() => void) | null = null
  // 登记级 key。工具「描述」把可用语法固化进去了（tool.ts 拼 `Accepts ${styles}`），
  // 所以判定必须覆盖整份 resolved config，而不是只看 allowCodexPatch。
  let registeredKey: string | null = null

  const rejudge = (): void => {
    const next = resolveConfig(readSource())
    const key = JSON.stringify(next)
    if (key === registeredKey) return
    disposer?.()
    disposer = registerApplyPatchTool(ctx, next) ?? null
    registeredKey = key
  }

  ctx.effect(() => {
    rejudge()
    return () => {
      disposer?.()
      disposer = null
      registeredKey = null
    }
  })

  ctx.inject(['settings'], (settingsCtx) => {
    const settings = (settingsCtx as unknown as { settings?: SettingsFace }).settings
      ?? (settingsCtx as unknown as SettingsFace)
    if (typeof settings?.installSection === 'function') {
      settings.installSection(ctx, SETTINGS_NAMESPACE, Config, compositionEntry, {
        setSource: (current) => { readSource = current },
        onChange: () => { rejudge() },
      })
      return
    }
    if (typeof settings?.register === 'function') {
      const scope = settings.register(SETTINGS_NAMESPACE, Config, { base: compositionEntry })
      if (scope !== undefined) {
        readSource = () => scope.get()
        scope.watch(() => { rejudge() })
        rejudge()
      }
    }
  })
}
