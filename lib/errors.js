/**
 * Error taxonomy and model-facing message builders.
 *
 * Every failure surfaces as a `PatchError` with a stable machine code so
 * retry/permission/UI layers can branch without parsing prose. Messages are
 * written for the model to self-correct: they carry the concrete file, hunk,
 * position and excerpt needed to fix the patch (no stacks, no internal paths).
 * @module dsh-patch-edit-plus/errors
 */
/** Typed patch failure. */
export class PatchError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'PatchError';
        this.code = code;
    }
}
/** Syntax examples embedded in "cannot recognize" errors so the model can retry in a valid dialect. */
export const SYNTAX_EXAMPLES = [
    'Supported patch styles:',
    '1. git/unified diff:',
    '--- a/file.txt',
    '+++ b/file.txt',
    '@@ -1,3 +1,3 @@',
    ' context',
    '-old line',
    '+new line',
    '2. Codex apply_patch syntax:',
    '*** Begin Patch',
    '*** Update File: file.txt',
    '@@',
    ' context',
    '-old line',
    '+new line',
    '*** End Patch',
].join('\n');
/** PARSE error for input that matches neither supported syntax. */
export function unrecognizedPatchError() {
    return new PatchError('PARSE', `Cannot recognize the patch text as either supported syntax.\n${SYNTAX_EXAMPLES}`);
}
/** PARSE error with position information for malformed input. */
export function parseError(lineNo, why) {
    return new PatchError('PARSE', `Invalid patch at line ${lineNo}: ${why}`);
}
/** Structured error when a recognized Codex patch arrives while the style is disabled (actionable, not a parse failure). */
export function codexDisabledError() {
    return new PatchError('UNSUPPORTED', 'The patch was recognized as Codex `apply_patch` syntax, but that style is currently disabled. '
        + 'Retry with a git/unified diff patch instead, or enable the Codex style by setting '
        + '`allowCodexPatch: true` in the dsh-patch-edit-plus plugin configuration.');
}
/** Structured error when a unified diff arrives while that style is disabled. */
export function unifiedDisabledError() {
    return new PatchError('UNSUPPORTED', 'The patch was recognized as a git/unified diff, but that style is currently disabled. '
        + 'Enable it by setting `allowUnifiedDiff: true` in the dsh-patch-edit-plus plugin configuration.');
}
/** CONFLICT error for an Add onto an existing path (Codex semantics). */
export function addExistsError(path) {
    return new PatchError('CONFLICT', `Add File targets "${path}" but the file already exists. Use an Update hunk to modify it, or Delete it first.`);
}
/** CONFLICT error for update/delete of a missing file. */
export function missingFileError(path, action) {
    return new PatchError('CONFLICT', `Cannot ${action} "${path}": the file does not exist.`);
}
/** CONFLICT error for a Move onto an existing path. */
export function moveTargetExistsError(path) {
    return new PatchError('CONFLICT', `Cannot move to "${path}": the target already exists.`);
}
/** CONFLICT error when one resolved file is hit by more than one patch operation. */
export function duplicatePathError(path) {
    return new PatchError('CONFLICT', `The patch touches "${path}" in more than one file section. Split it into separate apply_patch calls with one section per file.`);
}
/** VALIDATION error for paths escaping the workspace. */
export function pathEscapeError(path) {
    return new PatchError('VALIDATION', `Path "${path}" escapes the session workspace. Patch paths must stay inside the workspace.`);
}
/** VALIDATION error when a symlink is on the patch path (followSymlinks: false). */
export function symlinkRejectedError(path, at) {
    return new PatchError('VALIDATION', `Path "${path}" traverses the symbolic link "${at}". Symbolic links are rejected by the default followSymlinks: false policy.`);
}
/** VALIDATION error when the Add parent directory does not exist (matches the native write tool's behavior). */
export function missingParentError(path, parent) {
    return new PatchError('VALIDATION', `Cannot add "${path}": parent directory "${parent}" does not exist. Create the directory first (for example with the bash tool).`);
}
/** LIMIT error for exceeding a configured cap. */
export function limitError(what, actual, limit) {
    return new PatchError('LIMIT', `Patch rejected: ${what} is ${actual}, exceeding the configured limit of ${limit}. Split the patch into smaller apply_patch calls.`);
}
/** UNSUPPORTED error when delete/move is disabled or no shell capability exists. */
export function unsupportedShellError(why) {
    return new PatchError('UNSUPPORTED', `${why} Apply the change with a bash command instead (for example \`rm\` or \`mv\`), or adjust the dsh-patch-edit-plus deleteBackend configuration.`);
}
const MAX_PREVIEW_LINES = 12;
const MAX_ACTUAL_LINES = 10;
/** Render one line with visible whitespace so exact-match failures are diagnosable. */
function visible(line) {
    return line.replaceAll(' ', '[space]').replaceAll('\t', '[tab]') || '[empty]';
}
/**
 * Four-element mismatch diagnostic: file + hunk index, search origin, expected
 * preview, actual excerpt — plus a targeted hint when the expected lines look
 * like they still carry patch markers (the classic duplicated-prefix mistake).
 */
export function mismatchMessage(input) {
    const expected = input.expected.slice(0, MAX_PREVIEW_LINES).map(visible);
    const actual = input.actual.slice(0, MAX_ACTUAL_LINES).map(visible);
    const parts = [
        `Hunk ${input.hunkIndex} of "${input.path}" does not apply: the context does not match the file.`,
        `Search started at line ${input.searchFromLine}${input.endOfFile ? ' (pinned to end of file)' : ''}.`,
        `Expected lines:\n${expected.join('\n')}`,
        `File around the search origin:\n${actual.length > 0 ? actual.join('\n') : '[end of file]'}`,
    ];
    const markerHint = input.expected.find(line => /^[+\-@@]/.test(line));
    if (markerHint !== undefined) {
        parts.push(`Hint: an expected line starts with a patch marker ("${visible(markerHint).slice(0, 40)}"). `
            + 'Inside an Update hunk only the context/removed lines must match the file exactly as it exists — '
            + 'do not include "+"/"-"/"@@" prefixes from an outer diff in the hunk body.');
    }
    return parts.join('\n');
}
/** IO error wrapping a backend failure. */
export function ioError(what, cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return new PatchError('IO', `${what}: ${detail}`);
}
