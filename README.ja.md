# dsh-patch-edit-plus

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 向けのパッチ形式ファイル編集。モデルに公開される単一の `apply_patch` ツールが **git/unified diff**（既定）と **Codex `apply_patch` 構文**（オプトイン）を受け付け、すべての変更を **オール・オア・ナッシング**で適用し、DSH の動作には一切干渉しません。

## DSH バージョン互換性

| DSH バージョン | ステータス | 備考 |
|---|---|---|
| `0.1.2-rc.1` | ✅ サポート対象 | ツールオーサリング契約（`defineTool` DSL、presentation intents）は 0.1.2〜0.1.5 でバイト単位で同一であり、1 つのコードパスが両方を担います。 |
| `0.1.3-alpha.x` | ✅ サポート対象 | 上記と同じ。 |
| `0.1.5-rc.2` | ✅ 静的検証済み | `npm run typecheck:0.1.5` は実際の `0.1.5-rc.2` ピアパッケージに対して `src/` を型チェックします。`readByteRange` の使用はなく、0.1.5 専用の PTC 識別子もありません。 |

設定の登録はデュアル API フォールバック（0.1.2 以降では `settings.installSection`、旧ホストでは `settings.register`）を使用します。

## そもそもなぜパッチなのか？（ツールルーティングガイド）

ツールの説明はモデルを明示的にルーティングします。

- **すでに読み込んだ 1 ファイル内の小さな単一変更** → ネイティブの `edit` ツールを優先（パッチはリテラル編集より多くのトークンを消費します）。
- **大きなファイル内の小さな変更** → `apply_patch`（ファイル全体をエコーする必要はありません）。
- **多数のファイルにまたがるバッチ変更** → `apply_patch`（1 回の呼び出しで、アトミックに検証されます）。
- **実質的な内容を持つ新規ファイル / 削除 / リネーム** → `apply_patch`。

## インストール

```bash
dsh plugin --profile web add <path-to-dsh-patch-edit-plus>
dsh web --dump-config   # verify the plugin row appears
# restart DSH
```

## 使い方

### Unified diff（既定、有効）

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

### Codex apply_patch 構文（オプトイン）

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

`allowCodexPatch: true` で有効化します。無効時に Codex パッチが届くと、ツールは汎用のパースエラーではなく **実行可能なヒント**（有効化の方法、または unified diff での再試行方法）を返します。Codex 構文は GPT 系モデルにとって強い事前分布であり、無言の失敗はモデルを再試行ループに閉じ込めてしまいます。

### 操作

| 操作 | Unified diff | Codex | 実行パス |
|---|---|---|---|
| 追加 | `new file mode` + `/dev/null` | `*** Add File:` | `ctx.fs.writeText`（公式の intent dance） |
| 更新（マルチハンク） | `@@` ハンク | `@@` ハンク | `ctx.fs.writeText` |
| 削除 | `deleted file mode` + `/dev/null` | `*** Delete File:` | `ctx.shell`（サンドボックス対応、パスは env 経由） |
| 移動 / リネーム | `rename from/to` | `*** Move to:` | `ctx.shell` |

## 保証

- **オール・オア・ナッシング**: パッチ全体がまず現在のファイル内容に対して検証されます（コンテキスト位置、ワークスペース内包、シンボリックリンクポリシー、重複パス）。いずれかが失敗すると、1 バイトも書き込まれずに中止されます。
- **read-before-write ゲートの遵守**: すべての書き込みは公式 `write` ツールの intent dance を再現します — `fs/write-intent` ウォーターフォール → ガード付き `writeText` → `fs/observed` 発火。素の `writeText` は、DSH プロバイダが `fs/*` イベントを自らディスパッチしないため、ゲートを黙って迂回してしまいます。
- **正確な失敗診断**: ハンク不一致時、エラーにはファイル + ハンクインデックス、検索開始行、期待行のプレビュー（空白を可視化）、ファイルの実際の抜粋、および的を絞ったヒントが含まれます。
- **改行の忠実性**: CRLF ファイルは CRLF として書き戻されます。末尾改行なしの末尾は、パッチが末尾を変更しない限り保持されます。
- **純粋な追加**: プラグインは正確に 1 つのツールを登録し、`tools.restrict()` を決して呼び出さず、ネイティブツールを決して上書きせず、グローバルサービスも登録せず、アンロード時にすべてを削除します。他の `apply_patch` 提供元（`bainianlaoyao/dsh-codex-mode`、`shuind/dsh-codex-harness`、…）との名前競合はリネーム回避（`apply_patch_1`、`…_2`、…）で解決されるため、DSH の起動が失敗することはありません。

