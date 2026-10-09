/**
 * dsh-patch-edit-plus — 浏览器 half（0.2.0 新增）。
 *
 * 单一职责：在 Plugins 页 bundle 详情页的 `plugins.bundle.config` 席位
 * （key = 包名）下注册一张配置卡，暴露两个补丁风格开关——
 * - `allowUnifiedDiff`（Git/unified diff，默认开）
 * - `allowCodexPatch`（Codex apply_patch，默认关）
 *
 * 字段全部是 host 侧 `Config` 的 `.volatile()` 字段：卡片经
 * `configForms.get('dsh-patch-edit-plus')` 自绑本插件 entry（entry id 与
 * 包名一致，无错位），写入走 `form.set(field, !cur)`，提交后宿主经
 * `loader/volatile-update` 原地重注册工具（见 src/index.ts 的 rejudge）。
 *
 * 构建：tsdown → lib/client.js（__ModuleLoader__.load 闭包工厂，id = 包名）。
 * react 是唯一 value-import（平台 external）；slots/configForms 经 cordis
 * 服务消费，configForms 缺席时（理论上仅剩极老宿主）卡片整卡隐藏，不阻塞
 * 客户端半。文案内联双语字典（zh/en），不建 locale 文件。
 */
import { createElement, useSyncExternalStore } from 'react'
import type { JSX } from 'react'

/** 本插件消费的 configForms 值形状（与 host ResolvedConfig 的易变布尔对齐）。 */
export interface PatchEditPlusConfig {
  allowUnifiedDiff: boolean
  allowCodexPatch: boolean
}

/** configForms 作用域面（结构性子集；0.1.7+ 缝，避免硬 peer 类型）。 */
export interface PatchFormScope {
  getSnapshot(): {
    status: 'loading' | 'ready' | 'unavailable'
    value: Partial<PatchEditPlusConfig> | undefined
    writable: boolean
  }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
}

/** configForms 服务面（以 entry id 取句柄）。 */
interface ConfigFormsFace {
  get?(entryId: string): PatchFormScope | undefined
}

/** 客户端所需服务：slots 全世代都有，准声明；configForms 是 0.1.7+ 服务，
 * **不准**进顶层 inject——在老宿主上声明缺失服务会把 client entry 永久挂起
 * （web boot 拒渲染整树，「1 entry did not activate」家族教训）。configForms
 * 走软读（strict proxy 直读 throw → try/catch 落 ctx.get），缺席时整卡隐藏。 */
export const inject = ['slots']

/** 轻量 ctx 类型（仅本客户端用到的方法；构建时类型被剥离）。 */
interface SlotsFace {
  inject: (_name: string, _fn: () => unknown) => () => void
  register: (_options: Record<string, unknown>, _component: unknown) => () => void
}
interface ClientCtx {
  slots: SlotsFace
  get?: (_name: string) => unknown
}

/** 内联双语字典（zh/en；按 document.documentElement.lang → navigator.language 兜底）。 */
const STRINGS = {
  zh: {
    cardName: '补丁风格',
    cardDesc: 'apply_patch 接受的补丁语法',
    unifiedTitle: 'Git 风格补丁',
    unifiedDesc: '接受 Git/unified diff 补丁语法(默认开)',
    codexTitle: 'Codex 风格补丁',
    codexDesc: '接受 Codex apply_patch 语法(默认关)',
    readonlyHint: '当前只读，无法修改。',
  },
  en: {
    cardName: 'Patch style',
    cardDesc: 'Patch syntax accepted by apply_patch',
    unifiedTitle: 'Git-style patches',
    unifiedDesc: 'Accept Git/unified diff patch syntax (default on)',
    codexTitle: 'Codex-style patches',
    codexDesc: 'Accept Codex apply_patch syntax (default off)',
    readonlyHint: 'Read-only right now; changes are not allowed.',
  },
} as const

type Lang = keyof typeof STRINGS

/** 解析当前语言：document.documentElement.lang 优先，navigator.language 兜底，再退 zh。 */
function pickLang(): Lang {
  try {
    const docLang = typeof document !== 'undefined' ? document.documentElement.lang : ''
    const navLang = typeof navigator !== 'undefined' ? navigator.language : ''
    for (const tag of [docLang, navLang]) {
      if (typeof tag === 'string' && /^zh/i.test(tag)) return 'zh'
      if (typeof tag === 'string' && /^en/i.test(tag)) return 'en'
    }
  } catch {
    // 非 DOM 环境保底 zh
  }
  return 'zh'
}

/** 卡片样式，注入一次（保持 bundle CSS-free；变量与 session-guard 卡同源）。 */
const CARD_CSS = `
.ppeCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:4px 16px 8px}
.ppeCardName{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4;margin:10px 0 2px}
.ppeCardDesc{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5;margin:0 0 4px}
.ppeRow{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:14px 0;display:flex}
.ppeRow:last-of-type{border-bottom:0}
.ppeRowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}
.ppeTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.ppeDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}
.ppeSwitch{appearance:none;position:relative;width:40px;height:22px;flex:none;cursor:pointer;background:transparent;border:0;padding:0}
.ppeSwitch:disabled{cursor:not-allowed}
.ppeSwitchTrack{position:absolute;inset:0;border-radius:22px;background:var(--dsw-alias-interactive-bg-hover);transition:background .16s}
.ppeSwitch-on>.ppeSwitchTrack{background:var(--dsw-alias-button-primary-fill)}
.ppeSwitchThumb{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .16s}
.ppeSwitch-on>.ppeSwitchThumb{transform:translateX(18px)}
.ppeSwitch:disabled>.ppeSwitchTrack{opacity:.5}
.ppeReadonly{color:var(--dsw-alias-label-tertiary);font-size:12px;margin:8px 0 4px}
`

