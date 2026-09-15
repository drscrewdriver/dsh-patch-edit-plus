# dsh-patch-edit-plus

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness)를 위한 패치 스타일 파일 편집 도구입니다. 모델에 노출되는 단일 `apply_patch` 도구가 **git/unified diff**(기본)와 **Codex `apply_patch` 문법**(옵트인)을 받아들이고, 모든 변경을 **전부 아니면 전무(all-or-nothing)** 방식으로 적용하며, DSH의 동작에는 전혀 간섭하지 않습니다.

## DSH 버전 호환성

| DSH 버전 | 상태 | 비고 |
|---|---|---|
| `0.1.2-rc.1` | ✅ 지원됨 | 도구 작성 계약(`defineTool` DSL, 프레젠테이션 인텐트)은 0.1.2–0.1.5 전 구간에서 바이트 단위로 동일하므로 하나의 코드 경로가 양쪽을 모두 지원합니다. |
| `0.1.3-alpha.x` | ✅ 지원됨 | 위와 동일합니다. |
| `0.1.5-rc.2` | ✅ 정적 검증 완료 | `npm run typecheck:0.1.5`는 실제 `0.1.5-rc.2` peer 패키지를 대상으로 `src/`의 타입을 검사합니다. `readByteRange`를 사용하지 않으며, 0.1.5 전용 PTC 식별자도 없습니다. |

설정 등록은 이중 API 폴백을 사용합니다(0.1.2+ 에서는 `settings.installSection`, 이전 호스트에서는 `settings.register`).

## 왜 굳이 패치인가? (도구 라우팅 가이드)

도구 설명은 모델의 선택을 다음과 같이 명시적으로 유도합니다.

- **이미 읽은 파일 하나에 작은 변경 하나** → 네이티브 `edit` 도구를 우선 사용하십시오(패치는 리터럴 편집보다 토큰을 더 소모합니다).
- **큰 파일 내부의 작은 변경** → `apply_patch`(파일 전체를 되풀이해 출력할 필요가 없습니다).
- **여러 파일에 걸친 일괄 변경** → `apply_patch`(한 번의 호출로 원자적으로 검증됩니다).
- **내용이 상당한 새 파일 / 삭제 / 이름 변경** → `apply_patch`.

## 설치

```bash
dsh plugin --profile web add <path-to-dsh-patch-edit-plus>
dsh web --dump-config   # verify the plugin row appears
# restart DSH
```

## 사용법

### Unified diff (기본, 활성화됨)

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

### Codex apply_patch 문법 (옵트인)

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

`allowCodexPatch: true`로 활성화합니다. 비활성 상태에서 Codex 패치가 들어오면 도구는 일반적인 파싱 오류 대신 **실행 가능한 힌트**(활성화 방법, 또는 unified diff로 재시도하는 방법)를 반환합니다. Codex 문법은 GPT 계열 모델에게 강한 사전 확률(prior)이며, 조용한 실패는 모델을 재시도 루프에 가두기 때문입니다.

### 연산

| 연산 | Unified diff | Codex | 실행 경로 |
|---|---|---|---|
| 추가 | `new file mode` + `/dev/null` | `*** Add File:` | `ctx.fs.writeText` (공식 인텐트 댄스) |
| 업데이트 (다중 hunk) | `@@` hunks | `@@` hunks | `ctx.fs.writeText` |
| 삭제 | `deleted file mode` + `/dev/null` | `*** Delete File:` | `ctx.shell` (샌드박스 인식, 경로는 환경 변수로 전달) |
| 이동 / 이름 변경 | `rename from/to` | `*** Move to:` | `ctx.shell` |

## 보장 사항

