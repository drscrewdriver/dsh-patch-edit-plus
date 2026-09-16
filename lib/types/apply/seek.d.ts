/**
 * Context-line location with three tolerance levels.
 *
 * Levels, tried in order over the whole search window (exact matches always
 * win over trimmed ones): exact equality → `trimEnd` → full `trim`. Only the
 * context/remove lines participate; add lines are insertions and never
 * constrain the position.
 * @module dsh-patch-edit-plus/apply/seek
 */
import type { PatchLine } from '../parse/types.js';
/** Locate `expected` inside `fileLines` starting at `from`. Returns the match index or `null`. */
export declare function findSequence(fileLines: readonly string[], expected: readonly PatchLine[], from: number, opts?: {
    endOfFile?: boolean;
}): number | null;
/**
 * Number of old-side lines a hunk consumes at its match position
 * (context + delete lines).
 */
export declare function consumedLines(hunk: {
    lines: readonly PatchLine[];
}): number;
