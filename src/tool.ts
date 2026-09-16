/**
 * The single model-facing `apply_patch` tool definition.
 *
 * The description carries an explicit routing guide so the model reaches for
 * the native `edit` tool on cheap single-point changes instead of paying for
 * a patch, and reserves `apply_patch` for large-file small edits, cross-file
 * batch edits, creation, deletion and renames.
 * @module dsh-patch-edit-plus/tool
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolResult, ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { ResolvedConfig } from './config.js'
import { PatchError, codexDisabledError, limitError, unifiedDisabledError } from './errors.js'
import { detectFormat } from './detect.js'
import { resolveSandboxPolicy } from './policy.js'
import { parseCodexPatch } from './parse/codex.js'
import { parseUnifiedDiff } from './parse/unified.js'
import type { FileAction, ParsedPatch } from './parse/types.js'
import { buildPlan } from './apply/plan.js'
import { applyPatch, verifyPatch } from './apply/engine.js'
import type { VerifiedChange } from './apply/engine.js'

/** Per-file diff carried in the canonical value (replay-safe presentationMeta source). */
export type ResultDiff = {
  path: string
  oldText: string | null
  newText: string
  /** True when the diff was dropped because of `maxDiffBytes`. */
  truncated?: boolean
}

/** Canonical tool output value. */
export type ApplyPatchResult = {
  format: 'unified' | 'codex'
  applied: boolean
  summary: string
  files: { path: string; action: FileAction; from?: string }[]
  stats: { files: number; added: number; removed: number }
  wallTimeMs: number
  diffs: ResultDiff[]
}

const ROUTING_GUIDE = [
  'When to use which editing tool:',
  '- Single small change in ONE already-read file: prefer the native edit tool (cheaper than a patch).',
  '- apply_patch is the right choice when: (a) a SMALL change sits inside a LARGE file (a patch avoids echoing the whole file), '
    + '(b) the same call must change MANY files at once (batch), (c) a new file with substantial content is created, '
    + '(d) a file is deleted or renamed, or (e) several disjoint spots in one file change at once.',
  '- Do not use apply_patch for trivial one-line single-file edits when the native edit tool is available.',
].join('\n')

/**
 * Build the (frozen) tool definition. The tool name is passed in resolved
 * form so registration-side rename avoidance can mint variant names.
 */
export function buildApplyPatchTool(toolName: string, ctx: Context, cfg: ResolvedConfig): ToolDefinition {
  const styles = [
    cfg.allowUnifiedDiff ? 'git/unified diff (default)' : null,
    cfg.allowCodexPatch ? 'Codex apply_patch syntax' : null,
  ].filter(style => style !== null).join(' and ')

  const definition = defineTool({
    name: toolName,
    description: `Apply a patch-style change to one or more text files, all-or-nothing: every hunk is verified against current file content first, and nothing is written unless the whole patch applies. Accepts ${styles}. `
      + 'Add, update (multi-hunk), delete and move/rename operations are supported. Pass dryRun: true to validate without writing.\n' + ROUTING_GUIDE,
    parameters: {
      patch: { type: 'string', required: true, description: 'The full patch text in an accepted style.' },
      dryRun: { type: 'boolean', description: 'Validate the patch and report what would change, without writing.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          format: { type: 'string', required: true, enum: ['unified', 'codex'] },
          applied: { type: 'boolean', required: true },
          summary: { type: 'string', required: true },
          files: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                path: { type: 'string', required: true },
                action: { type: 'string', required: true, enum: ['added', 'modified', 'deleted'] },
                from: { type: 'string', description: 'Original path when the file was moved or renamed.' },
              },
            },
          },
          stats: {
            type: 'object',
            additionalProperties: false,
            required: true,
            properties: {
              files: { type: 'number', required: true },
              added: { type: 'number', required: true },
              removed: { type: 'number', required: true },
            },
          },
          wallTimeMs: { type: 'number', required: true },
          diffs: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                path: { type: 'string', required: true },
                oldText: { required: true, oneOf: [{ type: 'string' }, { type: 'null' }] },
                newText: { type: 'string', required: true },
                truncated: { type: 'boolean', description: 'Diff content dropped because it exceeded maxDiffBytes.' },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatResultText(value as unknown as ApplyPatchResult) }],
      presentationMeta: (_args, value) => ({ diffs: (value as unknown as ApplyPatchResult).diffs }),
    },
    async execute(args, exec) {
      const start = Date.now()
      const patch = (args as { patch?: unknown }).patch
      if (typeof patch !== 'string' || patch.trim() === '') {
        throw new PatchError('VALIDATION', 'parameter "patch" must be a non-empty string containing the patch text')
      }
      if (patch.length > cfg.maxPatchBytes) {
        throw limitError('patch size in bytes', patch.length, cfg.maxPatchBytes)
      }
      const format = detectFormat(patch)
      if (format === 'codex' && !cfg.allowCodexPatch) throw codexDisabledError()
      if (format === 'unified' && !cfg.allowUnifiedDiff) throw unifiedDisabledError()
      const parsed: ParsedPatch = format === 'codex' ? parseCodexPatch(patch) : parseUnifiedDiff(patch)

      const dryRun = typeof (args as { dryRun?: unknown }).dryRun === 'boolean'
        ? (args as { dryRun: boolean }).dryRun
        : cfg.dryRunByDefault

      // Resolve the sandbox policy BEFORE planning: the plan resolves every path
      // against the policy's workspace root, and the same policy is stamped on
      // every mutation below, so planned paths and fenced paths share one root.
      const sandboxPolicy = resolveSandboxPolicy(ctx, exec)
      const plan = await buildPlan(ctx, exec, parsed, cfg, sandboxPolicy)
      const changes = await verifyPatch(ctx, exec, plan, cfg)
      if (!dryRun) {
        await applyPatch(ctx, exec, changes, cfg, sandboxPolicy)
      }
      return buildResult(format, !dryRun, changes, cfg, Date.now() - start)
    },
    presentCall: (args) => ({
      card: 'generic' as const,
      title: 'Apply patch',
      kind: 'other' as const,
      rawInput: (args as { patch: string }).patch,
    }),
    presentResult: (_args, result: ToolResult) => {
      if (result.isError) return undefined
      const diffs = extractDiffs(result.meta)
      if (diffs.length === 0) return { card: 'generic' as const, title: 'Applied patch' }
      return { card: 'diff' as const, title: 'Applied patch', diffs }
    },
  })
  return Object.freeze(definition)
}

