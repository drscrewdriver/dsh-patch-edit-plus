/**
 * Git / unified diff parser.
 *
 * Produces the shared IR (`ParsedPatch`). Accepts full git diffs (with
 * `diff --git` headers, mode lines and rename detection) and bare unified
 * diffs (`---`/`+++` + hunks). Parsing is strict: malformed input raises
 * `PatchError`('PARSE') with a 1-based line number, never a best-effort guess.
 * @module dsh-patch-edit-plus/parse/unified
 */
import { parseError, unrecognizedPatchError } from '../errors.js';
/** Normalize CRLF/CR to LF and split into lines. */
export function normalizeLines(text) {
    const normalized = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    if (normalized === '')
        return [];
    const lines = normalized.split('\n');
    // A trailing newline yields a final empty element; that is not a line.
    if (lines.at(-1) === '')
        lines.pop();
    return lines;
}
/** Strip `a/`/`b/` prefixes and quotes from a git header path. */
function stripPrefix(raw) {
    let path = raw;
    if (path.startsWith('"') && path.endsWith('"') && path.length >= 2) {
        path = path.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\');
    }
    if (path.startsWith('a/') || path.startsWith('b/'))
        path = path.slice(2);
    return path;
}
/** True when the path token means "no file" (add or delete). */
function isDevNull(path) {
    return path === '/dev/null' || path === 'a/dev/null' || path === 'b/dev/null';
}
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
/**
 * Parse a git/unified diff into the shared IR.
 * @throws {@link PatchError} code `PARSE` for any malformed or unrecognized input.
 */
