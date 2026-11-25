# Changelog

## 0.4.13

- 设置面新增 star 快车道行（单源 _tools/star-row 生成，10 语；GitHub 单色图标 + 仓库直达链接 + 一句工程话术，整行可点，无弹窗无打断）。
- main 已合入 v0.4.12 发布线（沙箱围栏移交 provider、full-access 围栏 PR#1、engines.dsh 有界区间统一、9 语 locale 元数据、/patch 终端节等 24 提交），消除 main↔npm 版本背离。
- dsh.plugin.json 与 package.json 版本号同步归一。

## 0.4.12

### Fixed

- **`workspace-write` 下误拒宿主允许的临时目录写入**（issue #2）。planner 自建的围栏只认 `sandboxPolicy.workspaceRoot` 单根，而宿主 `@deepseek-ai/dsh-sandbox` 的 `writableRoots()` 在 `workspace-write` 下允许**三个根**（`workspaceRoot`、`/tmp`、`os.tmpdir()`）。后果：`workspace-write` 会话里对临时目录的 patch 被拒，错误文案却是「escapes the session workspace」——看起来像用户越界，实际是插件漏了根。临时目录写入在工具链里很常见，且这类「插件比宿主更严」的失败最难自查。
  修法：**删掉 planner 侧的围栏**，把 containment 完全交给挂载的 fs provider 在 commit 时判定 —— 与宿主自己的 `apply_patch` 契约一致（`@deepseek-ai/dsh-tool-fs`：*"Sandbox containment is the provider's decision at commit, as for write and edit"*）。这样也消除了「宿主放宽策略、插件没跟上」的整类缺陷：`writableRoots` 现在是三根，将来若变，插件无需跟着改。
  `followSymlinks` 拒绝与重复目标检查**保留在 planner**：前者是插件自己的配置策略，后者是 patch 自洽性，宿主 provider 都不做。
  路径解析仍以策略的 workspace root 为 cwd，相对路径语义不变。

### Changed

- **沙箱拒绝不再被吞成 I/O 错误**。provider 抛出的结构化 `FS_SANDBOX_DENIED` 现在原样透传（`src/fsops.ts` 按 `code` 判定，不匹配文案），使工具层仍能附加面向模型的 `[sandbox: …]` 标记与提权提示。此前写入路径会把它包成 `PatchError('IO', "failed to write …")`，丢掉了唯一的「该提权」信号。containment 全部下沉到 provider 后，这条透传成为每个围栏决策的必经路径。

### Tests

- `tests/helpers.ts` 的 `MemoryFs.writeText` 现在按宿主 `SandboxedFileSystem.checkedTarget()` 的语义执行策略（含三根、`read-only` 全拒、`danger-full-access` 放行），使「越界仍被拒」的断言守住的是 provider 兜底，而不是已删除的 planner 围栏。
- 新增 4 例：`workspace-write` 下 `/tmp/a.txt` 与 `/var/tmp/a.txt` 的 patch 必须成功（原缺陷的直接回归）。
- 断言从 `VALIDATION / escapes the session workspace` 改为 `FS_SANDBOX_DENIED`；`path-safety` 的越界用例改为**带策略**运行（无策略即无围栏，是宿主的既定契约），并确保文件/父目录存在，使流程真正走到写入阶段而非被前置校验拦下。
- 全量 117/117（原 113 + 新增 4），typecheck / lint / build / verify:source / smoke 全绿。

## 0.4.11

### Fixed

- **`apply_patch` 在 `danger-full-access` 会话中仍拒绝工作区外路径**（PR #1，作者 Flash-Z；main 线已以 `e0392d2` 合入，本次移植到 compat-legacy 发布线）。planner 此前无条件把工作区作为围栏根，与宿主契约（`dsh-sandbox`: "danger-full-access bypasses confinement"）以及 native write/edit 的每调用策略解析不一致。现在仅当策略 `mode === 'danger-full-access'` 时移除围栏，相对路径解析仍用工作区 cwd；`workspace-write` / `read-only` / 无策略服务的保守围栏行为逐字不变。附 PR #1 的 8 个回归用例（unified/codex × 绝对/相对路径放行，两种受限模式写前拒绝）。

## 0.4.10

- 终端面（dsh-tui / Desktop 命令面板同源）：/patch 只读设置节面（config 摘要）。

## [0.4.8] — 2026-11-10

### Added

