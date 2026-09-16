/**
 * Unified intermediate representation shared by both patch parsers.
 *
 * The unified-diff parser and the Codex `apply_patch` parser both emit
 * `ParsedPatch`; downstream planning and application see a single shape so
 * there is exactly one apply path regardless of the input dialect.
 * @module dsh-patch-edit-plus/parse/types
 */
export {};
