# 변경 이력

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