- **Patch routing guidance as a system-prompt section on every supported host.** DSH 0.2.2-rc.1 is the first host that ships its own `apply_patch` (`dsh-tool-fs`, config `applyPatch`) together with a `tool:apply_patch` prompt section at `TOOL_APPLY_PATCH` (1350) and a description line that says to prefer it over separate edit calls. Older hosts ship neither, so a plugin-provided patch tool was described only by its per-call schema. The plugin now registers `plugin:patch-edit-plus:apply_patch` (same order, right after `tool:edit`) and carries the same one-line routing hint in the tool description.
- **Borrowed from 0.2.2**: the "prefer apply_patch over separate edit calls" phrasing, the hunk-context advice, "a rejected patch changes nothing", and the scope-aware empty text while the tool is absent. **Not borrowed**: "not rolled back" — verification here is all-or-nothing but the write phase is sequential, so the guidance claims only what is true.
- New `guidance: 'auto' | 'on' | 'off'` config (default `auto`). `auto` registers the section only when the tool kept its configured name; when rename avoidance had to step aside for another `apply_patch`, no second guidance text is injected.

### Compatibility

- The section order falls back through `TOOL_APPLY_PATCH` → `TOOL_EDIT + 50` → `1350`: `TOOL_APPLY_PATCH` only exists from 0.2.2, and `0.1.0-rc.8` has no `getSectionOrder` at all, while a non-finite order makes `systemPrompt.section()` throw. The `systemPrompt` service is probed through the cordis inject gate and never added to `inject`, so a host without it keeps loading with only the guidance absent.
- DSH 0.2.2-rc.1 itself is not declared yet: its peer enumeration and coexistence with the host-shipped `apply_patch` are out of scope for this release.

0.4.4: host enumeration addendum for DSH 0.2.1-rc.3 (declaration-only bump; contract plane zero diff).

## 0.4.3 (2026-10-18)