export function parseUnifiedDiff(patch) {
    const lines = normalizeLines(patch);
    if (lines.length === 0)
        throw unrecognizedPatchError();
    const sections = [];
    let current = null;
    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        const lineNo = index + 1;
        if (line.startsWith('diff --git ')) {
            current = { oldPath: null, newPath: null, newFile: false, deletedFile: false, renameFrom: null, renameTo: null, hunks: [], startLine: lineNo };
            sections.push(current);
            index += 1;
            continue;
        }
        if (line.startsWith('--- ')) {
            if (current === null) {
                // Bare unified diff without a git header: open an implicit section.
                current = { oldPath: null, newPath: null, newFile: false, deletedFile: false, renameFrom: null, renameTo: null, hunks: [], startLine: lineNo };
                sections.push(current);
            }
            const token = line.slice(4).trim();
            current.oldPath = isDevNull(token) ? null : stripPrefix(token);
            index += 1;
            continue;
        }
        if (line.startsWith('+++ ')) {
            if (current === null)
                throw parseError(lineNo, '+++ header without a preceding --- header');
            const token = line.slice(4).trim();
            current.newPath = isDevNull(token) ? null : stripPrefix(token);
            index += 1;
            continue;
        }
        if (line.startsWith('new file mode')) {
            if (current === null)
                throw parseError(lineNo, 'mode line outside a file section');
            current.newFile = true;
            index += 1;
            continue;
        }
        if (line.startsWith('deleted file mode')) {
            if (current === null)
                throw parseError(lineNo, 'mode line outside a file section');
            current.deletedFile = true;
            index += 1;
            continue;
        }
        if (line.startsWith('rename from ')) {
            if (current === null)
                throw parseError(lineNo, 'rename line outside a file section');
            current.renameFrom = stripPrefix(line.slice(12).trim());
            index += 1;
            continue;
        }
        if (line.startsWith('rename to ')) {
            if (current === null)
                throw parseError(lineNo, 'rename line outside a file section');
            current.renameTo = stripPrefix(line.slice(10).trim());
            index += 1;
            continue;
        }
        if (line.startsWith('old mode ') || line.startsWith('new mode ') || line.startsWith('similarity index ')
            || line.startsWith('dissimilarity index ') || line.startsWith('index ')) {
            if (current === null)
                throw parseError(lineNo, `"${line.slice(0, 24)}" outside a file section`);
            index += 1;
            continue;
        }
        if (line.startsWith('Binary files ') || line === 'GIT binary patch') {
            throw parseError(lineNo, 'binary patches are not supported; apply the change to the text file instead');
        }
        if (line.startsWith('@@')) {
            if (current === null)
                throw parseError(lineNo, 'hunk header outside a file section');
            const hunk = parseHunkHeader(line, lineNo);
            index += 1;
            const body = parseHunkBody(lines, index, hunk);
            index = body.nextIndex;
            current.hunks.push({ oldStart: hunk.oldStart, lines: body.lines, endOfFile: false, oldNoNewline: body.oldNoNewline, newNoNewline: body.newNoNewline });
            continue;
        }
        // Unknown content: only tolerated as section noise inside a section.
        if (current === null)
            throw unrecognizedPatchError();
        throw parseError(lineNo, `unexpected line "${line.slice(0, 48)}"`);
    }
    if (sections.length === 0)
        throw unrecognizedPatchError();
    return { format: 'unified', ops: sections.map(toOp) };
}
function parseHunkHeader(line, lineNo) {
    const match = HUNK_HEADER.exec(line);
    if (match === null)
        throw parseError(lineNo, `malformed hunk header "${line.slice(0, 48)}"`);
    const oldStart = Number(match[1]);
    const oldCount = match[2] === undefined ? 1 : Number(match[2]);
    const newStart = Number(match[3]);
    const newCount = match[4] === undefined ? 1 : Number(match[4]);
    if (!Number.isSafeInteger(oldStart) || !Number.isSafeInteger(newStart)) {
        throw parseError(lineNo, 'hunk header line numbers out of range');
    }
    return { oldStart, oldCount, newStart, newCount };
}
function parseHunkBody(lines, start, header) {
    const result = [];
    let oldSeen = 0;
    let newSeen = 0;
    let oldNoNewline = false;
    let newNoNewline = false;
    let index = start;
    while (index < lines.length) {
        const line = lines[index];
        if (oldSeen >= header.oldCount && newSeen >= header.newCount
            && (line.startsWith('diff --git ') || line.startsWith('@@') || line.startsWith('--- ') || line.startsWith('*** ')))
            break;
        if (line.startsWith('\\')) {
            // "\ No newline at end of file" — applies to the side of the most
            // recent body line: after `-` it marks the old tail, after `+` the new
            // tail, after a context line both.
            if (result.length === 0)
                throw parseError(index + 1, '\\ "no newline" marker before any hunk line');
            const previous = result.at(-1);
            if (previous?.kind === 'delete')
                oldNoNewline = true;
            else if (previous?.kind === 'add')
                newNoNewline = true;
            else {
                oldNoNewline = true;
                newNoNewline = true;
            }
            index += 1;
            continue;
        }
        const marker = line.charAt(0);
        const text = line.slice(1);
        if (marker === ' ' && (oldSeen < header.oldCount || newSeen < header.newCount)) {
            result.push({ kind: 'context', text });
            oldSeen += 1;
            newSeen += 1;
        }
        else if (marker === '-') {
            result.push({ kind: 'delete', text });
            oldSeen += 1;
        }
        else if (marker === '+') {
            result.push({ kind: 'add', text });
            newSeen += 1;
        }
        else if (marker === '' && oldSeen < header.oldCount && newSeen < header.newCount) {
            // A genuinely empty context line whose leading space was stripped.
            result.push({ kind: 'context', text: '' });
            oldSeen += 1;
            newSeen += 1;
        }
        else {
            throw parseError(index + 1, `unexpected hunk line "${line.slice(0, 48)}"`);
        }
        index += 1;
    }
    if (oldSeen !== header.oldCount || newSeen !== header.newCount) {
        throw parseError(start + 1, `hunk header counts (old ${header.oldCount}, new ${header.newCount}) do not match the hunk body (old ${oldSeen}, new ${newSeen})`);
    }
    if (result.every(line => line.kind === 'context')) {
        throw parseError(start + 1, 'hunk contains no changes (context lines only)');
    }
    return { lines: result, oldNoNewline, newNoNewline, nextIndex: index };
}
function assertPlainPath(path, lineNo) {
    if (path === null)
        throw parseError(lineNo, 'file section without a usable path');
    return path;
}
/** Convert one parsed file section into an IR operation. */
function toOp(section) {
    const headerLine = section.startLine;
    const oldPath = section.oldPath ?? section.renameFrom;
    const newPath = section.newPath ?? section.renameTo;
    if (section.newFile || (section.oldPath === null && section.newPath !== null)) {
        const path = assertPlainPath(newPath, headerLine);
        const addLines = [];
        for (const hunk of section.hunks) {
            for (const line of hunk.lines) {
                if (line.kind === 'add')
                    addLines.push(line.text);
                else if (line.kind === 'delete')
                    throw parseError(headerLine, `new-file section for "${path}" contains delete lines`);
            }
        }
        const lastNewNoNewline = section.hunks.at(-1)?.newNoNewline ?? false;
        return { kind: 'add', path, lines: addLines, trailingNewline: addLines.length === 0 ? false : !lastNewNoNewline };
    }
    if (section.deletedFile || (section.newPath === null && section.oldPath !== null)) {
        const path = assertPlainPath(oldPath, headerLine);
        return { kind: 'delete', path };
    }
    const path = assertPlainPath(oldPath, headerLine);
    const moveTo = newPath !== null && newPath !== path
        ? newPath
        : section.renameTo !== null && section.renameTo !== path ? section.renameTo : undefined;
    return { kind: 'update', path, moveTo, hunks: section.hunks };
}
