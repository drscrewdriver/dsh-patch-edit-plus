/**
 * Context-line location with three tolerance levels.
 *
 * Levels, tried in order over the whole search window (exact matches always
 * win over trimmed ones): exact equality → `trimEnd` → full `trim`. Only the
 * context/remove lines participate; add lines are insertions and never
 * constrain the position.
 * @module dsh-patch-edit-plus/apply/seek
 */
/** Locate `expected` inside `fileLines` starting at `from`. Returns the match index or `null`. */
export function findSequence(fileLines, expected, from, opts = {}) {
    const sequence = expected.filter(line => line.kind !== 'add').map(line => line.text);
    if (sequence.length === 0)
        return from <= fileLines.length ? from : null;
    const lastStart = fileLines.length - sequence.length;
    if (lastStart < 0)
        return null;
    const start = opts.endOfFile === true ? Math.max(from, lastStart) : from;
    if (start > lastStart)
        return null;
    const comparators = [
        (a, b) => a === b,
        (a, b) => a.trimEnd() === b.trimEnd(),
        (a, b) => a.trim() === b.trim(),
    ];
    for (const equal of comparators) {
        for (let i = start; i <= lastStart; i += 1) {
            if (matchesAt(fileLines, sequence, i, equal))
                return i;
        }
    }
    return null;
}
function matchesAt(fileLines, sequence, at, equal) {
    for (let j = 0; j < sequence.length; j += 1) {
        if (!equal(fileLines[at + j], sequence[j]))
            return false;
    }
    return true;
}
/**
 * Number of old-side lines a hunk consumes at its match position
 * (context + delete lines).
 */
export function consumedLines(hunk) {
    return hunk.lines.filter(line => line.kind !== 'add').length;
}