## 設定

| オプション | 既定値 | 説明 |
|---|---|---|
| `toolName` | `apply_patch` | モデルに公開されるツール名。 |
| `conflictPolicy` | `rename` | ツール名が使用済みの場合の `rename` / `skip` / `fail`。 |
| `renameSuffix` | `_1` | リネーム回避で使用される接尾辞。 |
| `allowUnifiedDiff` | `true` | git/unified diff を受け付けます。 |
| `allowCodexPatch` | `false` | Codex `apply_patch` 構文を受け付けます。DSH 設定パネルからも変更でき、変更は即座に反映されます(再起動不要)。 |
| `deleteBackend` | `shell` | `shell` または `none`（削除/移動は構造化エラーを返します）。 |
| `shellDialect` | `auto` | `auto`（win32 では pwsh）/ `posix` / `pwsh`。 |
| `deleteCommand` / `moveCommand` | 組み込み | カスタムコマンドテンプレート。パスは依然として **env 経由のみ**（`DSH_PATCH_TARGET` / `DSH_PATCH_SOURCE`）で渡され、コマンド文字列に補間されることはありません。 |
| `dryRunByDefault` | `false` | `dryRun: false` でない限り、呼び出しをドライランとして扱います。 |
| `followSymlinks` | `false` | パッチのパスがシンボリックリンクをたどることを許可します。 |
| `maxFiles` | `50` | パッチあたりのファイルセクションの最大数。 |
| `maxPatchBytes` | `524288` | パッチテキストの最大サイズ（バイト）。 |
| `maxDiffBytes` | `16384` | 結果メタデータに保持されるファイルあたりの最大 diff（それより大きい diff は空にされ、`truncated` とマークされます）。 |

## 制限事項（開示）

- **削除/移動は `ctx.shell` を通じて実行されます。** サンドボックスの強度は、ロードされたシェルエグゼキュータが強制する内容（`bash-sandbox` は境界を設け、`bash-local` は設けません）と同じであり、ネイティブ bash ツールと同じリスク態勢です。すべてのリクエストは `sandboxPolicy` を伴い、サンドボックスの事実を報告するため、「ポリシーによる拒否」と「コマンド失敗」を区別できます。
- **すべての書き込みとすべての削除/移動がセッションスコープのポリシーを伴います。** `apply_patch` は呼び出しごとに `ctx.sandboxPolicy.resolve({ session })` を解決し(セッションのモードオーバーライドと、ワークスペースルートとしてのセッション cwd)、ネイティブの `write`/`edit` ツールとまったく同じにし、パスの計画も同じルートに対して行います。これがないと、強制実行するファイルシステムはデプロイメントルートにフォールバックし、`danger-full-access` セッションであってもワークスペース内の書き込みが `workspace-write` 拒否として失敗します。`workspace-write` での拒否はバックエンドの文言を含む `PatchError` として表面化します(構造化された `[sandbox: …]` マーカーと同じターン内のエスカレーションフィールドは未実装です。エスカレーションが必要な場合はネイティブの `write`/`edit` を使用してください)。
- **追加は親ディレクトリを作成しません。** これはネイティブ `write` ツールと同じです（`ctx.fs` に mkdir はありません）。エラーには不足しているディレクトリ名が示されます。
- ファジー/オフセットマッチングはありません。ハンクの位置は正確一致 → `trimEnd` → `trim` で、これは意図的なものです（ファジーマッチングは破壊的操作に対して安全ではありません。ロードマップに含まれています）。
- バイナリパッチは明確なエラーで拒否されます。

## 開発

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

ライブ DSH 上での手動検証（`dsh plugin --profile web add` → 再起動 → セッションでツールを呼び出す）は、意図的に運用者に委ねられています。

## ライセンス

MIT
