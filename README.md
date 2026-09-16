# dsh-patch-edit-plus

Patch-style file editing for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness): one model-facing `apply_patch` tool that accepts **git/unified diff** (default) and **Codex `apply_patch` syntax** (opt-in), applies every change **all-or-nothing**, and stays completely out of DSH's way.

## DSH version compatibility

| DSH version | Status | Notes |
|---|---|---|
| `0.1.2-rc.1` | ✅ supported | Tool authoring contract (`defineTool` DSL, presentation intents) is byte-identical across 0.1.2–0.1.5; one code path serves both. |
| `0.1.3-alpha.x` | ✅ supported | Same as above. |
| `0.1.5-rc.2` | ✅ statically verified | `npm run typecheck:0.1.5` typechecks `src/` against the real `0.1.5-rc.2` peer packages. No `readByteRange` usage, no 0.1.5-only PTC identifiers. |

Settings registration uses the dual-API fallback (`settings.installSection` on 0.1.2+, `settings.register` on older hosts).

## Why patch at all? (tool routing guide)

The tool description explicitly routes the model:

- **Single small change in one already-read file** → prefer the native `edit` tool (a patch costs more tokens than a literal edit).
- **Small change inside a LARGE file** → `apply_patch` (no need to echo the whole file).
- **Batched changes across MANY files** → `apply_patch` (one call, verified atomically).
- **New file with substantial content / delete / rename** → `apply_patch`.

## Installation

```bash
dsh plugin --profile web add <path-to-dsh-patch-edit-plus>
dsh web --dump-config   # verify the plugin row appears
# restart DSH
```

## Usage

### Unified diff (default, enabled)

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

### Codex apply_patch syntax (opt-in)

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
*** Move to: src/app.ts   (via `*** Move to:` after *** Update File:)
*** End Patch
```

Enable with `allowCodexPatch: true`. When a Codex patch arrives while disabled, the tool returns an **actionable hint** (how to enable or how to retry in unified diff) instead of a generic parse error — Codex syntax is a strong prior for GPT-family models and a silent failure traps them in retry loops.

### Operations

| Operation | Unified diff | Codex | Execution path |
|---|---|---|---|
| Add | `new file mode` + `/dev/null` | `*** Add File:` | `ctx.fs.writeText` (official intent dance) |
| Update (multi-hunk) | `@@` hunks | `@@` hunks | `ctx.fs.writeText` |
| Delete | `deleted file mode` + `/dev/null` | `*** Delete File:` | `ctx.shell` (sandbox-aware, env-passed path) |
| Move / rename | `rename from/to` | `*** Move to:` | `ctx.shell` |

## Guarantees

- **All-or-nothing**: the whole patch is verified against current file content first (context location, workspace containment, symlink policy, duplicate paths); any failure aborts with zero bytes written.
- **Read-before-write gate respected**: every write replicates the official `write` tool's intent dance — `fs/write-intent` waterfall → guarded `writeText` → `fs/observed` emit. A bare `writeText` would silently bypass the gate because DSH providers never dispatch `fs/*` events themselves.
- **Precise failure diagnostics**: on hunk mismatch the error carries file + hunk index, search origin line, expected-line preview (whitespace made visible), the file's actual excerpt, and a targeted hint.
- **Newline fidelity**: CRLF files are written back as CRLF; no-trailing-newline tails are preserved unless the patch changes the tail.
- **Pure addition**: the plugin registers exactly one tool, never calls `tools.restrict()`, never overrides a native tool, registers no global services, and removes everything on unload. Name conflicts with other `apply_patch` providers (`bainianlaoyao/dsh-codex-mode`, `shuind/dsh-codex-harness`, …) are resolved by rename avoidance (`apply_patch_1`, `…_2`, …) so DSH never fails to start.

## Configuration

| Option | Default | Description |
|---|---|---|
| `toolName` | `apply_patch` | Model-facing tool name. |
| `conflictPolicy` | `rename` | `rename` / `skip` / `fail` when the tool name is taken. |
| `renameSuffix` | `_1` | Suffix used by rename avoidance. |
| `allowUnifiedDiff` | `true` | Accept git/unified diffs. |
| `allowCodexPatch` | `false` | Accept Codex `apply_patch` syntax. |
| `deleteBackend` | `shell` | `shell` or `none` (Delete/Move return a structured error). |
| `shellDialect` | `auto` | `auto` (pwsh on win32) / `posix` / `pwsh`. |
| `deleteCommand` / `moveCommand` | built-in | Custom command templates. Paths still arrive **only via env** (`DSH_PATCH_TARGET` / `DSH_PATCH_SOURCE`); never interpolate them into the command string. |
| `dryRunByDefault` | `false` | Treat calls as dry runs unless `dryRun: false`. |
| `followSymlinks` | `false` | Allow patch paths to traverse symlinks. |
| `maxFiles` | `50` | Max file sections per patch. |
| `maxPatchBytes` | `524288` | Max patch text size in bytes. |
| `maxDiffBytes` | `16384` | Max per-file diff kept in the result metadata (larger diffs are emptied and marked `truncated`). |

## Limitations (disclosed)

- **Delete/Move run through `ctx.shell`.** The sandbox strength is whatever the loaded shell executor enforces (`bash-sandbox` fences; `bash-local` does not) — the same risk posture as the native bash tool. Every request carries a `sandboxPolicy` and reports sandbox facts so "policy denied" is distinguishable from "command failed".
- **Every write and every Delete/Move carries the session-scoped policy.** `apply_patch` resolves `ctx.sandboxPolicy.resolve({ session })` per call — the session's mode override plus its cwd as the workspace root — exactly like the native `write`/`edit` tools, and resolves plan paths against that same root. Without it the enforcing filesystem falls back to the deployment root, which makes in-workspace writes fail as `workspace-write` denials even in a `danger-full-access` session. A `workspace-write` denial surfaces as a `PatchError` whose message carries the backend text (the structured `[sandbox: …]` marker and the same-turn escalation fields are not implemented; use the native `write`/`edit` tools when you need to escalate).
- **Add does not create parent directories.** This matches the native `write` tool (`ctx.fs` has no mkdir); the error names the missing directory.
- No fuzzy/offset matching: hunk location is exact → `trimEnd` → `trim`, deliberately (fuzzy matching is unsafe for destructive ops; it is on the roadmap).
- Binary patches are rejected with a clear error.

## Development

```bash
npm install
npm run typecheck        # against 0.1.2-rc.1 peers (devDependencies)
npm run typecheck:0.1.5  # against 0.1.5-rc.2 peers (static dual-version proof)
npm test                 # vitest, 90 tests
npm run lint
npm run build            # lib/
npm run verify:source    # static safety assertions (intent dance, no node:fs, …)
npm run smoke            # load-level smoke against a stub host
```

Manual verification on a live DSH (`dsh plugin --profile web add` → restart → call the tool in a session) is intentionally left to the operator.

## License

MIT
