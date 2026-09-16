/**
 * Error taxonomy and model-facing message builders.
 *
 * Every failure surfaces as a `PatchError` with a stable machine code so
 * retry/permission/UI layers can branch without parsing prose. Messages are
 * written for the model to self-correct: they carry the concrete file, hunk,
 * position and excerpt needed to fix the patch (no stacks, no internal paths).
 * @module dsh-patch-edit-plus/errors
 */
/** Stable, machine-routable failure codes for patch application. */
export type PatchErrorCode = 
/** The patch text is not a parseable patch in either supported syntax. */
'PARSE'
/** The patch conflicts with on-disk state or with itself. */
 | 'CONFLICT'
/** Arguments or paths are invalid. */
 | 'VALIDATION'
/** Filesystem I/O failed. */
 | 'IO'
/** The requested operation is not available under the current configuration. */
 | 'UNSUPPORTED'
/** A configured resource limit was exceeded. */
 | 'LIMIT';
/** Typed patch failure. */
export declare class PatchError extends Error {
    readonly code: PatchErrorCode;
    constructor(code: PatchErrorCode, message: string);
}
/** Syntax examples embedded in "cannot recognize" errors so the model can retry in a valid dialect. */
export declare const SYNTAX_EXAMPLES: string;
/** PARSE error for input that matches neither supported syntax. */
export declare function unrecognizedPatchError(): PatchError;
/** PARSE error with position information for malformed input. */
export declare function parseError(lineNo: number, why: string): PatchError;
/** Structured error when a recognized Codex patch arrives while the style is disabled (actionable, not a parse failure). */
export declare function codexDisabledError(): PatchError;
/** Structured error when a unified diff arrives while that style is disabled. */
export declare function unifiedDisabledError(): PatchError;
/** CONFLICT error for an Add onto an existing path (Codex semantics). */
export declare function addExistsError(path: string): PatchError;
/** CONFLICT error for update/delete of a missing file. */
export declare function missingFileError(path: string, action: string): PatchError;
/** CONFLICT error for a Move onto an existing path. */
export declare function moveTargetExistsError(path: string): PatchError;
/** CONFLICT error when one resolved file is hit by more than one patch operation. */
export declare function duplicatePathError(path: string): PatchError;
/** VALIDATION error for paths escaping the workspace. */
export declare function pathEscapeError(path: string): PatchError;
/** VALIDATION error when a symlink is on the patch path (followSymlinks: false). */
export declare function symlinkRejectedError(path: string, at: string): PatchError;
/** VALIDATION error when the Add parent directory does not exist (matches the native write tool's behavior). */
export declare function missingParentError(path: string, parent: string): PatchError;
/** LIMIT error for exceeding a configured cap. */
export declare function limitError(what: string, actual: number, limit: number): PatchError;
/** UNSUPPORTED error when delete/move is disabled or no shell capability exists. */
export declare function unsupportedShellError(why: string): PatchError;
interface MismatchInput {
    /** Display path of the file that failed to locate. */
    path: string;
    /** 1-based hunk index within the file section. */
    hunkIndex: number;
    /** 1-based line number where the search started. */
    searchFromLine: number;
    /** The context/delete lines the hunk expected to find. */
    expected: string[];
    /** The file's actual lines around the search origin. */
    actual: string[];
    /** True when the hunk carried an `*** End of File` pin. */
    endOfFile?: boolean;
}
/**
 * Four-element mismatch diagnostic: file + hunk index, search origin, expected
 * preview, actual excerpt — plus a targeted hint when the expected lines look
 * like they still carry patch markers (the classic duplicated-prefix mistake).
 */
export declare function mismatchMessage(input: MismatchInput): string;
/** IO error wrapping a backend failure. */
export declare function ioError(what: string, cause: unknown): PatchError;
export {};
