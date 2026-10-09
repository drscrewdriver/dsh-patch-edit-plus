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

import type { Context } from '@deepseek-ai/cordis'
import { resolveConfig } from './config.js'
import type { Config as PluginConfig } from './config.js'
import { registerApplyPatchTool } from './register.js'
import { installSettingsCompat } from './compat.js'
import { Config } from './config.js'

/** 设置命名空间（0.1.5 及以下实例/模块注册面用；0.1.7+ 声明式线不消费）。 */
export const SETTINGS_NAMESPACE = 'patch-edit-plus'

// The dev pins (0.1.2-rc.1 era) predate the 0.1.7 loader event. The 0.1.7 host
// emits it for volatile-only config changes and passes the changed paths.
declare module '@deepseek-ai/cordis' {
  interface Events {
    'loader/volatile-update': (paths: string[]) => void
  }
}

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

export { Config } from './config.js'

/**
 * Register the tool from the current config snapshot.
 *
 * 登记级 key。工具「描述」把可用语法固化进去了（tool.ts 拼 `Accepts ${styles}`），
 * 所以判定必须覆盖整份 resolved config，而不是只看 allowCodexPatch。
 */
export function apply(ctx: Context, config?: PluginConfig): void {
  // 组合条目（0.1.7 起 volatile 字段在其中是 live 引用）：rejudge 每次整体
  // 重解析一次，一次调用内是同一份快照；跨调用的最新值由事件驱动重取。
  const compositionEntry = config ?? {}

  // 权威来源：设置层挂载时是解析后的 scope（installSection/installSettingsSection
  // 的 setSource 在 attach 时先于 onChange 调用），否则是组合条目。
  let readSource: () => PluginConfig = () => compositionEntry

  let disposer: (() => void) | null = null
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

  // 世代分流（特性检测，勿按版本号）：0.1.7+ 把 volatile 字段作为 live ref
  // 塞进组合条目——看到 live ref 即声明式线，设置面宿主自渲染，任何注册调用
  // 都属多余。老线拿到的是普通布尔，走三代腰补注册（0.1.2/0.1.5 实例
  // installSection / register；0.1.0/0.1.1 模块级 installSettingsSection）。
  if (typeof compositionEntry.allowUnifiedDiff !== 'object' && typeof compositionEntry.allowCodexPatch !== 'object') {
    installSettingsCompat(ctx, SETTINGS_NAMESPACE, Config, compositionEntry, {
      setSource: (current) => { readSource = current },
      onChange: () => { rejudge() },
    })
  }

  // 0.1.7+: 只有 volatile 字段变更才走这里（不 remount）；普通字段变更会整体
  // remount 插件，新一次 `apply` 自然读到全部新值。等值变更宿主不通知。
  // 老宿主不声明该事件——ctx.on 对未知事件名在极老 cordis 上的行为未知，
  // 包一层 try/catch 让静默无更新成为唯一代价。
  try {
    ctx.on('loader/volatile-update', () => {
      rejudge()
    })
  } catch {
    // pre-0.1.7 host: no volatile updates; normal config edits remount the plugin.
  }
}
