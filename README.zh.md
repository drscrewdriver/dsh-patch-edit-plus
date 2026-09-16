# dsh-patch-edit-plus

面向 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 的补丁风格文件编辑插件：只提供 **1 个**模型可见工具 `apply_patch`，接受 **git/unified diff**（默认开启）与 **Codex `apply_patch` 语法**（可选开启），全量验证后**原子应用**，对 DSH 既有功能零负面影响。

## DSH 版本适配矩阵

| DSH 版本 | 状态 | 说明 |
|---|---|---|
| `0.1.2-rc.1` | ✅ 支持 | 工具编写契约（`defineTool` DSL、presentation 视图）在 0.1.2–0.1.5 间逐字节未变，单一代码路径服务两个版本。 |
| `0.1.3-alpha.x` | ✅ 支持 | 同上。 |
| `0.1.5-rc.2` | ✅ 静态核验 | `npm run typecheck:0.1.5` 用真实 `0.1.5-rc.2` peer 包对 `src/` 做类型核验；不调用 `readByteRange`，不含 0.1.5-only PTC 字符串。 |

settings 注册走双 API 回退：0.1.2+ 的 `settings.installSection` 优先，旧版回退 `settings.register`。

## 工具路由指引（为什么该用谁）

工具 description 内置了明确的路由规则：

- **单个已读文件里的单点小改** → 优先原生 `edit`（patch 反而多花 token）。
- **大文件里的小改动** → `apply_patch`（无需回显整个文件）。
- **跨文件批量改动** → `apply_patch`（一次调用、原子验证）。
- **新建大内容文件 / 删除 / 重命名** → `apply_patch`。

## 安装

```bash
dsh plugin --profile web add <dsh-patch-edit-plus 路径>
dsh web --dump-config   # 确认插件行出现
# 重启 DSH
```

## 使用示例

### unified diff（默认）

```text
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,4 +10,4 @@ export function main() {
   init()
-  start(oldPort)
+  start(newPort)
   await shutdown()
 }
```

### Codex apply_patch 语法（需开启）

```text
*** Begin Patch
*** Update File: src/app.ts
@@
   init()
-  start(oldPort)
+  start(newPort)
*** Add File: docs/notes.md
+# Notes
*** Delete File: tmp/junk.txt
*** End Patch
```

在配置中设 `allowCodexPatch: true` 开启。关闭状态下收到 Codex 补丁时，工具返回**可操作提示**（如何开启、或改用 unified diff），而不是泛化的解析错误 —— Codex 语法是 GPT 系模型的强先验，沉默失败会让模型陷入重试循环。

### 四类操作

| 操作 | unified diff | Codex | 执行路径 |
|---|---|---|---|
| Add | `new file mode` + `/dev/null` | `*** Add File:` | `ctx.fs.writeText`（官方 intent 舞蹈） |
| Update（多 hunk） | `@@` hunk | `@@` hunk | `ctx.fs.writeText` |
| Delete | `deleted file mode` + `/dev/null` | `*** Delete File:` | `ctx.shell`（沙箱感知，路径走 env） |
| Move / rename | `rename from/to` | `*** Move to:` | `ctx.shell` |

## 保证

- **全量先验证后写入**：整个补丁先对当前文件内容做验证（上下文定位、工作区围栏、symlink 策略、路径去重），任一失败即零写入中止。
- **read-before-write 门禁生效**：每次写入完整复刻官方 `write` 工具的 intent 舞蹈 —— `fs/write-intent` waterfall → 带 intent 的 `writeText` → `fs/observed` 事件。DSH 的 provider 从不分发 `fs/*` 事件，裸调 `writeText` 会静默绕过门禁。
- **精准失败诊断**：hunk 定位失败时，错误包含文件 + hunk 序号、搜索起始行号、期望行预览（空白字符可视化）、文件实际片段和针对性提示。
- **换行保真**：CRLF 文件按原风格写回；无尾换行状态保持，除非补丁本身改动了文件尾。
- **纯增量**：只注册 1 个工具、绝不调用 `tools.restrict()`、不覆盖原生工具、不注册全局服务、卸载即完全恢复。与其他 `apply_patch` 提供方（`bainianlaoyao/dsh-codex-mode`、`shuind/dsh-codex-harness` 等）的重名冲突通过改名避让解决（`apply_patch_1`、`…_2`…），不会导致 DSH 启动失败。

