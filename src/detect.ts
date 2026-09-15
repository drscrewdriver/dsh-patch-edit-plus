/**
 * Patch format detection.
 *
 * Runs BEFORE any parser so a recognized-but-disabled style can produce an
 * actionable hint instead of a generic parse error (Codex syntax is a strong
 * prior for GPT-family models; a silent failure traps them in retry loops).
 * @module dsh-patch-edit-plus/detect
 */

import { unrecognizedPatchError } from './errors.js'

export type PatchFormat = 'unified' | 'codex'

const HUNK_HINT = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m

/**
 * Classify patch text. Order matters: the `*** Begin Patch` sentinel wins
 * first, then explicit unified-diff markers, then Codex section headers.
 * @throws {@link PatchError} code `PARSE` (with both syntax examples) when the text matches neither supported syntax.
 */
export function detectFormat(patch: string): PatchFormat {
  const normalized = patch.replaceAll('\r\n', '\n').trimStart()
  if (normalized.startsWith('*** Begin Patch')) return 'codex'
  if (normalized.startsWith('diff --git ')) return 'unified'
  if (normalized.startsWith('--- ')) return 'unified'
  if (HUNK_HINT.test(normalized)) return 'unified'
  if (normalized.includes('*** Add File:') || normalized.includes('*** Update File:') || normalized.includes('*** Delete File:')) return 'codex'
  throw unrecognizedPatchError()
}