/** Narrow the persisted presentation meta back to diffs (nested dispatch has no meta). */
function extractDiffs(meta: unknown): { path: string; oldText: string | null; newText: string }[] {
  if (typeof meta !== 'object' || meta === null) return []
  const candidate = (meta as { diffs?: unknown }).diffs
  if (!Array.isArray(candidate)) return []
  const diffs = candidate.filter((item): item is { path: string; oldText: string | null; newText: string } =>
    typeof item === 'object' && item !== null
    && typeof (item as { path?: unknown }).path === 'string'
    && typeof (item as { newText?: unknown }).newText === 'string')
  return diffs
}

/** Build the canonical result value (grouped Codex-style + capped diffs). */
function buildResult(format: ParsedPatch['format'], applied: boolean, changes: readonly VerifiedChange[], cfg: ResolvedConfig, wallTimeMs: number): ApplyPatchResult {
  const files: ApplyPatchResult['files'] = []
  let added = 0
  let removed = 0
  const diffs: ResultDiff[] = []

  for (const change of changes) {
    const { op } = change.entry
    if (op.kind === 'add') {
      added += op.lines.length
      files.push({ path: op.path, action: 'added' })
      diffs.push(cappedDiff(op.path, null, change.after ?? '', cfg.maxDiffBytes))
      continue
    }
    if (op.kind === 'delete') {
      removed += change.before === null ? 0 : change.before.split('\n').length
      files.push({ path: op.path, action: 'deleted' })
      diffs.push(cappedDiff(op.path, change.before ?? '', '', cfg.maxDiffBytes))
      continue
    }
    const moved = change.entry.moveToTarget !== undefined
    files.push(moved
      ? { path: op.moveTo ?? op.path, action: 'modified', from: op.path }
      : { path: op.path, action: 'modified' })
    if (change.before !== null && change.after !== null && !(moved && change.after === change.before)) {
      for (const hunk of op.hunks) {
        added += hunk.lines.filter(line => line.kind === 'add').length
        removed += hunk.lines.filter(line => line.kind === 'delete').length
      }
      diffs.push(cappedDiff(moved ? op.moveTo ?? op.path : op.path, change.before, change.after, cfg.maxDiffBytes))
    }
  }

  const groups = (action: FileAction) => files.filter(file => file.action === action)
  const verb = applied ? 'Applied patch' : 'Dry run: the patch applies cleanly'
  const summary = `${verb}: ${files.length} file(s), ${groups('added').length} added, ${groups('modified').length} modified, ${groups('deleted').length} deleted, +${added} -${removed} lines`

  return { format, applied, summary, files, stats: { files: files.length, added, removed }, wallTimeMs, diffs }
}

/** Cap one file diff: over the limit the contents are emptied and the entry marked truncated. */
function cappedDiff(path: string, oldText: string | null, newText: string, maxDiffBytes: number): ResultDiff {
  if (oldText === null && newText === '') return { path, oldText: null, newText: '' }
  const size = (oldText?.length ?? 0) + newText.length
  if (size > maxDiffBytes) return { path, oldText: null, newText: '', truncated: true }
  return { path, oldText, newText }
}

/** Model-facing text: grouped added → modified → deleted listing. */
export function formatResultText(value: ApplyPatchResult): string {
  const lines: string[] = [value.summary]
  const group = (action: FileAction, letter: string) => {
    for (const file of value.files.filter(f => f.action === action)) {
      lines.push(`${letter} ${file.path}${file.from !== undefined ? ` (from ${file.from})` : ''}`)
    }
  }
  group('added', 'A')
  group('modified', 'M')
  group('deleted', 'D')
  if (!value.applied) lines.push('Nothing was written (dry run).')
  return lines.join('\n')
}
