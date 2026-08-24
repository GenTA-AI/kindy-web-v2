# review: deploy-env-lock
decision: approve

## 핵심 요구 — 기본값이 잠그는 쪽인가: 통과

판정이 정확히 뒤집혔다(`src/lib/launch-surface.ts`):

```ts
if (environment.NODE_ENV !== 'production') return false;        // 로컬 → 열림
if (environment.KINDY_DEPLOY_ENV === 'preview') { warn once; return false; }  // 명시적 프리뷰만 열림
return true;                                                     // 그 외 전부 → 잠금
```

- **`VERCEL_ENV` 의존 완전 제거.** Cloud Run 배포 저장소에 Vercel 변수가 걸려 있던 부조리 해소.
- **미설정·빈 값·오타·알 수 없는 값 → 프로덕션(잠금).** 이게 요구의 핵심이었다.
- **여는 조건이 명시적이고 하나뿐**(`KINDY_DEPLOY_ENV === 'preview'` 정확 일치).
- 호출자(`instrumentation.ts`·`billing-crypto.ts`·`proxy.ts`·페이지 가드)는 손대지 않았다 — 지시 준수.

## 오설정 가시성: 통과
프리뷰로 열릴 때 이유를 담은 경고를 **모듈 인스턴스당 1회** 출력한다. 조용히 열리는 것이
문제였는데 이제 부팅 로그에 흔적이 남는다. 판별자 값은 고정 비시크릿이고 다른 env 값은 안 찍는다.

## 부팅 실증 3종 — 워커가 실제로 돌리고 출력을 붙였다
1. `NODE_ENV=production` + `KINDY_DEPLOY_ENV=preview` + 우회 플래그 2종 →
   `✓ Ready`, 경고 1줄. **프리뷰가 산다.**
2. 배포 변수 누락 + 우회 플래그 → 전체 메시지 후 **exit 1**.
3. **`KINDY_DEPLOY_ENV=preveiw` 오타** + 우회 플래그 → **exit 1**.
   기본값이 안전한 쪽임을 실증. 이게 이 태스크의 통과 조건이었다.

## 테스트: 통과
`launch-surface.test.ts`·`env-guard.test.ts`에 추가(새 파일 안 만듦 — 지시 준수). 커버:
변수 없는 production 잠금 / development 열림 / 명시적 preview만 열림 /
**오타·빈 문자열·알 수 없는 값 잠금** / **예전 `VERCEL_ENV=preview`가 더 이상 못 푼다** /
경고 1회 출력.

## cloudbuild·RUNBOOK: 판단이 정확하다
`KINDY_DEPLOY_ENV`를 substitution/build-arg가 아니라 **Cloud Run 런타임 env**로 규정했다.
같은 이미지를 프리뷰↔프로덕션으로 승격하는 구조라 빌드타임에 굽으면 안 된다 — 맞는 판단이고
`cloudbuild.yaml` 주석에 이유를 남겼다. `docs/RUNBOOK.md`에 서비스별 변수 표와 실행 명령이 들어갔다.

## critical
없음.

## should_fix
없음.

## 워커가 정직하게 신고한 잔여 위험 (리드 동의, 이월)
- 프로덕션에 정확히 `KINDY_DEPLOY_ENV=preview`를 잘못 넣으면 열린다. **의도된 유일한 escape hatch**이므로
  구조적으로 남는다. 서비스 설정 리뷰로 커버.
- 프로덕션 Cloud Run env로 `NODE_ENV=development`를 덮어쓰면 열린다. "로컬은 열려야 한다"는
  요구와 맞바꾼 위험. RUNBOOK에 명시됨.
- `/robots.txt`가 빌드 타임 정적 생성이라 프리뷰도 프로덕션 robots 규칙을 받는다.
  `src/app/robots.ts`는 Scope 밖이라 안 건드렸다. 프리뷰가 noindex인 건 오히려 바람직 — 이월.
- `launch-surface.test.ts`가 아직 `npm test` 목록에 없어 직접 실행(21/21)했다.
  → **`test-wiring` 태스크가 정확히 이걸 고친다.**

## 배포 차단 해제
이 머지로 배포 차단이 풀린다. 단 **RUNBOOK의 `gcloud run services update` 2건을 먼저 실행**해야
프리뷰가 뜬다. 그 명령은 사람 게이트(invariants 13)다.
