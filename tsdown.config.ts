/**
 * tsdown build for dsh-patch-edit-plus（externalClientBundle 适配器，仿
 * dsh-tidy-display wt 同款）：
 *
 * - `lib/index.js` — host half：保持 tsc per-module ESM 产物（`tsc -p
 *   tsconfig.build.json` 产出 JS + lib/types 声明），tsdown **不**重建 host——
 *   `_smoke/load-smoke.mjs` 的 runtime-externals 断言按 tsc 形态扫描
 *   lib/index.js，整包 bundling 会被解析器源码里的字符串误判为 undeclared
 *   external。因此给适配器传空 host entries（其文档化用法：client 配置恒在
 *   返回数组下标 1，下标 0 为占位项，此处过滤掉）。
 * - `lib/client.js` — browser client bundle（CJS 闭包工厂），以包名 id
 *   `dsh-patch-edit-plus` 注册 `window.__ModuleLoader__.load`（client-modules
 *   以包名为键组合；与 package.json `name` 严格一致）。
 *
 * externalClientBundle 适配器解析顺序：本仓 vendored `tools/client-build.js`
 * 优先；缺失时 DSHX_HARNESS → `~/.config/dshx/harness`。本线（0.1.7）构建
 * 不设 `DSHX_HARNESS`，走默认 harness 解析即可；vendored 副本存在时永远
 * 优先生效，env 仅作显式钉住。
 *
 * Types ship from lib/types (tsc -p tsconfig.build.json), not from tsdown.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import type { TsdownPlugin, UserConfig } from 'tsdown';

const vendored = fileURLToPath(new URL('./tools/client-build.js', import.meta.url));

function resolveHarnessAdapter(): string {
  const configured = process.env.DSHX_HARNESS?.trim();
  if (configured) return join(resolve(configured), 'tools/dshx/src/client-build.js');
  const configPath = join(homedir(), '.config/dshx/harness');
  const recorded = existsSync(configPath) ? readFileSync(configPath, 'utf8').trim() : undefined;
  if (!recorded) {
    throw new Error('client rebuild requires a Harness root from DSHX_HARNESS or ~/.config/dshx/harness');
  }
  return join(resolve(recorded), 'tools/dshx/src/client-build.js');
}

const adapter = existsSync(vendored) ? vendored : resolveHarnessAdapter();
if (!existsSync(adapter)) throw new Error('externalClientBundle adapter is missing.');
const { externalClientBundle } = await import(pathToFileURL(adapter).href);

const bundle = externalClientBundle('dsh-patch-edit-plus', [], {
  clientEntry: 'src/client/index.tsx',
}) as UserConfig[];

const portableOutput: TsdownPlugin = {
  name: 'dsh-patch-edit-plus-portable-output',
  generateBundle(_options, output) {
    const client = output['client.js'];
    if (client?.type !== 'chunk') this.error('client.js was not emitted');
    client.code = client.code.replace(
      /^([ \t]*\/\/#region \\0dshx-css-module:).*[\\/]([^/\\\r\n]+\.module\.css\.mjs)(\r?)$/gmu,
      '$1$2$3',
    );
    if (/^.*\/\/#region \\0dshx-css-module:.*[\\/].*$/mu.test(client.code)) {
      this.error('client.js contains a non-portable CSS module path');
    }
  },
};

// Host half stays the tsc artifact: keep only the client config (the adapter
// pads index 0 with a placeholder when there are no host entries).
export default bundle
  .filter((config) => config.name === 'dsh-patch-edit-plus/client')
  .map((config) => {
    const plugins = Array.isArray(config.plugins)
      ? config.plugins
      : config.plugins === undefined
        ? []
        : [config.plugins];
    return { ...config, plugins: [...plugins, portableOutput] };
  });
