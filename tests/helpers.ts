/**
 * Test fixtures: an in-memory `ctx.fs` backend, a spy-recording context and a
 * tool-execution stub. Nothing here touches real disk.
 */
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { resolveConfig } from '../src/config.js'
import type { ResolvedConfig } from '../src/config.js'
import { buildApplyPatchTool } from '../src/tool.js'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'

export interface MemoryFile {
  content: string
}

export class MemoryFs {
  files = new Map<string, string>()
  dirs = new Set<string>()
  symlinks = new Map<string, string>()
  writeCalls: { key: string; content: string; intent: unknown; signal: unknown; sandboxPolicy: unknown }[] = []
  failNextWrite: Error | null = null

  resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): { targetKey: string; displayPath: string } {
    void opts?.signal
    let abs = this.canonical(this.absolute(path, opts?.cwd))
    // Follow symlink leaves the way fs-local's realpath would.
    for (let hops = 0; hops < 8 && this.symlinks.has(abs); hops += 1) {
      const target = this.symlinks.get(abs) as string
      abs = target.startsWith('/') ? this.canonical(target) : this.canonical(`${abs.split('/').slice(0, -1).join('/')}/${target}`)
    }
    return { targetKey: abs, displayPath: abs }
  }

  /** Collapse `.` and `..` segments so containment checks see escapes. */
  private canonical(abs: string): string {
    const out: string[] = []
    for (const segment of abs.split('/')) {
      if (segment === '' || segment === '.') continue
      if (segment === '..') out.pop()
      else out.push(segment)
    }
    return '/' + out.join('/')
  }

  contains(parent: { targetKey: string }, child: { targetKey: string }): boolean {
    return child.targetKey === parent.targetKey || child.targetKey.startsWith(parent.targetKey.endsWith('/') ? parent.targetKey : `${parent.targetKey}/`)
  }

  async stat(path: { targetKey: string }): Promise<{ type: string; version: string } | undefined> {
    const key = path.targetKey
    if (this.files.has(key)) return { type: 'file', version: `v:${key}:${this.files.get(key)}` }
    if (this.dirs.has(key) || key === this.root) return { type: 'directory', version: `d:${key}` }
    return undefined
  }

  async lstat(path: string, opts?: { cwd?: string }): Promise<{ type: string } | undefined> {
    const abs = this.absolute(path, opts?.cwd)
    if (this.symlinks.has(abs)) return { type: 'symlink' }
    if (this.files.has(abs)) return { type: 'file' }
    if (this.dirs.has(abs)) return { type: 'directory' }
    return undefined
  }

  async readText(target: { targetKey: string }): Promise<string> {
    const content = this.files.get(target.targetKey)
    if (content === undefined) throw new Error(`FS_NOT_FOUND: ${target.targetKey}`)
    return content
  }

  async writeText(target: { targetKey: string }, content: string, expected?: unknown, signal?: AbortSignal, sandboxPolicy?: unknown): Promise<{ operation: 'create' | 'update'; version: string; before: string | null; after: string }> {
    void expected
    if (signal?.aborted === true) throw new Error('FS_ABORTED: signal aborted')
    if (this.failNextWrite !== null) {
      const error = this.failNextWrite
      this.failNextWrite = null
      throw error
    }
    const before = this.files.get(target.targetKey) ?? null
    this.writeCalls.push({ key: target.targetKey, content, intent: expected, signal, sandboxPolicy })
    this.files.set(target.targetKey, content)
    return { operation: before === null ? 'create' : 'update', version: `v:${Date.now()}`, before, after: content }
  }

  processPath(target: { targetKey: string }): string {
    return target.targetKey
  }

  root = '/work'

  absolute(path: string, cwd?: string): string {
    if (path.startsWith('/')) return path.replaceAll('\\', '/')
    const base = (cwd ?? this.root).replaceAll('\\', '/')
    return `${base}/${path}`
  }

  addFile(path: string, content: string): void {
    this.files.set(this.absolute(path), content)
    this.ensureDirs(this.absolute(path))
  }

  addDir(path: string): void {
    this.dirs.add(this.absolute(path))
    this.ensureDirs(this.absolute(path))
  }

  addSymlink(path: string, to: string): void {
    this.symlinks.set(this.absolute(path), to)
  }

  private ensureDirs(abs: string): void {
    const segments = abs.split('/').slice(1, -1)
    let prefix = ''
    for (const segment of segments) {
      prefix += `/${segment}`
      this.dirs.add(prefix)
    }
  }
}

export interface RecorderState {
  waterfalls: { event: string; target: unknown; exec: unknown }[]
  emits: { event: string; args: unknown[] }[]
}

export interface TestRig {
  fs: MemoryFs
  recorder: RecorderState
  exec: ToolRunContext
  cfg: ResolvedConfig
  tool: ToolDefinition
  registerTool(extraName?: string): { registered: Map<string, ToolDefinition>; disposer: () => void }
  runTool(patch: string, extra?: Record<string, unknown>): Promise<unknown>
}

export function makeRig(overrides?: Partial<ResolvedConfig>, files?: Record<string, string>): TestRig {
  const fs = new MemoryFs()
  for (const [path, content] of Object.entries(files ?? {})) fs.addFile(path, content)
  const cfg: ResolvedConfig = { ...resolveConfig(undefined), ...overrides }
  const recorder: RecorderState = { waterfalls: [], emits: [] }

  const waterfall = async (event: string, target: unknown, exec: unknown, next: () => unknown) => {
    recorder.waterfalls.push({ event, target, exec })
    return next()
  }
  const emit = (event: string, ...args: unknown[]) => {
    recorder.emits.push({ event, args })
  }

  const registered = new Map<string, ToolDefinition>()
  const tool = buildApplyPatchTool(cfg.toolName, { fs, waterfall, emit } as never, cfg)

  const exec: ToolRunContext = {
    callId: 'call-1',
    rootCallId: 'call-1',
    name: cfg.toolName,
    arguments: {},
    agent: { session: { header: { cwd: '/work' } } },
    signal: new AbortController().signal,
    deferContext: () => {},
    concludeTurn: () => {},
    token: Symbol('token'),
  } as unknown as ToolRunContext

  const registerTool = (extraName?: string) => {
    if (extraName !== undefined) registered.set(extraName, { name: extraName } as unknown as ToolDefinition)
    registered.set(cfg.toolName, tool)
    return { registered, disposer: () => registered.delete(cfg.toolName) }
  }

  const runTool = async (patch: string, extra?: Record<string, unknown>) =>
    tool.execute({ patch, ...extra }, exec)

  return { fs, recorder, exec, cfg, tool, registerTool, runTool }
}
