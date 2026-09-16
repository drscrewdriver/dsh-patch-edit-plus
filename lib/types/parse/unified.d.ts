/**
 * Git / unified diff parser.
 *
 * Produces the shared IR (`ParsedPatch`). Accepts full git diffs (with
 * `diff --git` headers, mode lines and rename detection) and bare unified
 * diffs (`---`/`+++` + hunks). Parsing is strict: malformed input raises
 * `PatchError`('PARSE') with a 1-based line number, never a best-effort guess.
 * @module dsh-patch-edit-plus/parse/unified
 */
import type { ParsedPatch } from './types.js';
/** Normalize CRLF/CR to LF and split into lines. */
export declare function normalizeLines(text: string): string[];
/**
 * Parse a git/unified diff into the shared IR.
 * @throws {@link PatchError} code `PARSE` for any malformed or unrecognized input.
 */
export declare function parseUnifiedDiff(patch: string): ParsedPatch;
