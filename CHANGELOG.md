# Changelog

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
