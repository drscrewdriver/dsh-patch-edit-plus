# 설치 안내 (공식 DSH CLI)

이 안내서는 공식 DSH `dsh plugin` 명령만 사용합니다. 이 명령은 의존성을 profile에 설치하고 `dsh.profile.bundles`를 동기화합니다. 이를 일반 `npm install`, profile에서의 직접적인 `pnpm add`, 또는 profile 매니페스트 수동 편집으로 대체하지 마십시오.

- [영어 설치 안내](./INSTALL.md)
- [중국어 설치 안내](./INSTALL.zh.md)
- [일본어 설치 안내](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [영어 README](./README.md)
- [중국어 README](./README.zh.md)
- [일본어 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [변경 이력](./CHANGELOG.md)
- [일본어 변경 이력](./CHANGELOG.ja.md)
- [한국어 변경 이력](./CHANGELOG.ko.md)

이 안내서에서 사용하는 자리표시자는 다음과 같습니다.

- `<profile>`: 변경할 DSH profile이며, 보통 `web`입니다.
- `dsh-patch-edit-plus`: npm 패키지 이름이자 런타임 플러그인 ID이며, bundle 패치가 삽입하는 단일 행의 id입니다.

> **지원하는 DSH 범위: `>=0.1.2-rc.1 <0.2.0-0`.**
>
> 먼저 `dsh --version`으로 실행 중인 버전을 확인하십시오.
>
> | DSH 버전 | 상태 | 비고 |
> | --- | --- | --- |
> | `0.1.2-rc.1` | 지원됨 | 도구 작성 계약(`defineTool` DSL, 프레젠테이션 인텐트)은 0.1.2–0.1.5 전 구간에서 바이트 단위로 동일하므로 하나의 코드 경로가 양쪽을 모두 지원합니다. |
> | `0.1.3-alpha.x` | 지원됨 | 위와 동일합니다. |
> | `0.1.5-rc.2` | 정적 검증 완료 | `npm run typecheck:0.1.5`는 실제 `0.1.5-rc.2` peer 패키지를 대상으로 `src/`의 타입을 검사합니다. `readByteRange`를 사용하지 않으며 0.1.5 전용 식별자도 없습니다. |

## 0. 사전 요구 사항과 profile 탐색

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

실행 중인 DSH 프로세스가 사용하는 profile을 사용하십시오. `web`이 일반적이지만, 실제로 적용되는 `--profile` 인자가 기준입니다.

## 1. 공식 설치

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus -w
```

(`web`처럼 profile이 pnpm 워크스페이스 루트인 경우 `-w` 플래그가 필요합니다.)

특정 버전을 명시적으로 설치하려면 다음과 같이 합니다.

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus@0.1.1 -w
```

공식 CLI가 profile 의존성, lockfile, `dsh.profile.bundles`를 자동으로 갱신합니다. YAML 행을 수동으로 추가하지 마십시오.

### 공급망 쿨다운 기간

DSH 런타임은 pnpm 11을 사용하며, 이 버전의 `minimumReleaseAge` 정책이 갓 게시된 버전을 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 오류로 차단할 수 있습니다. `~/.dsh/profiles/<profile>/pnpm-workspace.yaml`의 `minimumReleaseAgeExclude`에 해당 버전을 추가하십시오.

```yaml
minimumReleaseAgeExclude:
  - dsh-patch-edit-plus@0.1.1
```

## 2. 호스트 재시작

이 플러그인은 **호스트 전용** 플러그인입니다. 호스트에 도구 하나와 설정 섹션 하나를 등록하며, 브라우저 측 절반은 포함하지 않습니다. 설치하거나 업그레이드한 뒤에는 DSH 호스트 프로세스를 재시작하십시오. 페이지를 새로고침하는 것은 필요하지도, 충분하지도 않습니다.

## 3. 업그레이드

```bash
dsh plugin --profile <profile> update dsh-patch-edit-plus -w
```

이후 DSH를 재시작하십시오.

## 4. 로컬 경로 / `link:` 등록 (대안)

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-patch-edit-plus": "link:<absolute path to dsh-patch-edit-plus>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-patch-edit-plus
#            name: dsh-patch-edit-plus
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

또는 로컬 경로와 함께 공식 CLI를 사용하십시오(네트워크가 필요하지 않습니다).

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-patch-edit-plus -w
```

소스 체크아웃에서 빌드할 때는 다음 스크립트를 사용합니다.

```bash
npm install
npm run build          # tsc -p tsconfig.build.json → lib/ + lib/types/
npm run typecheck      # tsc -p tsconfig.json
npm run verify:source  # source-level assertions
npm run test           # vitest run
npm run smoke          # _smoke/load-smoke.mjs
```

`lib/`는 커밋되지 않으므로, 소스 체크아웃은 경로로 등록하기 전에 반드시 빌드해야 합니다. 게시 시에는 `prepublishOnly` 훅을 통해 자동으로 빌드되므로, 게시된 tarball에는 항상 컴파일된 출력물이 들어 있습니다.

## 5. 설치 확인

```bash
grep -n "dsh-patch-edit-plus" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-patch-edit-plus/package.json').version"
```

공식 구성(composition)을 확인하십시오.

```bash
dsh --profile <profile> --dump-default-config
```

다음을 반드시 포함해야 합니다.

```yaml
- id: dsh-patch-edit-plus
  name: dsh-patch-edit-plus
```

## 6. 플러그인 확인

재시작 후 세션에서 다음을 확인하십시오.

1. 모델이 `apply_patch` 도구를 사용할 수 있습니다.
2. unified diff 패치가 적용되고, 파일 내용이 diff와 정확히 일치합니다.
3. 검증에 실패한 패치는 워크스페이스를 전혀 건드리지 않습니다. 엔진은 무엇이든 쓰기 전에 모든 것을 읽기 전용으로 검증합니다.
4. `allowCodexPatch`가 꺼진 상태에서 Codex 스타일 패치를 보내면 일반적인 파싱 오류 대신, 해당 스타일을 활성화하는 방법이나 unified diff로 재시도하는 방법을 알려주는 실행 가능한 힌트가 반환됩니다.

다른 플러그인이 이미 `apply_patch`라는 이름의 도구를 제공하고 있다면, 3중 충돌 정책(기본값 `rename`, 또는 `skip` / `fail`)이 결과를 결정합니다. 기본값인 `rename`을 사용하면 DSH 시작에 영향이 없고, 도구는 접미사가 붙은 이름으로 등록됩니다.

## 7. 문제 해결

| 증상 | 조치 |
| --- | --- |
| `dsh`를 찾을 수 없음 | 공식 DSH CLI를 설치하거나 활성화하십시오. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | profile의 `pnpm-workspace.yaml`에 있는 `minimumReleaseAgeExclude`에 해당 버전을 추가하십시오. |
| `apply_patch`가 나타나지 않음 | 호스트 프로세스를 재시작하고 구성 행을 다시 확인하십시오. |
| 다른 `apply_patch` 제공자와 도구 이름 충돌 | README에 따라 충돌 정책을 `rename`(기본값), `skip`, `fail` 중 하나로 설정하십시오. |
| Codex 문법이 거부됨 | `allowCodexPatch: true`를 활성화하거나, 변경 사항을 unified diff로 다시 보내십시오. |
| hunk 불일치 | 4요소 진단(파일 + hunk 인덱스, 탐색 시작 지점, 예상 미리보기, 실제 발췌)을 읽고 컨텍스트가 일치하도록 hunk를 다시 내보내십시오. |

## 8. 제거

```bash
dsh plugin --profile <profile> remove dsh-patch-edit-plus
```

이후 DSH를 재시작하십시오.

## 라이선스

MIT