- **전부 아니면 전무(all-or-nothing)**: 전체 패치를 먼저 현재 파일 내용과 대조해 검증합니다(컨텍스트 위치, 워크스페이스 경계, 심볼릭 링크 정책, 중복 경로). 어느 하나라도 실패하면 단 1바이트도 기록하지 않고 중단합니다.
- **쓰기 전 읽기 게이트 준수**: 모든 쓰기는 공식 `write` 도구의 인텐트 댄스를 그대로 재현합니다 — `fs/write-intent` 워터폴 → 가드된 `writeText` → `fs/observed` 발생. DSH 프로바이더는 `fs/*` 이벤트를 스스로 발행하지 않으므로, 순수한 `writeText`는 게이트를 조용히 우회하게 됩니다.
- **정밀한 실패 진단**: hunk 불일치 시 오류에는 파일 + hunk 인덱스, 탐색 시작 줄, 예상 줄 미리보기(공백이 눈에 보이도록 처리), 파일의 실제 발췌, 그리고 표적화된 힌트가 담깁니다.
- **줄바꿈 충실도**: CRLF 파일은 CRLF로 다시 기록되며, 패치가 마지막 부분을 변경하지 않는 한 끝에 줄바꿈이 없는 파일의 꼬리도 그대로 보존됩니다.
- **순수 추가형**: 이 플러그인은 정확히 하나의 도구만 등록하고, `tools.restrict()`를 호출하지 않으며, 네이티브 도구를 재정의하지 않고, 전역 서비스를 등록하지 않으며, 언로드 시 모든 것을 제거합니다. 다른 `apply_patch` 제공자(`bainianlaoyao/dsh-codex-mode`, `shuind/dsh-codex-harness`, …)와의 이름 충돌은 이름 회피(`apply_patch_1`, `…_2`, …)로 해결되므로 DSH 시작이 실패하는 일이 없습니다.

## 설정

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `toolName` | `apply_patch` | 모델에 노출되는 도구 이름입니다. |
| `conflictPolicy` | `rename` | 도구 이름이 이미 사용 중일 때의 동작으로, `rename` / `skip` / `fail` 중 하나입니다. |
| `renameSuffix` | `_1` | 이름 회피에 사용되는 접미사입니다. |
| `allowUnifiedDiff` | `true` | git/unified diff를 허용합니다. |
| `allowCodexPatch` | `false` | Codex `apply_patch` 문법을 허용합니다. |
| `deleteBackend` | `shell` | `shell` 또는 `none`(`none`이면 삭제/이동이 구조화된 오류를 반환합니다). |
| `shellDialect` | `auto` | `auto`(win32에서는 pwsh) / `posix` / `pwsh` 중 하나입니다. |
| `deleteCommand` / `moveCommand` | 내장 | 사용자 지정 명령 템플릿입니다. 경로는 여전히 **환경 변수로만**(`DSH_PATCH_TARGET` / `DSH_PATCH_SOURCE`) 전달되며, 명령 문자열에 끼워 넣어서는 안 됩니다. |
| `dryRunByDefault` | `false` | `dryRun: false`가 아닌 한 모든 호출을 드라이 런으로 취급합니다. |
| `followSymlinks` | `false` | 패치 경로가 심볼릭 링크를 통과하도록 허용합니다. |
| `maxFiles` | `50` | 패치당 최대 파일 섹션 수입니다. |
| `maxPatchBytes` | `524288` | 패치 텍스트의 최대 크기(바이트)입니다. |
| `maxDiffBytes` | `16384` | 결과 메타데이터에 보관되는 파일별 최대 diff 크기입니다(이보다 큰 diff는 비워지고 `truncated`로 표시됩니다). |

## 한계 (공개)

- **삭제/이동은 `ctx.shell`을 통해 실행됩니다.** 샌드박스 강도는 로드된 셸 실행기가 실제로 강제하는 수준을 따릅니다(`bash-sandbox`는 격리하고, `bash-local`은 격리하지 않습니다) — 네이티브 bash 도구와 동일한 위험 구도입니다. 모든 요청은 `sandboxPolicy`를 함께 전달하고 샌드박스 관련 사실을 보고하므로, "정책 거부"와 "명령 실패"를 구별할 수 있습니다.
- **추가(Add)는 상위 디렉터리를 생성하지 않습니다.** 이는 네이티브 `write` 도구와 동일한 동작이며(`ctx.fs`에는 mkdir이 없습니다), 오류 메시지에 누락된 디렉터리 이름이 표시됩니다.
- 퍼지/오프셋 매칭은 지원하지 않습니다. hunk 위치 탐색은 정확 일치 → `trimEnd` → `trim` 순으로 의도적으로 수행합니다(퍼지 매칭은 파괴적 연산에 안전하지 않으며, 로드맵에 올라 있습니다).
- 바이너리 패치는 명확한 오류와 함께 거부됩니다.

## 개발

```bash
npm install
npm run typecheck        # against 0.1.2-rc.1 peers (devDependencies)
npm run typecheck:0.1.5  # against 0.1.5-rc.2 peers (static dual-version proof)
npm test                 # vitest, 84 tests
npm run lint
npm run build            # lib/
npm run verify:source    # static safety assertions (intent dance, no node:fs, …)
npm run smoke            # load-level smoke against a stub host
```

실제 DSH에서의 수동 검증(`dsh plugin --profile web add` → 재시작 → 세션에서 도구 호출)은 의도적으로 운영자에게 맡깁니다.

## 라이선스

MIT
