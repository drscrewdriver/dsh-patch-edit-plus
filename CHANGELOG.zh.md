# 更新日志

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
