# Installation Guide (Official DSH CLI)

This guide uses only the official DSH `dsh plugin` command. That command installs the dependency into a profile and synchronizes `dsh.profile.bundles`. Do not replace it with plain `npm install`, a direct `pnpm add` in the profile, or manual edits to the profile manifest.

- [English installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [English README](./README.md)
- [中文 README](./README.zh.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

The placeholders in this guide are:

- `<profile>`: the DSH profile to modify, usually `web`;
- `dsh-patch-edit-plus`: the npm package, the runtime plugin ID, and the id of the single row the bundle patch inserts.

> **Supported DSH range: `>=0.1.2-rc.1 <0.2.0-0`.**
>
> Check the running version with `dsh --version` first.
>
> | DSH version | Status | Notes |
> | --- | --- | --- |
> | `0.1.2-rc.1` | supported | The tool-authoring contract (`defineTool` DSL, presentation intents) is byte-identical across 0.1.2–0.1.5, so one code path serves both. |
> | `0.1.3-alpha.x` | supported | Same as above. |
> | `0.1.5-rc.2` | statically verified | `npm run typecheck:0.1.5` typechecks `src/` against the real `0.1.5-rc.2` peer packages. No `readByteRange` usage and no 0.1.5-only identifiers. |

## 0. Prerequisites and profile discovery

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Use the profile named by your running DSH process. `web` is common, but the active `--profile` argument is authoritative.

## 1. Official installation

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus -w
```

(the `-w` flag is required when the profile is a pnpm workspace root, as `web` is.)

Install a specific version explicitly:

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus@0.1.1 -w
```

The official CLI updates the profile dependency, the lockfile, and `dsh.profile.bundles` automatically. Do not add a manual YAML row.

### Supply-chain cooling period

The DSH runtime uses pnpm 11, whose `minimumReleaseAge` policy may block a freshly published version with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Add the version to `minimumReleaseAgeExclude` in `~/.dsh/profiles/<profile>/pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - dsh-patch-edit-plus@0.1.1
```

## 2. Restart the host

This is a **host-only** plugin: it registers a tool and a settings section on the host, and ships no browser half. Restart the DSH host process after installing or upgrading; refreshing the page is neither required nor sufficient.

## 3. Upgrade

```bash
dsh plugin --profile <profile> update dsh-patch-edit-plus -w
```

Restart DSH afterwards.

## 4. Local-path / `link:` registration (alternative)

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-patch-edit-plus": "link:<absolute path to dsh-patch-edit-plus>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-patch-edit-plus
#            name: dsh-patch-edit-plus
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

Or use the official CLI with a local path (no network needed):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-patch-edit-plus -w
```

Building from a source checkout uses these scripts:

```bash
npm install
npm run build          # tsc -p tsconfig.build.json → lib/ + lib/types/
npm run typecheck      # tsc -p tsconfig.json
npm run verify:source  # source-level assertions
npm run test           # vitest run
npm run smoke          # _smoke/load-smoke.mjs
```

`lib/` is not committed, so a source checkout must be built before it can be registered by path. Publishing builds it automatically through the `prepublishOnly` hook, so a published tarball always contains compiled output.

## 5. Verify installation

```bash
grep -n "dsh-patch-edit-plus" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-patch-edit-plus/package.json').version"
```

Check the official composition:

```bash
dsh --profile <profile> --dump-default-config
```

It must contain:

```yaml
- id: dsh-patch-edit-plus
  name: dsh-patch-edit-plus
```

## 6. Verify the plugin

After the restart, confirm in a session:

1. The `apply_patch` tool is available to the model.
2. A unified-diff patch applies, and the file content matches the diff exactly.
3. A patch that fails verification leaves the workspace untouched — the engine verifies everything read-only before it writes anything.
4. A Codex-style patch while `allowCodexPatch` is off returns an actionable hint telling the model how to enable the style or retry in unified diff, rather than a generic parse error.

If another plugin already provides a tool named `apply_patch`, the three-layer conflict policy (`rename` by default, or `skip` / `fail`) decides the outcome. With the default `rename`, DSH startup is unaffected and the tool is registered under a suffixed name.

## 7. Troubleshooting

| Symptom | Action |
| --- | --- |
| `dsh` is not found | Install or enable the official DSH CLI. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Add the version to `minimumReleaseAgeExclude` in the profile's `pnpm-workspace.yaml`. |
| `apply_patch` does not appear | Restart the host process and re-check the composition row. |
| Tool name clash with another `apply_patch` provider | Set the conflict policy to `rename` (default), `skip`, or `fail` per the README. |
| Codex syntax rejected | Enable `allowCodexPatch: true`, or resend the change as a unified diff. |
| Hunk mismatch | Read the four-element diagnostic (file + hunk index, search origin, expected preview, actual excerpt) and re-emit the hunk with matching context. |

## 8. Remove

```bash
dsh plugin --profile <profile> remove dsh-patch-edit-plus
```

Restart DSH afterwards.

## License

MIT
