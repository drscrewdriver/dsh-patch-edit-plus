/**
 * Unified intermediate representation shared by both patch parsers.
 *
 * The unified-diff parser and the Codex `apply_patch` parser both emit
 * `ParsedPatch`; downstream planning and application see a single shape so
 * there is exactly one apply path regardless of the input dialect.
 * @module dsh-patch-edit-plus/parse/types
 */

/** One line inside an update hunk: keep it (`context`), remove (`delete`) or insert (`add`). */
export interface PatchLine {
  kind: 'context' | 'delete' | 'add'
  text: string
}

/**
 * One hunk of an update operation. Hunk lines are applied in order at the
 * position located by context matching (unified hunk headers only accelerate
 * the search, they never pin it).
 */
export interface Hunk {
  /** Codex `@@ <label>` label, when present. */
  contextLabel?: string
  lines: PatchLine[]
  /**
   * Codex `*** End of File` marker: the hunk must land at end-of-file, so the
   * search window is pinned to the last possible position.
   */
  endOfFile: boolean
  /** Unified hunk header old-file start line (1-based); a search hint only. */
  oldStart?: number
  /** `\ No newline` marker seen after a `-` (or context) line: the OLD file tail lacks the newline. */
  oldNoNewline?: boolean
  /** `\ No newline` marker seen after a `+` line: the NEW file tail lacks the newline. */
  newNoNewline?: boolean
}

export type PatchOp =
  | {
      /** Create a file with the given content. */
      kind: 'add'
      path: string
      lines: string[]
      trailingNewline: boolean
    }
  | {
      /** Remove a file (runs through the shell backend). */
      kind: 'delete'
      path: string
    }
  | {
      /** Modify a file in place, optionally moving it (rename or Codex Move to). */
      kind: 'update'
      path: string
      moveTo?: string
      hunks: Hunk[]
    }

/** A fully parsed patch in the shared IR. */
export interface ParsedPatch {
  format: 'unified' | 'codex'
  ops: PatchOp[]
}

/** Model-facing action label for one changed file (Codex output semantics). */
export type FileAction = 'added' | 'modified' | 'deleted'
