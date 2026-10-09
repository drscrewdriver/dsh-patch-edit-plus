# 변경 이력


## [0.4.0] — 2026-10-09

### 추가됨

- **모든 호스트 라인을 단일 버전으로 커버.** 하나의 버전(0.4.0)이 `0.1.0-rc.8`부터 `0.2.0-rc.2`까지(15개 rc 전부 + desktop) 모든 DSH 호스트를 지원합니다. peer 범위는 15개 rc를 모두 열거하고 `engines.dsh`는 `>=0.1.0-rc.8`을 선언합니다. 은퇴한 compat 브랜치(`compat/0.1.2`, `compat/0.1.5`, `compat/0.1.7`)와 `main` 분할 방식은 제거되었습니다. 배포 후 npm dist-tag `latest`, `dsh-0.2.0`, `dsh-0.1.7`, `dsh-0.1.5`, `dsh-0.1.2`는 모두 0.4.0으로 수렴합니다.
- **하나의 코드베이스로 3세대 설정 면을 커버**: 0.1.7+(및 desktop)은 선언적 `.volatile()` + `loader/volatile-update` 재등록. 0.1.2/0.1.5는 인스턴스 `settings.installSection`/`register`. 0.1.0/0.1.1은 `@deepseek-ai/dsh-settings`의 모듈 수준 `installSettingsSection`. 플러그인 페이지 설정 카드(client 쪽)는 0.1.7+/desktop에만 자리가 있고 구 라인에서는 우아하게 부재합니다.
- `defineTool` 저작 경로와 fs 소프트 강등: 호스트 `fs`에 write-intent가 없는 라인에서는 쓰기가 실패하지 않고 직접 쓰기로 자동 강등되며 `console.warn`을 1회만 출력합니다.
- 6라인 typecheck 매트릭스와 우아한 부재 시나리오를 커버하는 smoke 게이트.

### 변경됨

- **파괴적 변경: `allowCodexPatch` 기본값이 `false`로 바뀌었습니다**(옵트인, 0.2.0 라인과 정렬. 기존 0.1.7 라인의 기본값은 `true`). 기존 0.1.7 라인 사용자는 0.4.0으로 업그레이드한 후 수동으로 켜야 합니다.

## [0.3.1] — 2026-10-01

### 수정
- **헤더 없는 다중 파일 unified diff가 하나의 파일 section으로 뭉개졌음** (0.1.7 라인 0.2.5에서 수정한 것과 동일한 결함): `diff --git` 구분이 없으면 두 번째 파일의 `--- `/`+++ ` 헤더가 이전 section의 경로를 덮어써 그 hunk가 잘못된 내용과 대조되어 첫 파일 이후 모든 section이 `the context does not match the file`로 실패. 현재 section이 점유된 상태면 `--- `가 새 section을 열도록 수정. 파서 수준과 엔드투엔드 회귀 테스트 추가.
## [0.3.0] — 2026-09-29

### 변경됨

- **DSH 0.2.0 라인 지원(`compat/0.2.0` 브랜치).** peer 범위와 두 매니페스트의 `engines.dsh`를 `>=0.2.0-rc.1 <0.2.1-0`으로 업데이트하고 버전은 0.3.0. devDependencies는 실제 `0.2.0-rc.1` 타입 베이스라인에 고정하고, 크로스 체크 스크립트를 `npm run typecheck:0.2.0`으로 업그레이드했습니다(registry에서 실제 peer 패키지를 설치해 검증). 0.1.x 호스트는 계속 `compat/0.1.7` 브랜치 / `dsh-0.1.7` dist-tag가 담당합니다.
- **Delete/Move를 현행 셸 실행기 API로 이전.** 호스트는 0.1.2 → 0.1.7 라인 사이에 `ShellExecutor.run(spec)`을 `execute(spec)`로 이름을 바꿨습니다(`ShellProcess` 핸들을 반환하고, 포그라운드 결과는 `result()`로 획득). 이전 devDependency 고정(`0.1.2-rc.1`)이 이를 가렸습니다: 0.1.7 라인 패키지(0.2.1)는 낡은 베이스라인에 대해 그린으로 보였고, 실제 0.1.7+ 호스트에서는 `run` 기반 덕 타이핑이 일치하지 않아 Delete/Move가 구조화된 UNSUPPORTED 오류로 저하되었습니다. 본 라인은 `shell.execute(...)`를 호출하고 `execution.result()`를 기다리는 방식으로 변경하며, 실행기는 `execute`로 구조 검출합니다.

## [0.1.2] — 2026-09-19

### 수정됨

