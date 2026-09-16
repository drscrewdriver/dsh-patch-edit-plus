/**
 * Patch format detection.
 *
 * Runs BEFORE any parser so a recognized-but-disabled style can produce an
 * actionable hint instead of a generic parse error (Codex syntax is a strong
 * prior for GPT-family models; a silent failure traps them in retry loops).
 * @module dsh-patch-edit-plus/detect
 */
export type PatchFormat = 'unified' | 'codex';
/**
 * Classify patch text. Order matters: the `*** Begin Patch` sentinel wins
 * first, then explicit unified-diff markers, then Codex section headers.
 * @throws {@link PatchError} code `PARSE` (with both syntax examples) when the text matches neither supported syntax.
 */
export declare function detectFormat(patch: string): PatchFormat;
