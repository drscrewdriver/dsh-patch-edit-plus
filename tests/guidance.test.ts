/**
 * System-prompt guidance registration across host generations.
 *
 * The key contract: the section order must never be non-finite (0.1.0-rc.8 has
 * no `getSectionOrder`, 0.2.1 has no `TOOL_APPLY_PATCH`), the text must vanish
 * when the tool is absent from the scope, and a host without a system-prompt
 * service must load silently.
 */
import { describe, expect, it, vi } from 'vitest'
import { resolveConfig } from '../src/config.js'
import {
  PATCH_GUIDANCE_ORDER,
  PATCH_GUIDANCE_SECTION,
  PATCH_GUIDANCE_TEXT,
  registerPatchGuidance,
} from '../src/guidance.js'

interface Section {
  name: string
  order: number
  text: (view?: unknown) => string
}

function makeCtx(options: {
  orders?: Record<string, number | undefined>
  withService?: boolean
  withResolve?: boolean
  sectionThrows?: boolean
  registered?: string[]
} = {}) {
  const sections: Section[] = []
  const names = new Set(options.registered ?? ['apply_patch'])
  const ctx = {
    tools: {
      get(name: string) { return names.has(name) ? { name } : undefined },
    },
    ...(options.withService === false ? {} : {
      systemPrompt: {
        section(section: Section) {
          if (options.sectionThrows === true) throw new TypeError('prompt section order must be a finite number')
          sections.push(section)
          return () => { sections.splice(sections.indexOf(section), 1) }
        },
        ...(options.withResolve === false ? {} : {
          getSectionOrder(name: string) { return options.orders?.[name] },
        }),
      },
    }),
  }
  return { ctx: ctx as never, sections, names }
}

describe('system-prompt guidance', () => {
  it('uses the host TOOL_APPLY_PATCH order when the host has one', () => {
    const { ctx, sections } = makeCtx({ orders: { TOOL_APPLY_PATCH: 1350, TOOL_EDIT: 1300 } })
    registerPatchGuidance(ctx, 'apply_patch', 'auto')
    expect(sections).toHaveLength(1)
    expect(sections[0].name).toBe(PATCH_GUIDANCE_SECTION)
    expect(sections[0].order).toBe(1350)
  })

  it('falls back to TOOL_EDIT + 50 on hosts that predate TOOL_APPLY_PATCH', () => {
    const { ctx, sections } = makeCtx({ orders: { TOOL_EDIT: 1300 } })
    registerPatchGuidance(ctx, 'apply_patch', 'auto')
    expect(sections[0].order).toBe(1350)
  })

  it('falls back to the literal 1350 when getSectionOrder is absent (0.1.0-rc.8)', () => {
    const { ctx, sections } = makeCtx({ withResolve: false })
    registerPatchGuidance(ctx, 'apply_patch', 'auto')
    expect(sections[0].order).toBe(PATCH_GUIDANCE_ORDER)
  })

  it('emits the text only while the tool is registered in the scope', () => {
    const { ctx, sections } = makeCtx()
    registerPatchGuidance(ctx, 'apply_patch', 'auto')
    expect(sections[0].text({ scope: {} })).toBe(PATCH_GUIDANCE_TEXT)
    expect(sections[0].text()).toBe(PATCH_GUIDANCE_TEXT)
  })

  it('emits an empty string when the tool is absent (renamed away or unloaded)', () => {
    const { ctx, sections } = makeCtx({ registered: [] })
    registerPatchGuidance(ctx, 'apply_patch', 'auto')
    expect(sections[0].text()).toBe('')
  })

  it('returns the section disposer and removes the section on dispose', () => {
    const { ctx, sections } = makeCtx()
    const dispose = registerPatchGuidance(ctx, 'apply_patch', 'on')
    expect(dispose).toBeTypeOf('function')
    dispose?.()
    expect(sections).toHaveLength(0)
  })

  it('stays silent on a host without a systemPrompt service', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { ctx } = makeCtx({ withService: false })
    expect(registerPatchGuidance(ctx, 'apply_patch', 'auto')).toBeNull()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('warns but still returns null when guidance is explicitly on and the service is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { ctx } = makeCtx({ withService: false })
    expect(registerPatchGuidance(ctx, 'apply_patch', 'on')).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('survives a section() that rejects the order instead of crashing the load', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { ctx } = makeCtx({ sectionThrows: true })
    expect(registerPatchGuidance(ctx, 'apply_patch', 'on')).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('never touches the service under mode "off"', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { ctx, sections } = makeCtx()
    expect(registerPatchGuidance(ctx, 'apply_patch', 'off')).toBeNull()
    expect(sections).toHaveLength(0)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('defaults to auto in the resolved config', () => {
    expect(resolveConfig(undefined).guidance).toBe('auto')
    expect(resolveConfig({ guidance: 'off' }).guidance).toBe('off')
  })
})