/** 注入一次卡片样式。 */
function injectCss(): void {
  if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="patch-edit-plus-card"]') === null) {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-patch-edit-plus'
    tag.dataset.pluginCss = 'patch-edit-plus-card'
    tag.textContent = CARD_CSS
    document.head.appendChild(tag)
  }
}

const NOOP_SNAPSHOT = { status: 'unavailable' as const, value: undefined, writable: false }
const unsubscribeNoop = (): void => {}

/** 一行 role="switch" 开关（aria-checked + data-* 便于测试选择器）。 */
function SwitchRow(props: {
  field: 'allowUnifiedDiff' | 'allowCodexPatch'
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onToggle: (_field: 'allowUnifiedDiff' | 'allowCodexPatch', _current: boolean) => void
}): JSX.Element {
  const { field, title, description, checked, disabled, onToggle } = props
  return (
    <div className="ppeRow">
      <div className="ppeRowText">
        <div className="ppeTitle">{title}</div>
        <div className="ppeDesc">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-plugin="dsh-patch-edit-plus"
        data-field={field}
        data-checked={checked ? 'true' : 'false'}
        className={'ppeSwitch' + (checked ? ' ppeSwitch-on' : '')}
        disabled={disabled}
        onClick={() => onToggle(field, checked)}
      >
        <span className="ppeSwitchTrack" />
        <span className="ppeSwitchThumb" />
      </button>
    </div>
  )
}

/**
 * 插件页配置卡主体：两行补丁风格开关。
 * - status === 'unavailable'（无 configForms / entry 未装配）→ 整卡隐藏（null）；
 * - status === 'loading' → 开关禁用；
 * - 仅 snapshot.writable 时可写（写路径 `form.set(field, !cur)`）。
 */
export function PatchStyleCard(props: { form?: PatchFormScope | undefined }): JSX.Element | null {
  const form = props.form
  const snapshot = useSyncExternalStore(
    form
      ? (listener) => form.subscribe(listener)
      : () => unsubscribeNoop,
    () => form?.getSnapshot() ?? NOOP_SNAPSHOT,
  )

  injectCss()

  if (snapshot.status === 'unavailable') return null
  const t = STRINGS[pickLang()]
  // loading / 只读都归约为「不可写」：开关禁用，仅 ready + writable 时可写。
  const editable = snapshot.status === 'ready' && snapshot.writable
  const value = snapshot.value ?? {}
  const toggle = (field: 'allowUnifiedDiff' | 'allowCodexPatch', current: boolean): void => {
    if (form === undefined || !editable) return
    void form.set(field, !current).catch(() => {})
  }
  return (
    <section className="ppeCard" data-plugin="dsh-patch-edit-plus">
      <div className="ppeCardName">{t.cardName}</div>
      <p className="ppeCardDesc">{t.cardDesc}</p>
      <SwitchRow
        field="allowUnifiedDiff"
        title={t.unifiedTitle}
        description={t.unifiedDesc}
        checked={value.allowUnifiedDiff ?? true}
        disabled={!editable}
        onToggle={toggle}
      />
      <SwitchRow
        field="allowCodexPatch"
        title={t.codexTitle}
        description={t.codexDesc}
        checked={value.allowCodexPatch ?? false}
        disabled={!editable}
        onToggle={toggle}
      />
      {snapshot.status === 'ready' && !snapshot.writable && <p className="ppeReadonly">{t.readonlyHint}</p>}
    </section>
  )
}

/**
 * 客户端插件体：在 Plugins 页 bundle 详情页的 keyed 席位（key = 包名）下
 * 注册配置卡。卡片自绑 `configForms.get('dsh-patch-edit-plus')`——form 在
 * 渲染期解析（而非 apply 期固化），宿主晚于客户端半开始服务该 entry 时
 * 也能追上；页面注入的 owner props（`{ view: 'page', form }`）不消费，
 * 以本插件 entry 的作用域为唯一事实来源。
 */
export function apply(ctx: ClientCtx): void {
  // 软读：strict ctx proxy 对未声明服务的属性直读会 throw（「1 entry did not
  // activate」家族纪律：按代服务一律软取，绝不进顶层 inject）。
  let configForms: ConfigFormsFace | undefined
  try {
    configForms = ((ctx as unknown as { configForms?: ConfigFormsFace }).configForms
      ?? (typeof ctx.get === 'function' ? ctx.get('configForms') : undefined)) as ConfigFormsFace | undefined
  } catch {
    configForms = undefined
  }
  // 老宿主不认识 plugins.bundle.config 席位——激活期 throw 会拖死整个
  // client entry，包 safeSeat 降级为「本线无配置卡」。
  try {
    ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register(
      { name: 'plugins.bundle.config', key: 'dsh-patch-edit-plus' },
      () => createElement(PatchStyleCard, { form: configForms?.get?.('dsh-patch-edit-plus') }),
    ))
  } catch (error) {
    console.warn('[dsh-patch-edit-plus] plugins.bundle.config seat unavailable on this host line:', error)
  }
}