- **설정 섹션이 한 번도 등록되지 않았습니다.** settings 네임스페이스 `patch_edit_plus`는 밑줄을 포함해 `dsh-settings`의 네임스페이스 패턴(`^[a-z][a-z0-9-]*$`)에 거부되었고, `register()`는 검증 단계에서 던졌습니다. 패널이나 `~/.dsh/settings.yaml` 어디에도 설정 섹션이 나타나지 않았습니다. `patch-edit-plus`로 이름을 변경했습니다(마이그레이션 불필요: 이전 섹션은 존재할 수 없었습니다).
- **설정 레이어의 구성 변경이 도구에 전달되지 않았습니다.** `setSource`/`onChange` 훅이 빈 구현이었고 해석된 구성은 로드 시 한 번 고정되었습니다. 이제 플러그인이 해석된 소스를 실제로 소비합니다: 설정 커밋(또는 레거시 `register`의 watch)이 있을 때마다 구성을 다시 해석하고 도구를 다시 등록합니다. 재등록 전에 먼저 이전 등록을 해제하므로, 살아 있는 이름 위에 재등록하며 조용히 이름이 바뀌는 일은 없습니다. `allowCodexPatch`를 비롯한 모든 필드를 DSH 설정 패널에서 변경하면 즉시 적용되고, 도구 설명(허용되는 패치 구문 목록)도 동기화되며, 프로세스 재시작이 필요 없습니다. settings 서비스가 분리되면 composition 엔트리로 폴백하며, 재판정은 멱등입니다(단일 필드가 아닌 해석된 구성 전체를 비교).

## [0.1.1] — 2026-09-17

### 수정됨

- **`workspace-write`에서 모든 쓰기가 거부되었습니다.** 도구가 호출별 `sandboxPolicy`를 전달하지 않아, 강제 적용하는 파일 시스템이 범위 없는 `ctx.sandboxPolicy.resolve()`로 폴백했습니다. 그 결과 세션 cwd 대신 **배포** 워크스페이스 루트(서버 실행 디렉터리)를 얻게 되었고, 세션 워크스페이스 안에 분명히 있는 경로가 경계 검사를 통과하지 못해 `danger-full-access` 세션에서도 `file access denied under workspace-write mode`를 반환했습니다. 이제 정책은 호출마다 호출 세션을 범위로 하여 해석되고(`resolve({ session })`), 모든 쓰기와 모든 Delete/Move shell 요청에 부여됩니다. 네이티브 `write`/`edit` 도구와 완전히 동일합니다. 모드의 양쪽 측면이 모두 적용됩니다: 세션의 `sandbox/mode` 재정의와 워크스페이스 루트로서의 세션 cwd입니다.
- 경로 해석과 경계가 이제 하나의 루트를 공유합니다: 계획 단계에서 모든 대상을 정책의 `workspaceRoot`(세션 cwd로 폴백)에 대해 해석하므로, 엔진이 쓰는 경로가 경계가 측정하는 경로와 일치합니다.

## 미출시

### 추가됨

- git/unified diff(기본)와 Codex `apply_patch` 문법(`allowCodexPatch`로 옵트인)을 모두 받아들이는, 모델에 노출되는 단일 `apply_patch` 도구.
- 형식 자동 감지 기능. 인식은 되지만 비활성화된 스타일이 들어오면 실행 가능한 힌트를 제공합니다.
- 추가 / 업데이트(다중 hunk) / 삭제 / 이동 연산. 삭제와 이동은 샌드박스 인식 `ctx.shell`을 통해 실행되며, 경로는 환경 변수로만 전달됩니다.
- 전부 아니면 전무 방식의 2단계 엔진: 무엇이든 쓰기 전에 전체를 읽기 전용으로 검증합니다(세 단계 허용 오차를 적용한 컨텍스트 위치 탐색, 워크스페이스 경계, 심볼릭 링크 거부, 중복 경로 감지).
- 모든 쓰기에 공식 쓰기 인텐트 댄스를 적용: `fs/write-intent` 워터폴 → 가드된 `writeText` → `fs/observed` 발생. 따라서 쓰기 전 읽기 게이트가 패치 쓰기에도 적용됩니다.
- 4요소 hunk 불일치 진단(파일 + hunk 인덱스, 탐색 시작 지점, 공백이 보이는 예상 미리보기, 실제 발췌)과 표적화된 힌트.
- `dryRun` 파라미터와 `dryRunByDefault` 설정.
- Codex 시맨틱 기반 그룹화 출력(추가 → 수정 → 삭제). 파일별 diff는 `maxDiffBytes`로 상한이 적용되며 `presentationMeta`는 재생(replay) 안전합니다.
- 3중 도구 이름 충돌 보호(`rename` 기본 / `skip` / `fail`)로, 다른 `apply_patch` 제공자와 이름이 충돌해도 DSH 시작이 깨지지 않습니다.
- DSH `0.1.2-rc.1` ~ `0.1.5-rc.2` 호환성: 단일 도구 작성 코드 경로와 0.1.5-rc.2 peer 패키지에 대한 `typecheck:0.1.5` 정적 검증, 그리고 설정 이중 API 폴백(`installSection` / `register`).
