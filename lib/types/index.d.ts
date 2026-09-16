/**
 * dsh-patch-edit-plus — patch-style file editing for DeepSeek Harness.
 *
 * One `apply_patch` tool accepting git/unified diff (default) and Codex
 * `apply_patch` syntax (opt-in). All-or-nothing application through the
 * official fs write-intent dance; delete/move through the sandbox-aware
 * shell. Compatible with DSH 0.1.2-rc.1 through 0.1.5-rc.2: the tool
 * authoring contract is byte-identical across those versions, so a single
 * code path serves both; only settings registration needs the dual-API
 * fallback (`installSection` first, `register` second).
 *
 * @module dsh-patch-edit-plus
 */
import type { Context } from '@deepseek-ai/cordis';
import { Config } from './config.js';
import type { Config as PluginConfig } from './config.js';
/** Cordis plugin name used by Loader diagnostics. */
export declare const name = "dsh-patch-edit-plus";
/** Settings namespace (a plain string literal: valid on every target version). */
export declare const SETTINGS_NAMESPACE = "patch_edit_plus";
export { Config };
/** Register the tool and the settings namespace. Every registration is scoped to this plugin. */
export declare function apply(ctx: Context, config?: PluginConfig): void;
