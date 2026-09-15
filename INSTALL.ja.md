# インストールガイド（公式 DSH CLI）

本ガイドでは公式の DSH `dsh plugin` コマンドのみを使用します。このコマンドは依存関係を profile にインストールし、`dsh.profile.bundles` を同期します。素の `npm install`、profile 内での直接の `pnpm add`、あるいは profile マニフェストの手動編集で置き換えないでください。

- [英語インストールガイド](./INSTALL.md)
- [中国語インストールガイド](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [韓国語インストールガイド](./INSTALL.ko.md)
- [英語 README](./README.md)
- [中国語 README](./README.zh.md)
- [日本語 README](./README.ja.md)
- [韓国語 README](./README.ko.md)
- [変更履歴](./CHANGELOG.md)
- [日本語変更履歴](./CHANGELOG.ja.md)
- [韓国語変更履歴](./CHANGELOG.ko.md)

本ガイドで使用するプレースホルダーは次のとおりです。

- `<profile>`: 変更対象の DSH profile。通常は `web`。
- `dsh-patch-edit-plus`: npm パッケージ名であり、ランタイムのプラグイン ID であり、bundle パッチが挿入する唯一の行の id でもあります。

> **サポート対象の DSH 範囲: `>=0.1.2-rc.1 <0.2.0-0`。**
>
> まず `dsh --version` で実行中のバージョンを確認してください。
>
> | DSH バージョン | ステータス | 備考 |
> | --- | --- | --- |
> | `0.1.2-rc.1` | サポート対象 | ツールオーサリング契約（`defineTool` DSL、presentation intents）は 0.1.2〜0.1.5 でバイト単位で同一であるため、1 つのコードパスが両方を担います。 |
> | `0.1.3-alpha.x` | サポート対象 | 上記と同じ。 |
> | `0.1.5-rc.2` | 静的検証済み | `npm run typecheck:0.1.5` は実際の `0.1.5-rc.2` ピアパッケージに対して `src/` を型チェックします。`readByteRange` の使用はなく、0.1.5 専用の識別子もありません。 |

## 0. 前提条件と profile の探索

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

実行中の DSH プロセスが指定している profile を使用してください。`web` が一般的ですが、実際に有効なのは実行時の `--profile` 引数です。

## 1. 公式インストール

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus -w
```

（profile が pnpm ワークスペースのルートである場合、`web` がそうであるように、`-w` フラグが必要です。）

特定のバージョンを明示的にインストールする:

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus@0.1.0 -w
```

公式 CLI は profile の依存関係、ロックファイル、および `dsh.profile.bundles` を自動的に更新します。手動で YAML の行を追加しないでください。

### サプライチェーンのクールダウン期間

DSH ランタイムは pnpm 11 を使用しており、その `minimumReleaseAge` ポリシーが公開直後のバージョンを `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` でブロックすることがあります。`~/.dsh/profiles/<profile>/pnpm-workspace.yaml` の `minimumReleaseAgeExclude` にそのバージョンを追加してください:

```yaml
minimumReleaseAgeExclude:
  - dsh-patch-edit-plus@0.1.0
```

## 2. ホストの再起動

これは **ホスト専用**のプラグインです。ホスト上にツールと設定セクションを登録し、ブラウザ側の実装は同梱しません。インストールまたはアップグレードの後は DSH ホストプロセスを再起動してください。ページの再読み込みは必須でも十分でもありません。

## 3. アップグレード

```bash
dsh plugin --profile <profile> update dsh-patch-edit-plus -w
```

その後 DSH を再起動します。

## 4. ローカルパス / `link:` による登録（代替手段）

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-patch-edit-plus": "link:<absolute path to dsh-patch-edit-plus>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-patch-edit-plus
#            name: dsh-patch-edit-plus
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

または、公式 CLI をローカルパスで使用します（ネットワーク不要）:

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-patch-edit-plus -w
```

ソースチェックアウトからビルドする場合は、次のスクリプトを使用します:

```bash
npm install
npm run build          # tsc -p tsconfig.build.json → lib/ + lib/types/
npm run typecheck      # tsc -p tsconfig.json
npm run verify:source  # source-level assertions
npm run test           # vitest run
npm run smoke          # _smoke/load-smoke.mjs
```

`lib/` はコミットされていないため、ソースチェックアウトはパスで登録する前にビルドする必要があります。公開時には `prepublishOnly` フックを通じて自動的にビルドされるため、公開された tarball には常にコンパイル済みの出力が含まれます。

## 5. インストールの検証

```bash
grep -n "dsh-patch-edit-plus" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-patch-edit-plus/package.json').version"
```

公式のコンポジションを確認します:

```bash
dsh --profile <profile> --dump-default-config
```

次の内容が含まれている必要があります:

```yaml
- id: dsh-patch-edit-plus
  name: dsh-patch-edit-plus
```

## 6. プラグインの検証

再起動後、セッションで次を確認します:

1. `apply_patch` ツールがモデルから利用可能であること。
2. unified diff のパッチが適用され、ファイルの内容が diff と正確に一致すること。
3. 検証に失敗したパッチはワークスペースを一切変更しないこと — エンジンは何かを書き込む前に、すべてを読み取り専用で検証します。
4. `allowCodexPatch` がオフのときに Codex 形式のパッチを送ると、汎用のパースエラーではなく、その形式を有効化する方法または unified diff で再試行する方法をモデルに伝える実行可能なヒントが返ること。

別のプラグインがすでに `apply_patch` という名前のツールを提供している場合、三層の競合ポリシー（既定では `rename`、または `skip` / `fail`）が結果を決定します。既定の `rename` では DSH の起動は影響を受けず、ツールは接尾辞付きの名前で登録されます。

## 7. トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| `dsh` が見つからない | 公式 DSH CLI をインストールするか、有効化してください。 |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | profile の `pnpm-workspace.yaml` の `minimumReleaseAgeExclude` にそのバージョンを追加してください。 |
| `apply_patch` が表示されない | ホストプロセスを再起動し、コンポジションの行を再確認してください。 |
| 他の `apply_patch` 提供元とのツール名の衝突 | README に従い、競合ポリシーを `rename`（既定）、`skip`、または `fail` に設定してください。 |
| Codex 構文が拒否される | `allowCodexPatch: true` を有効にするか、変更を unified diff として再送してください。 |
| ハンク不一致 | 四要素診断（ファイル + ハンクインデックス、検索開始位置、期待プレビュー、実際の抜粋）を読み、一致するコンテキストでハンクを再出力してください。 |

## 8. 削除

```bash
dsh plugin --profile <profile> remove dsh-patch-edit-plus
```

その後 DSH を再起動します。

## ライセンス

MIT