## 配置项

| 选项 | 默认值 | 说明 |
|---|---|---|
| `toolName` | `apply_patch` | 模型可见工具名。 |
| `conflictPolicy` | `rename` | 重名时 `rename` / `skip` / `fail`。 |
| `renameSuffix` | `_1` | 改名避让使用的后缀。 |
| `allowUnifiedDiff` | `true` | 接受 git/unified diff。 |
| `allowCodexPatch` | `false` | 接受 Codex `apply_patch` 语法。 |
| `deleteBackend` | `shell` | `shell` 或 `none`（Delete/Move 返回结构化错误）。 |
| `shellDialect` | `auto` | `auto`（win32 上 pwsh）/ `posix` / `pwsh`。 |
| `deleteCommand` / `moveCommand` | 内置 | 自定义命令模板。路径仍然**只经 env** 传入（`DSH_PATCH_TARGET` / `DSH_PATCH_SOURCE`），请勿把路径插值进命令串。 |
| `dryRunByDefault` | `false` | 默认按 dry run 处理，除非调用显式传 `dryRun: false`。 |
| `followSymlinks` | `false` | 允许补丁路径穿越符号链接。 |
| `maxFiles` | `50` | 单补丁最大文件段数。 |
| `maxPatchBytes` | `524288` | 补丁文本字节上限。 |
| `maxDiffBytes` | `16384` | 结果元数据中单文件 diff 上限（超出置空并标记 `truncated`）。 |

## 限制（明确披露）

- **Delete/Move 走 `ctx.shell`**：沙箱强度取决于装载的 shell 执行器（`bash-sandbox` 有围栏；`bash-local` 没有）—— 与原生 bash 工具的风险姿态一致。每次请求都携带 `sandboxPolicy` 并回传沙箱事实，"策略拒绝"与"命令失败"可区分。
- **每次写入、每次 Delete/Move 都携带会话作用域策略**：`apply_patch` 每次调用都解析 `ctx.sandboxPolicy.resolve({ session })` —— 会话的 mode 覆盖，加上以会话 cwd 作为工作区根 —— 与官方 `write`/`edit` 完全一致，且路径规划用同一个根。缺了它，强制执行的文件系统会回退到部署级根，导致工作区内的写入以 `workspace-write` 拒绝告终，连 `danger-full-access` 会话也不例外。`workspace-write` 下的拒绝以 `PatchError` 呈现，消息里带后端原文（结构化的 `[sandbox: …]` 标记与同轮提权字段未实现；需要提权时请改用官方 `write`/`edit`）。
- **Add 不创建父目录**：与原生 `write` 工具一致（`ctx.fs` 无 mkdir）；错误信息会指出缺失的目录。
- 不做模糊/偏移匹配：定位容错为精确 → `trimEnd` → `trim` 三级，刻意保守（模糊匹配对删除类操作不安全，已列入路线图）。
- 二进制补丁被拒绝并给出明确错误。

## 开发

```bash
npm install
npm run typecheck        # 针对 0.1.2-rc.1 peer 包（devDependencies）
npm run typecheck:0.1.5  # 针对 0.1.5-rc.2 peer 包（双版本静态核验）
npm test                 # vitest，90 个用例
npm run lint
npm run build            # lib/
npm run verify:source    # 静态安全断言（intent 舞蹈、无 node:fs 等）
npm run smoke            # stub 宿主加载冒烟
```

实机验证（`dsh plugin --profile web add` → 重启 → 会话调用）由部署者手动执行。

## License

MIT
