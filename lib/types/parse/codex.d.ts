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
import type { ParsedPatch } from './types.js';
/**
 * Parse a Codex `apply_patch` patch into the shared IR.
 * @throws {@link PatchError} code `PARSE` for malformed or unrecognized input.
 */
export declare function parseCodexPatch(patch: string): ParsedPatch;
