# 安装指南（官方 DSH CLI）

本指南只使用官方 `dsh plugin` 命令。该命令会把依赖装入 profile 并同步 `dsh.profile.bundles`。请勿改用裸 `npm install`、在 profile 里直接 `pnpm add`，或手工编辑 profile 清单。

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

本指南中的占位符：

- `<profile>`：要改动的 DSH profile，通常是 `web`；
- `dsh-patch-edit-plus`：npm 包名、运行时插件 ID，同时也是 bundle 补丁所插入的那一行 id。

> **支持的 DSH 范围：`>=0.1.2-rc.1 <0.2.0-0`。**
>
> 先用 `dsh --version` 确认当前版本。
>
> | DSH 版本 | 状态 | 说明 |
> | --- | --- | --- |
> | `0.1.2-rc.1` | 支持 | 工具编写契约（`defineTool` DSL、呈现意图）在 0.1.2–0.1.5 之间逐字节一致，同一份代码路径可同时服务两者。 |
> | `0.1.3-alpha.x` | 支持 | 同上。 |
> | `0.1.5-rc.2` | 静态验证通过 | `npm run typecheck:0.1.5` 会拿真实的 `0.1.5-rc.2` peer 包对 `src/` 做类型检查。未使用 `readByteRange`，也不含 0.1.5 专有标识符。 |

## 0. 前置条件与 profile 探查

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

请使用正在运行的 DSH 进程所使用的那个 profile。`web` 很常见，但以实际生效的 `--profile` 参数为准。

## 1. 官方安装

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus -w
```

（当 profile 是 pnpm workspace 根时，如 `web`，`-w` 是必需的。）

显式安装指定版本：

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus@0.1.0 -w
```

官方 CLI 会自动更新 profile 依赖、锁文件与 `dsh.profile.bundles`。不要手工添加 YAML 行。

### 供应链冷却期

DSH 运行时使用 pnpm 11，其 `minimumReleaseAge` 策略可能拦截刚发布的版本并报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`。把该版本加入 `~/.dsh/profiles/<profile>/pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude`：

```yaml
minimumReleaseAgeExclude:
  - dsh-patch-edit-plus@0.1.0
```

## 2. 重启宿主

本插件是**纯宿主半身**：只在宿主侧注册一个工具与一个设置区，不附带浏览器半身。安装或升级后请重启 DSH 宿主进程；刷新页面既非必需，也不足以生效。

## 3. 升级

```bash
dsh plugin --profile <profile> update dsh-patch-edit-plus -w
```

升级后重启 DSH。

## 4. 本地路径 / `link:` 注册（备选）

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-patch-edit-plus": "link:<absolute path to dsh-patch-edit-plus>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-patch-edit-plus
#            name: dsh-patch-edit-plus
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

或用官方 CLI 直接指定本地路径（无需联网）：

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-patch-edit-plus -w
```

从源码检出构建时用以下脚本：

```bash
npm install
npm run build          # tsc -p tsconfig.build.json → lib/ + lib/types/
npm run typecheck      # tsc -p tsconfig.json
npm run verify:source  # 源码级断言
npm run test           # vitest run
npm run smoke          # _smoke/load-smoke.mjs
```

`lib/` 不入库，因此源码检出必须先构建才能按路径注册。发布时由 `prepublishOnly` 钩子自动构建，因此已发布的 tarball 一定包含编译产物。

## 5. 校验安装

```bash
grep -n "dsh-patch-edit-plus" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-patch-edit-plus/package.json').version"
```

检查官方装配：

```bash
dsh --profile <profile> --dump-default-config
```

其中必须包含：

```yaml
- id: dsh-patch-edit-plus
  name: dsh-patch-edit-plus
```

## 6. 验证插件

重启后，在会话中确认：

1. 模型可用的工具里出现 `apply_patch`。
2. 一个 unified diff 补丁可以应用，且文件内容与 diff 完全一致。
3. 校验失败的补丁不会改动工作区——引擎在写入任何东西之前已完成全部只读校验。
4. 在 `allowCodexPatch` 关闭时提交 Codex 风格补丁，会返回可操作的提示（告知如何启用该语法，或以 unified diff 重试），而不是笼统的解析错误。

若已有其他插件提供了名为 `apply_patch` 的工具，三层冲突策略（默认 `rename`，另有 `skip` / `fail`）决定结果。默认 `rename` 下 DSH 启动不受影响，本工具会以带后缀的名字注册。

## 7. 故障排查

| 现象 | 处理 |
| --- | --- |
| 找不到 `dsh` | 安装或启用官方 DSH CLI。 |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | 把该版本加入该 profile 的 `pnpm-workspace.yaml` 中的 `minimumReleaseAgeExclude`。 |
| `apply_patch` 未出现 | 重启宿主进程，并重新检查装配行。 |
| 与其他 `apply_patch` 提供方名字冲突 | 按 README 设置冲突策略 `rename`（默认）/ `skip` / `fail`。 |
| Codex 语法被拒绝 | 开启 `allowCodexPatch: true`，或改用 unified diff 重发该改动。 |
| hunk 不匹配 | 阅读四元诊断（文件 + hunk 序号、搜索起点、期望片段预览、实际片段），并按匹配的上下文重新提交该 hunk。 |

## 8. 卸载

```bash
dsh plugin --profile <profile> remove dsh-patch-edit-plus
```

卸载后重启 DSH。

## 许可

MIT
