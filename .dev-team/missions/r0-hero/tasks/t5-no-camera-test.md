# t5-no-camera-test: E13-10 아바타 안전 게이트 — 사진·카메라 코드 부재 보증 테스트
effort: medium

## Goal
"사진 업로드·카메라 경로가 코드베이스에 존재하지 않는다"를 **테스트로 보증**한다(HERO v1.0 §3 안전 원칙, E13-10). 아이 표면 코드(src/)에서 카메라·사진 업로드 관련 토큰을 정적 스캔하는 테스트를 만들고, 의도적 위반 주입으로 실패를 재현한 뒤(커밋 금지) 원복해 통과 상태로 배선한다. 절차 정본: `docs/plan/04_R0_EXECUTION_PLAN.md` Task 2.4.

## Scope
- `NEW: src/lib/hero/no-camera.test.ts` (node:test, `npx tsx --test`)
- `NEW: scripts/scan-camera-tokens.ts` (테스트가 사용하는 스캔 로직 — 분리 시)
- `package.json` (test 스크립트에 본 테스트 추가 — 1줄)

## Constraints
- 금지 토큰(04 Task 2.4 — 7종): `getUserMedia`, `capture=`(input attr), `type="file"` + `accept="image` 조합, `ImageCapture`, `navigator.mediaDevices`, `react-webcam`, `expo-camera`. 스캔 대상: `src/**`(테스트 자신·주석 내 문자열 상수는 허용 리스트로 제외 처리 — 예: 이 테스트 파일).
- 기존 코드에서 발견되면 **삭제하지 말고 보고**(handoff에 경로·용도 — 리드 판단). 단, 조사 기준 kindy-web에는 카메라 코드가 없다(01 문서 실사) — 발견 0이 기대값.
- 의도적 위반 주입 검증: 임시 파일에 금지 토큰을 넣고 테스트가 실패하는지 확인 → 임시 파일 삭제 → 통과 확인. 임시 파일이 커밋에 남으면 안 된다.
- worktree에 node_modules 없으면 `npm ci` 먼저.

## Deliverables
- 스캔 테스트 1본(+ 필요 시 스캔 스크립트), package.json test 체인 편입, 통과 상태

## Validation
```bash
npx tsx --test src/lib/hero/no-camera.test.ts
grep -q "no-camera" package.json && echo wired
[ "$(git status --porcelain | grep -v '^??' | grep -cv 'package.json\|no-camera\|scan-camera' | tr -d ' ')" = "0" ] && echo scope-clean
npm run lint
npx tsc --noEmit
```

## Handoff requirements
End your final message with: summary, files_changed, validation, risks, handoff_note — 특히 위반 주입 재현 결과(실패→원복→통과 로그 요지)와 허용 리스트 구성.