- hosts: 追加 0.2.1-rc.2 声明面枚举（34/34 @deepseek-ai/* 宿主 peer 逐包 npm 实测 rc.2 在版；本插件不触 ctx.web provider 与 conversation.input.model.label 槽，代码零改动，纯元数据发版；农场 rc.2 格挂账待命）



## [0.4.2] — 2026-10-17

### Changed

- **Host line `0.2.1-rc.1` supported.** `engines.dsh`, all seven `@deepseek-ai/dsh-*` peer ranges and `dsh.plugin.json` now enumerate 16 exact rc releases (`0.1.0-rc.2` … `0.2.1-rc.1`) instead of the `>=0.1.0-rc.8 <0.2.1-0` range — since 0.2.1-alpha.4 the compat gate adjudicates `engines.dsh` standalone, and the old `-0` upper sentinel rejected `0.2.1-rc.1`.
- Compatibility declarations are exact enumerations everywhere: no open ranges, untested future hosts are refused.
- devDependencies moved to the real `0.2.1-rc.1` peer baseline; `npm run typecheck:0.2.1` (was `:0.2.0`) proves that baseline from clean registry installs; the typecheck matrix now covers seven host lines including `0.2.1-rc.1`.

### Added

- `prepack` runs the build (npm pack can no longer ship a stale `lib/`); `publishConfig.registry` pinned to the official npm registry.

## [0.4.0] — 2026-10-09

### Added

- **Single release across all host lines.** One version (0.4.0) serves every DSH host from `0.1.0-rc.8` to `0.2.0-rc.2` — all 15 rc releases plus desktop; the peer ranges enumerate all 15 rcs and `engines.dsh` declares `>=0.1.0-rc.8`. The retired compat branches (`compat/0.1.2`, `compat/0.1.5`, `compat/0.1.7`) and the `main` split-line scheme are gone; after publishing, the npm dist-tags `latest`, `dsh-0.2.0`, `dsh-0.1.7`, `dsh-0.1.5` and `dsh-0.1.2` all converge on 0.4.0.
- **Three settings generations in one codebase**: declarative `.volatile()` plus `loader/volatile-update` re-registration on 0.1.7+ (and desktop); instance `settings.installSection`/`register` on 0.1.2/0.1.5; module-level `installSettingsSection` from `@deepseek-ai/dsh-settings` on 0.1.0/0.1.1. The plugin-page configuration card (client half) has a seat only on 0.1.7+/desktop and is gracefully absent on older lines.
- `defineTool` authoring path with fs soft-degradation: on host lines whose `fs` lacks write-intent, writes degrade to a direct write with a single `console.warn` instead of failing.
- Six-line typecheck matrix, plus a smoke gate covering the graceful-absence scenarios.

### Changed

- **Breaking: `allowCodexPatch` now defaults to `false`** (opt-in, aligned with the 0.2.0 line; the old 0.1.7-line default was `true`). Existing 0.1.7-line users must enable it manually after upgrading to 0.4.0.

## [0.3.1] — 2026-10-01

### Fixed
- **A bare multi-file unified diff collapsed into one file section** (same defect fixed on the 0.1.7 line in 0.2.5): with no `diff --git` separators, the second file's `--- `/`+++ ` headers rewrote the previous section's paths and its hunks were matched against the wrong content, failing every section after the first with `the context does not match the file`. `--- ` now opens a new section whenever the current one is already claimed; parser-level and end-to-end regression tests added.
## [0.3.0] — 2026-09-29

### Changed

- **DSH 0.2.0 line support (`compat/0.2.0` branch).** Peer ranges and `engines.dsh` (both manifests) now declare `>=0.2.0-rc.1 <0.2.1-0`; version 0.3.0. devDependencies pin the real `0.2.0-rc.1` type baseline, and the cross-check script is upgraded to `npm run typecheck:0.2.0` (installs the real peer packages from the registry). 0.1.x hosts remain served by the `compat/0.1.7` branch / `dsh-0.1.7` dist-tag.
- **Delete/Move migrated to the current shell executor API.** `ShellExecutor.run(spec)` was renamed `execute(spec)` — returning a `ShellProcess` handle with a `result()` foreground projection — between the 0.1.2 and 0.1.7 host lines. The old devDependency pin (`0.1.2-rc.1`) masked this: the 0.1.7-line package (0.2.1) typechecked green against a stale baseline, and at runtime on real 0.1.7+ hosts its `run`-based duck-typing never matched, so Delete/Move degraded to the structured UNSUPPORTED error. This line calls `shell.execute(...)` and awaits `execution.result()`; the executor is detected via `execute`.

## [0.1.2] — 2026-09-19

### Fixed

- **The settings section never registered.** The settings namespace `patch_edit_plus` contains an underscore, which `dsh-settings`' namespace pattern (`^[a-z][a-z0-9-]*$`) rejects, so `register()` threw before anything persisted — no settings entry appeared in the panel or in `~/.dsh/settings.yaml`. Renamed to `patch-edit-plus` (no migration needed: the old section could never exist).
- **Config changes from the settings layer never reached the tool.** The `setSource`/`onChange` hooks were no-ops and the resolved config was memoized once at load. The plugin now consumes the resolved source: every committed settings change (or legacy `register` watch) re-resolves the config and re-registers the tool — disposing the old registration first, since re-registering over a live name silently renames it. `allowCodexPatch` and every other field can now be toggled from the DSH settings panel and take effect immediately, with the tool description (the list of accepted patch styles) staying in sync; no process restart required. Detaching the settings service falls back to the composition entry, and re-judging is idempotent (the whole resolved config is compared, not just one field).

## [0.1.1] — 2026-09-17

### Fixed

- **Every write was denied under `workspace-write`.** The tool passed no per-call `sandboxPolicy`, so the enforcing filesystem fell back to `ctx.sandboxPolicy.resolve()` with no scope — the DEPLOYMENT workspace root (the server's launch directory) instead of the session cwd. A path plainly inside the session workspace therefore failed containment and returned `file access denied under workspace-write mode`, even in a `danger-full-access` session, where the mode was not even read. The policy is now resolved per call with the calling session in scope (`resolve({ session })`) and stamped on every write and every Delete/Move shell request, exactly as the native `write`/`edit` tools do. Both halves of the mode are honored now: the session's `sandbox/mode` override and its cwd as the workspace root.
- Path resolution and the fence now share one root: the plan resolves every target against the policy's `workspaceRoot` (falling back to the session cwd), so the path the engine writes is the path the fence measures.

## Unreleased

### Added

- Single `apply_patch` model-facing tool accepting git/unified diff (default) and Codex `apply_patch` syntax (opt-in via `allowCodexPatch`).
- Format auto-detection with an actionable hint when a recognized-but-disabled style arrives.
- Add / Update (multi-hunk) / Delete / Move operations; Delete and Move run through the sandbox-aware `ctx.shell` with paths passed only via environment variables.
- All-or-nothing two-phase engine: full read-only verification (context location with three tolerance levels, workspace containment, symlink rejection, duplicate-path detection) before any write.
- Official write-intent dance on every write: `fs/write-intent` waterfall → guarded `writeText` → `fs/observed` emit, so the read-before-write gate applies to patch writes.
- Four-element hunk-mismatch diagnostics (file + hunk index, search origin, expected preview with visible whitespace, actual excerpt) plus a targeted hint.
- `dryRun` parameter and `dryRunByDefault` config.
- Codex-semantics grouped output (added → modified → deleted) with per-file diffs capped by `maxDiffBytes` and replay-safe `presentationMeta`.
- Three-layer tool-name conflict protection (`rename` default / `skip` / `fail`) so name clashes with other `apply_patch` providers never break DSH startup.
- DSH `0.1.2-rc.1` ~ `0.1.5-rc.2` compatibility: single tool-authoring code path plus `typecheck:0.1.5` static verification against the 0.1.5-rc.2 peer packages; settings dual-API fallback (`installSection` / `register`).
