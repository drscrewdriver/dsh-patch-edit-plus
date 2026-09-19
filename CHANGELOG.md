# Changelog

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
