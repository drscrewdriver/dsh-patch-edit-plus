/**
 * tui-command.ts — `/patch`：patch-edit-plus 的 dsh-tui 终端面。
 *
 * 背景：dsh-tui 不加载 client 半边，设置卡在终端里不可达；而 apply_patch 的
 * 冲突策略/删除后端/引导开关又在 TUI 会话里直接决定行为。命令面只读回显设置节
 * （不猜字段，直接展平 settings.describe() 里的本节内容）。
 *
 * 契约：单行 <=100、总行 <=40、无 ANSI、--json 单行。
 */

import type { Context } from '@deepseek-ai/cordis'

export type CommandKind = 'success' | 'error'
export interface CommandResult { kind: CommandKind; text: string }

export interface ConsoleDeps {
  ns: string
  line: (key: string, value: string) => string
  section(): Record<string, unknown> | undefined
}

const MAX_LINES = 40
const MAX_WIDTH = 100

export function clip(text: string, width = MAX_WIDTH): string {
  const value = String(text ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+$/, '')
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`
}

export function renderLines(lines: string[], limit = MAX_LINES): string {
  const clipped = lines.map((line) => clip(line))
  if (clipped.length <= limit) return clipped.join('\n')
  const kept = clipped.slice(0, limit - 1)
  return [...kept, `… 还有 ${clipped.length - kept.length} 行，加 --all 查看`].join('\n')
}

export function describeSection(ctx: Context, ns: string, needle = 'toolName'): Record<string, unknown> | undefined {
  const settings = (ctx as unknown as { get?: (name: string) => unknown }).get?.('settings') as
    | { describe?: () => unknown }
    | undefined
  const raw = settings?.describe?.()
  const list = Array.isArray(raw) ? raw : (raw as { namespaces?: unknown[] } | undefined)?.namespaces
  if (!Array.isArray(list)) return undefined
  const pick = (entry: unknown): Record<string, unknown> | undefined => {
    const row = entry as { ns?: unknown; value?: unknown } | null
    if (row === null || typeof row !== 'object') return undefined
    if (row.ns === ns && row.value !== null && typeof row.value === 'object') return row.value as Record<string, unknown>
    return undefined
  }
  for (const entry of list) {
    const hit = pick(entry)
    if (hit !== undefined) return hit
  }
  for (const entry of list) {
    const row = entry as { value?: unknown } | null
    const value = row?.value
    if (value !== null && typeof value === 'object' && needle in (value as Record<string, unknown>)) {
      return value as Record<string, unknown>
    }
  }
  return undefined
}

export function runPatchCommand(rawInput: string, deps: ConsoleDeps): CommandResult {
  const argv = String(rawInput ?? '').trim().split(/\s+/).filter(Boolean)
  const json = argv.includes('--json')
  const sub = (argv.find((token) => !token.startsWith('--')) ?? 'config').toLowerCase()
  const section = deps.section()
  const wrap = (result: CommandResult, data: unknown): CommandResult => {
    if (!json) return result
    const body = result.kind === 'error'
      ? { ok: false, cmd: 'patch', error: { message: result.text.split('\n')[0] ?? result.text } }
      : { ok: true, cmd: 'patch', data }
    return { kind: result.kind, text: JSON.stringify(body) }
  }
  if (sub === 'help' || sub === '?') {
    return wrap({ kind: 'success', text: renderLines([
      'patch — apply_patch 的只读配置回显',
      '  /patch config   当前设置节内容（冲突策略/删除后端/引导开关…）',
      '  flags           --json 单行 JSON',
      '  note            改配置走 Desktop 设置页；命令层只读',
    ]) }, { help: true })
  }
  if (sub !== 'config' && sub !== 'status') {
    return wrap({ kind: 'error', text: renderLines([`patch: 未知子命令 "${sub}"`, '  next: /patch help']) }, {})
  }
  if (section === undefined) {
    return wrap({ kind: 'error', text: renderLines([
      `patch: 设置节 ${deps.ns} 不在 profile 文档里`,
      '  next 检查 plugin 是否已进入 profile；或直接看 cordis.patch.yml',
    ]) }, {})
  }
  const lines = ['patch — 设置节（只读）']
  let count = 0
  for (const [key, value] of Object.entries(section)) {
    if (count >= 14) { lines.push(`  … 还有 ${Object.keys(section).length - count} 个字段`); break }
    lines.push(deps.line(key, typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)))
    count += 1
  }
  return wrap({ kind: 'success', text: renderLines(lines) }, section)
}

export function registerPatchCommand(ctx: Context, deps: ConsoleDeps): void {
  const registry = (ctx as unknown as { commands?: { register(definition: unknown): unknown } }).commands
  if (!registry || typeof registry.register !== 'function') return
  registry.register({
    definitionId: 'dsh-patch-edit-plus',
    name: 'patch',
    description: 'apply_patch console: read-only echo of the plugin settings section',
    input: { hint: '[config] [--json]' },
    handler: (invocation: { rawInput?: string }) => runPatchCommand(invocation?.rawInput ?? '', deps),
  })
}
