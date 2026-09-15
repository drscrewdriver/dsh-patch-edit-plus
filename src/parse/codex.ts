/**
 * Codex `apply_patch` syntax parser.
 *
 * Accepts the OpenAI Codex CLI patch grammar:
 * ```
 * *** Begin Patch
 * *** Add File: path
 * +content lines
 * *** Update File: path
 * *** Move to: new-path
 * @@ optional context label
 *  context
 * -removed
 * +added
 * *** End of File
 * *** Delete File: path
 * *** End Patch
 * ```
 * A wrapper (heredoc, code fence, prose) around the markers is tolerated by
 * slicing from `*** Begin Patch` to the last `*** End Patch`.
 * @module dsh-patch-edit-plus/parse/codex
 */

import { parseError, unrecognizedPatchError } from '../errors.js'
import type { Hunk, ParsedPatch, PatchLine, PatchOp } from './types.js'
import { normalizeLines } from './unified.js'

const BEGIN = '*** Begin Patch'
const END = '*** End Patch'
const ADD_FILE = '*** Add File: '
const DELETE_FILE = '*** Delete File: '
const UPDATE_FILE = '*** Update File: '
const MOVE_TO = '*** Move to: '
const END_OF_FILE = '*** End of File'
const ENVIRONMENT_ID = '*** Environment ID:'

/**
 * Parse a Codex `apply_patch` patch into the shared IR.
 * @throws {@link PatchError} code `PARSE` for malformed or unrecognized input.
 */
export function parseCodexPatch(patch: string): ParsedPatch {
  const slice = extractPatchBody(patch)
  if (slice === null) throw unrecognizedPatchError()
  const lines = normalizeLines(slice)
  // normalizeLines dropped the trailing empty element of "*** End Patch\n".
  if (lines.at(-1) !== END) throw parseError(lines.length, `patch must end with "${END}"`)

  const ops: PatchOp[] = []
  let index = 1 // skip "*** Begin Patch"

  while (index < lines.length) {
    const line = lines[index]
    const lineNo = index + 1

    if (line === END) { index += 1; continue }
    if (line.startsWith(ENVIRONMENT_ID)) {
      throw parseError(lineNo, `${ENVIRONMENT_ID} patches are environment-bound and not supported here; regenerate the patch without an Environment ID`)
    }
    if (line.startsWith(ADD_FILE)) {
      const op = parseAddFile(lines, index)
      ops.push(op.op)
      index = op.nextIndex
      continue
    }
    if (line.startsWith(DELETE_FILE)) {
      const path = line.slice(DELETE_FILE.length).trim()
      if (path === '') throw parseError(lineNo, `${DELETE_FILE}requires a file path`)
      ops.push({ kind: 'delete', path })
      index += 1
      continue
    }
    if (line.startsWith(UPDATE_FILE)) {
      const op = parseUpdateFile(lines, index)
      ops.push(op.op)
      index = op.nextIndex
      continue
    }
    throw parseError(lineNo, `unexpected line "${line.slice(0, 48)}"; expected ${ADD_FILE}/${UPDATE_FILE}/${DELETE_FILE} or ${END}`)
  }

  if (ops.length === 0) throw parseError(1, 'patch contains no file operations')
  return { format: 'codex', ops }
}

/**
 * Slice the patch body out of an optional wrapper: returns the text from
 * `*** Begin Patch` through the LAST `*** End Patch` line (inclusive), or
 * `null` when the markers are absent.
 */
function extractPatchBody(patch: string): string | null {
  const normalized = patch.replaceAll('\r\n', '\n')
  const begin = normalized.indexOf(BEGIN)
  if (begin < 0) return null
  const endMarker = normalized.lastIndexOf(END)
  if (endMarker < begin) return null
  return normalized.slice(begin, endMarker + END.length)
}

function parseAddFile(lines: string[], start: number): { op: PatchOp; nextIndex: number } {
  const path = lines[start].slice(ADD_FILE.length).trim()
  if (path === '') throw parseError(start + 1, `${ADD_FILE}requires a file path`)
  const content: string[] = []
  let index = start + 1
  while (index < lines.length) {
    const line = lines[index]
    if (line.startsWith('+')) { content.push(line.slice(1)); index += 1; continue }
    if (line === END || line.startsWith('*** ')) break
    throw parseError(index + 1, `content lines of "${path}" must start with "+"; got "${line.slice(0, 48)}"`)
  }
  return { op: { kind: 'add', path, lines: content, trailingNewline: content.length > 0 }, nextIndex: index }
}

function parseUpdateFile(lines: string[], start: number): { op: PatchOp; nextIndex: number } {
  const path = lines[start].slice(UPDATE_FILE.length).trim()
  if (path === '') throw parseError(start + 1, `${UPDATE_FILE}requires a file path`)
  let index = start + 1
  let moveTo: string | undefined

  if (lines[index]?.startsWith(MOVE_TO)) {
    const target = lines[index].slice(MOVE_TO.length).trim()
    if (target === '') throw parseError(index + 1, `${MOVE_TO}requires a file path`)
    moveTo = target
    index += 1
  }

  const hunks: Hunk[] = []
  while (index < lines.length) {
    const line = lines[index]
    if (line === END) break
    if (line.startsWith(UPDATE_FILE) || line.startsWith(ADD_FILE) || line.startsWith(DELETE_FILE)) break
    if (!line.startsWith('@@')) {
      throw parseError(index + 1, `expected an "@@" hunk header inside the update of "${path}"; got "${line.slice(0, 48)}"`)
    }
    const label = line.slice(2).trim()
    const parsed = parseCodexHunk(lines, index + 1, path)
    hunks.push({ contextLabel: label === '' ? undefined : label, lines: parsed.lines, endOfFile: parsed.endOfFile })
    index = parsed.nextIndex
  }

  if (hunks.length === 0) {
    // A bare `Update File` + `Move to` without hunks is a pure rename.
    if (moveTo === undefined) throw parseError(start + 1, `update of "${path}" contains no hunks`)
  }
  return { op: { kind: 'update', path, moveTo, hunks }, nextIndex: index }
}

function parseCodexHunk(lines: string[], start: number, path: string): { lines: PatchLine[]; endOfFile: boolean; nextIndex: number } {
  const result: PatchLine[] = []
  let endOfFile = false
  let index = start

  while (index < lines.length) {
    const line = lines[index]
    if (line === END_OF_FILE) { endOfFile = true; index += 1; break }
    if (line === END) break
    if (line.startsWith('@@')) break
    if (line.startsWith('*** ')) break
    const marker = line.charAt(0)
    const text = line.slice(1)
    if (marker === ' ') result.push({ kind: 'context', text })
    else if (marker === '-') result.push({ kind: 'delete', text })
    else if (marker === '+') result.push({ kind: 'add', text })
    else if (line === '') result.push({ kind: 'context', text: '' })
    else throw parseError(index + 1, `hunk lines of "${path}" must start with " ", "-", or "+"; got "${line.slice(0, 48)}"`)
    index += 1
  }

  if (result.length === 0) throw parseError(start + 1, `hunk of "${path}" is empty`)
  if (result.every(line => line.kind === 'context')) {
    throw parseError(start + 1, `hunk of "${path}" contains no changes (context lines only)`)
  }
  return { lines: result, endOfFile, nextIndex: index }
}
