# 更新日志


## [0.4.0] — 2026-10-09

### 新增

- **单版本覆盖全宿主线。** 一个版本（0.4.0）服务 `0.1.0-rc.8` 到 `0.2.0-rc.2` 的所有 DSH 宿主——全部 15 个 rc + desktop；peer 范围枚举全部 15 个 rc，`engines.dsh` 声明 `>=0.1.0-rc.8`。退役的 compat 分支（`compat/0.1.2`、`compat/0.1.5`、`compat/0.1.7`）与 `main` 分线方案全部移除；发布后 npm dist-tag `latest`、`dsh-0.2.0`、`dsh-0.1.7`、`dsh-0.1.5`、`dsh-0.1.2` 将全部收敛到 0.4.0。
- **一份代码覆盖三代设置面**：0.1.7+（及 desktop）为声明式 `.volatile()` + `loader/volatile-update` 重注册；0.1.2/0.1.5 为实例 `settings.installSection`/`register`；0.1.0/0.1.1 为 `@deepseek-ai/dsh-settings` 模块级 `installSettingsSection`。插件页配置卡（client 半）仅在 0.1.7+/desktop 有席位，老线优雅缺席。
- `defineTool` 编写路径与 fs 软降级：宿主 `fs` 缺 write-intent 的线上，写入自动降级为直写并 `console.warn` 一次，不再失败。
- 六线 typecheck 矩阵，以及覆盖优雅缺席场景的 smoke 闸。

### 变更

- **破坏性变更：`allowCodexPatch` 默认值改为 `false`**（opt-in，与 0.2.0 线对齐；旧 0.1.7 线默认为 `true`）。存量 0.1.7 线用户升级到 0.4.0 后需手动打开该开关。

## [0.3.1] — 2026-10-01

### 修复
- **裸多文件 unified diff 被折叠进同一个文件 section**（与 0.1.7 线 0.2.5 修复的同一缺陷）：没有 `diff --git` 分隔时，第二个文件的 `--- `/`+++ ` 头改写前一个 section 的路径，其 hunk 被拿到错误内容上匹配，第一个文件之后的每个 section 都报 `the context does not match the file`。现在当前 section 已被认领时 `--- ` 即开新 section；新增解析层与端到端回归测试。
## [0.3.0] — 2026-09-29

### 变更

- **支持 DSH 0.2.0 线（`compat/0.2.0` 分支）。** peer 范围与两份清单的 `engines.dsh` 改为 `>=0.2.0-rc.1 <0.2.1-0`；版本 0.3.0。devDependencies 钉住真实的 `0.2.0-rc.1` 类型基线，交叉校验脚本升级为 `npm run typecheck:0.2.0`（从 registry 干净安装真实 peer 包做核验）。0.1.x 宿主继续由 `compat/0.1.7` 分支 / `dsh-0.1.7` dist-tag 服务。
- **Delete/Move 迁移到现行 shell 执行器 API。** 宿主在 0.1.2 → 0.1.7 线之间把 `ShellExecutor.run(spec)` 改名为 `execute(spec)`——返回 `ShellProcess` 句柄，前台结果经 `result()` 获取。旧的 devDependency 钉版（`0.1.2-rc.1`）掩盖了这一点：0.1.7 线的包（0.2.1）对过期基线假绿，且在真实 0.1.7+ 宿主上运行时基于 `run` 的鸭子探测永不命中，Delete/Move 实际降级为结构化 UNSUPPORTED 错误。本线改为调用 `shell.execute(...)` 并等待 `execution.result()`；执行器经 `execute` 做结构探测。

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
