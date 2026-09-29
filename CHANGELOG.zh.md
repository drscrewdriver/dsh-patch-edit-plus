# 更新日志

## [0.2.3] — 2026-09-29

### 修复
- **Delete/Move 在真实 0.1.7 宿主上被静默降级为 UNSUPPORTED**（0.2.1 携带的缺陷）：shell 鸭子探测查的是 `run()`，但 DSH 在 0.1.2→0.1.7 之间把 `ShellExecutor.run(spec)` 改名为 `execute(spec)`（返回 `ShellProcess` 句柄 + `result()` 前台投影）——探测永不命中，Delete/Move 一直落到结构化 UNSUPPORTED 错误。`shellops` 现改用 `shell.execute(...)` + `await execution.result()`，鸭子探测改查 `execute`；shell 测试 mock 同步迁移到 `execute()`/`result()` 形态。

### 变更
- devDependencies 4 项 `@deepseek-ai/dsh-*` `0.1.2-rc.1` → `0.1.7-rc.2`：类型基线与本线服务的宿主对齐（过期的钉版正是「假绿」形态——它掩盖了上述改名）。
- 文档 ×4（README/INSTALL）：兼容矩阵重基于 `0.1.7` 线段；ja/ko 矩阵此前停留在 0.1.2~0.1.5 旧态。

## [0.2.1] — 2026-09-25

- 0.1.7 线首发（`dsh-0.1.7` dist-tag）：声明式设置——`allowCodexPatch` 标记 `.volatile()`，设置表单自动生成，工具经 `loader/volatile-update` 原位重注册（不 remount、无注册调用）。

## [0.1.2] — 2026-09-19

### 修复

- **设置区从未注册成功。** settings 命名空间 `patch_edit_plus` 含下划线，不满足 `dsh-settings` 的命名空间校验（`^[a-z][a-z0-9-]*$`），`register()` 在校验处即抛错——面板与 `~/.dsh/settings.yaml` 中都不会出现该插件的设置段。现改名为 `patch-edit-plus`（无需迁移：旧段不可能存在过）。
- **设置层的配置改动从未传导到工具。** `setSource`/`onChange` 两个钩子是空实现，且解析后的配置在加载时被一次固化。插件现在真正消费解析来源：设置层的每次提交变更（或旧版 `register` 的 watch）都会重新解析配置并重新注册工具——先注销旧注册再注册，避免重名时被静默改名。`allowCodexPatch` 等全部字段现在都可以在 DSH 设置面板中修改并立即生效，工具描述（可用补丁语法列表）同步更新，无需重启进程。settings 服务卸载时回落到组合条目，且重新判定是幂等的（比对整份 resolved config，而非单个字段）。

## [0.1.1] — 2026-09-17

### 修复

- **所有写入在 `workspace-write` 下被拒绝。** 工具没有传递 per-call `sandboxPolicy`，强制执行的文件系统于是回退到无作用域的 `ctx.sandboxPolicy.resolve()`——拿到的是**部署级**工作区根（服务进程的启动目录）而非会话 cwd。因此明明位于会话工作区内的路径未通过围栏检查，返回 `file access denied under workspace-write mode`；连 `danger-full-access` 会话也一样，该模式下这个 mode 甚至根本没被读取。现在改为每次调用都带上调用会话作用域解析策略（`resolve({ session })`），并同时盖在每一次写入与每一次 Delete/Move 的 shell 请求上，与官方 `write`/`edit` 完全一致。mode 的两半都生效了：会话的 `sandbox/mode` 覆盖，以及以会话 cwd 作为工作区根。
- 路径解析与围栏现在共用同一个根：计划阶段以策略的 `workspaceRoot`（缺省回退到会话 cwd）解析每个目标，写入引擎实际写的路径就是围栏实际度量的路径。

## Unreleased

### 新增

- 唯一的模型可见工具 `apply_patch`：接受 git/unified diff（默认）与 Codex `apply_patch` 语法（经 `allowCodexPatch` 开启）。
- 格式自动识别；识别到「已识别但被关闭」的风格时返回可操作提示，而非泛化解析错误。
- Add / Update（多 hunk）/ Delete / Move 四类操作；Delete 与 Move 走沙箱感知的 `ctx.shell`，路径只经环境变量传递。
- 两阶段原子应用引擎：写入前完成全量只读验证（三级上下文定位、工作区围栏、symlink 拒绝、路径去重），任一失败零写入。
- 每次写入完整复刻官方 intent 舞蹈：`fs/write-intent` waterfall → 带 intent 的 `writeText` → `fs/observed` 事件，使 read-before-write 门禁对补丁写入生效。
- hunk 定位失败的四要素诊断（文件 + hunk 序号、搜索起始行号、空白可视化的期望行预览、文件实际片段）与针对性提示。
- `dryRun` 参数与 `dryRunByDefault` 配置。
- Codex 语义分组输出（added → modified → deleted），单文件 diff 受 `maxDiffBytes` 封顶，`presentationMeta` 满足回放纯函数约束。
- 三层工具名冲突防护（默认 `rename` / `skip` / `fail`），与其他 `apply_patch` 提供方的重名不会导致 DSH 启动失败。
- DSH `0.1.2-rc.1` ~ `0.1.5-rc.2` 兼容：单一代码路径 + `typecheck:0.1.5` 对 0.1.5-rc.2 peer 包的静态核验；settings 双 API 回退（`installSection` / `register`）。
