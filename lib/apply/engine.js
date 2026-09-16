/**
 * Two-phase atomic application engine.
 *
 * Phase 1 (verify) reads every target and computes the full in-memory result;
 * ANY failure aborts the whole patch with zero bytes written. Phase 2 (apply)
 * only writes what verify already validated.
 * @module dsh-patch-edit-plus/apply/engine
 */
import { PatchError, addExistsError, mismatchMessage, missingFileError } from '../errors.js';
import { readFile, statFile, writeFile } from '../fsops.js';
import { moveFile, removeFile, assertShellReady } from '../shellops.js';
import { consumedLines, findSequence } from './seek.js';
import { needsShell } from './plan.js';
/**
 * Verify the whole patch: read every file, locate every hunk, compute every
 * result. Throws on the first failure — nothing has been written.
 */
export async function verifyPatch(ctx, exec, plan, cfg) {
    if (plan.entries.some(entry => needsShell(entry.op))) {
        assertShellReady(ctx, cfg);
    }
    const changes = [];
    for (const entry of plan.entries) {
        const { op } = entry;
        if (op.kind === 'add') {
            const existing = await statFile(ctx, exec, entry.target);
            if (existing !== undefined)
                throw addExistsError(op.path);
            changes.push({ entry, before: null, after: joinContent(op.lines, op.trailingNewline, false) });
            continue;
        }
        if (op.kind === 'delete') {
            const existing = await statFile(ctx, exec, entry.target);
            if (existing === undefined)
                throw missingFileError(op.path, 'delete');
            const before = await readFile(ctx, exec, entry.target);
            changes.push({ entry, before, after: null });
            continue;
        }
        // update
        const before = await readFile(ctx, exec, entry.target);
        const after = op.hunks.length === 0 ? before : applyHunksToContent(op.path, before, op.hunks);
        changes.push({ entry, before, after });
    }
    return changes;
}
/** Apply phase: writes only — verify already settled every decision. */
export async function applyPatch(ctx, exec, changes, cfg, sandboxPolicy) {
    for (const change of changes) {
        const { op } = change.entry;
        if (op.kind === 'delete') {
            await removeFile(ctx, exec, cfg, change.entry.target, sandboxPolicy);
            continue;
        }
        if (op.kind === 'add') {
            await writeFile(ctx, exec, change.entry.target, change.after ?? '', sandboxPolicy);
            continue;
        }
        if (change.after !== null && change.after !== change.before) {
            await writeFile(ctx, exec, change.entry.target, change.after, sandboxPolicy);
        }
        if (change.entry.moveToTarget !== undefined && op.kind === 'update') {
            await moveFile(ctx, exec, cfg, change.entry.target, change.entry.moveToTarget, sandboxPolicy);
        }
    }
}
/** Pure-move entries (update with moveTo and no hunks) skip the write. */
export function isPureMove(change) {
    return change.entry.op.kind === 'update'
        && change.entry.op.hunks.length === 0
        && change.entry.moveToTarget !== undefined;
}
function joinContent(lines, trailingNewline, crlf) {
    const text = lines.join('\n') + (trailingNewline && lines.length > 0 ? '\n' : '');
    return crlf ? text.replaceAll('\n', '\r\n') : text;
}
/**
 * Apply hunks to raw file content with newline fidelity: CRLF files are
 * normalized for matching and written back in their original style; the
 * trailing-newline state of the file tail is preserved exactly.
 */
export function applyHunksToContent(path, before, hunks) {
    const crlf = before.includes('\r\n');
    const beforeEndsWithNewline = before.endsWith('\n');
    const workLines = splitLines(before);
    const output = [];
    let cursor = 0;
    let lastMatchEnd = -1;
    for (let h = 0; h < hunks.length; h += 1) {
        const hunk = hunks[h];
        const match = locate(workLines, hunk, cursor, path, h + 1);
        output.push(...workLines.slice(cursor, match));
        let pos = match;
        for (const line of hunk.lines) {
            if (line.kind === 'context') {
                output.push(workLines[pos] ?? '');
                pos += 1;
            }
            else if (line.kind === 'delete') {
                pos += 1;
            }
            else {
                output.push(line.text);
            }
        }
        cursor = pos;
        lastMatchEnd = pos;
    }
    output.push(...workLines.slice(cursor));
    const reachesEnd = lastMatchEnd === workLines.length;
    const afterEndsWithNewline = resolveTrailingNewline(hunks.at(-1), reachesEnd, beforeEndsWithNewline);
    return joinContent(output, afterEndsWithNewline, crlf);
}
/** Split raw content into LF lines, dropping the trailing-newline artifact. */
function splitLines(content) {
    const withoutTrailing = content.endsWith('\n') ? content.slice(0, -1) : content;
    if (withoutTrailing === '')
        return [];
    return withoutTrailing.split('\n').map(line => line.endsWith('\r') ? line.slice(0, -1) : line);
}
function resolveTrailingNewline(lastHunk, reachesEnd, beforeEndsWithNewline) {
    if (lastHunk === undefined || !reachesEnd)
        return beforeEndsWithNewline;
    const tail = newSideTail(lastHunk);
    if (tail === 'context')
        return beforeEndsWithNewline;
    // Tail is an inserted line: newline-terminated unless the patch explicitly
    // marked the new side as lacking the final newline.
    return lastHunk.newNoNewline !== true;
}
function newSideTail(hunk) {
    for (let i = hunk.lines.length - 1; i >= 0; i -= 1) {
        const kind = hunk.lines[i].kind;
        if (kind === 'context' || kind === 'add')
            return kind;
    }
    return 'context';
}
/** Locate one hunk with the header-line hint, falling back to the plain cursor. */
function locate(fileLines, hunk, cursor, path, hunkIndex) {
    const options = { endOfFile: hunk.endOfFile };
    if (hunk.oldStart !== undefined && hunk.oldStart > 0) {
        const hinted = Math.max(cursor, hunk.oldStart - 1);
        const atHint = findSequence(fileLines, hunk.lines, hinted, options);
        if (atHint !== null)
            return atHint;
    }
    const found = findSequence(fileLines, hunk.lines, cursor, options);
    if (found !== null)
        return found;
    throw new PatchError('VALIDATION', mismatchMessage({
        path,
        hunkIndex,
        searchFromLine: cursor + 1,
        expected: hunk.lines.filter((line) => line.kind !== 'add').map(line => line.text),
        actual: fileLines.slice(cursor, cursor + 10),
        endOfFile: hunk.endOfFile,
    }));
}
export { consumedLines };
