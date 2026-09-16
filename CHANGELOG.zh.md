# 更新日志

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
