/**
 * tui-command.ts — `/patch`：patch-edit-plus 的 dsh-tui 终端面。
 *
 * 背景：dsh-tui 不加载 client 半边，设置卡在终端里不可达；而 apply_patch 的
 * 冲突策略/删除后端/引导开关又在 TUI 会话里直接决定行为。命令面只读回显设置节
 * （不猜字段，直接展平 settings.describe() 里的本节内容）。
 *
 * 契约：单行 <=100、总行 <=40、无 ANSI、--json 单行。
 */
import type { Context } from '@deepseek-ai/cordis';
export type CommandKind = 'success' | 'error';
export interface CommandResult {
    kind: CommandKind;
    text: string;
}
export interface ConsoleDeps {
    ns: string;
    line: (key: string, value: string) => string;
    section(): Record<string, unknown> | undefined;
}
export declare function clip(text: string, width?: number): string;
export declare function renderLines(lines: string[], limit?: number): string;
export declare function describeSection(ctx: Context, ns: string, needle?: string): Record<string, unknown> | undefined;
export declare function runPatchCommand(rawInput: string, deps: ConsoleDeps): CommandResult;
export declare function registerPatchCommand(ctx: Context, deps: ConsoleDeps): void;
