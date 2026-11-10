/**
 * Model-facing routing guidance for the patch tool.
 *
 * DSH 0.2.2-rc.1 ships its own `apply_patch` inside `dsh-tool-fs` and, with it,
 * the first official guidance text for the tool: one description line plus a
 * `tool:apply_patch` system-prompt section placed at `TOOL_APPLY_PATCH`
 * (1350, between edit 1300 and glob 1400). Older hosts have no such section,
 * so a plugin-provided patch tool is only described by its tool description —
 * a weaker, per-call surface. This module reproduces the official shape on
 * every host line: one short line in the description, one section in the
 * system prompt.
 *
 * What is borrowed from 0.2.2 and what is not:
 * - Borrowed: the explicit "prefer apply_patch over separate edit calls"
 *   phrasing, the hunk-context advice, "a rejected patch changes nothing",
 *   and the scope-aware empty text when the tool is absent.
 * - Not borrowed: "not rolled back". Verification is all-or-nothing here, but
 *   the write phase is sequential without rollback, so claiming atomicity
 *   after the first byte would be false. The text says what is true instead.
 * @module dsh-patch-edit-plus/guidance
 */
import type { Context } from '@deepseek-ai/cordis';
import type { GuidanceMode } from './config.js';
/** The short routing line carried by the tool description (repeated every call). */
export declare const PATCH_ROUTING_LINE = "Prefer apply_patch over separate edit calls when a change spans several files, several separated regions of one file, or adds/deletes/moves files; a single small replacement in an already-read file is still cheaper through the native edit tool.";
/**
 * The full guidance paragraph registered as a system-prompt section. The
 * description line stays short on purpose: the section is what keeps the model
 * honest across turns, exactly as the official 0.2.2 composition does.
 */
export declare const PATCH_GUIDANCE_TEXT = "Prefer apply_patch over separate edit calls when a change spans several files, several separated regions of one file, or adds, deletes or moves files. Give every hunk enough surrounding context lines to match exactly one place in the current file. Every hunk is matched against the current file content before anything is written, so a rejected patch changes nothing \u2014 re-read the file and retry with a corrected patch instead of falling back to many small edits. Once writing starts the operations run in order and stop at the first failure.";
/** Stable section name; namespaced so it cannot collide with the host's `tool:apply_patch`. */
export declare const PATCH_GUIDANCE_SECTION = "plugin:patch-edit-plus:apply_patch";
/** Order used when the host predates the `TOOL_APPLY_PATCH` constant (0.2.2 added it at 1350). */
export declare const PATCH_GUIDANCE_ORDER = 1350;
/** The slice of the `systemPrompt` service this module needs. */
export interface SystemPromptFace {
    section(section: {
        name: string;
        order: number;
        text: (view?: unknown) => string;
    }): unknown;
    getSectionOrder?(name: string): number | undefined;
}
/**
 * Register the patch guidance section. Returns the disposer, or `null` when the
 * host has no system-prompt service (very old lines) — never throws.
 *
 * @param ctx - plugin context; the service is probed, never declared in `inject`,
 *   so a host without `systemPrompt` keeps loading instead of stalling.
 * @param toolName - the name the tool actually registered under.
 * @param mode - `'on'` always registers, `'auto'` is decided by the caller,
 *   `'off'` never registers.
 */
export declare function registerPatchGuidance(ctx: Context, toolName: string, mode: GuidanceMode): (() => void) | null;
