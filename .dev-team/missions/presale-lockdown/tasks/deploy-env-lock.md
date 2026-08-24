# deploy-env-lock: 배포 환경 판별자를 저장소 고유·fail-safe로 교체
effort: xhigh
high_risk: 1

## Goal

이 미션이 세운 모든 잠금장치 — 라우트 폐쇄, 프로덕션 부팅 하드페일, 빌링키 암호화 강제 — 가
**단 하나의 판정 함수**에 매달려 있다. 그 함수가 지금 이렇게 생겼다
(`src/lib/launch-surface.ts`):

```ts
export function isProductionLaunchEnvironment(environment) {
  if (environment.VERCEL_ENV !== undefined) return environment.VERCEL_ENV === 'production';
  return environment.NODE_ENV === 'production';
}
```

**이 저장소는 Vercel이 아니라 Cloud Run에 배포된다.** `cloudbuild.yaml`·`Dockerfile`·
`scripts/deploy-cloud-run.sh` 어디에도 `VERCEL_ENV`가 없다(리드 확인). 그래서 두 가지 문제가 있다.

**문제 1 — 프리뷰가 부팅에 실패한다.** 프리뷰 Cloud Run 서비스는 프로덕션과 **같은 도커 이미지**로
돌고, 그 이미지는 `Dockerfile:89`에서 `NODE_ENV=production`을 설정한다. 프리뷰는
`KINDY_LOCAL_PREVIEW=1`을 쓰므로 → 프로덕션으로 판정 → `instrumentation.ts`가 exit 1.
현재 코드를 그대로 배포하면 프리뷰가 뜨지 않는다.

**문제 2 — 더 나쁜 역방향.** 프로덕션 서비스에 `VERCEL_ENV=preview`가 실수로 들어가면
(설정 복사, 템플릿 재사용 등) 라우트 폐쇄가 풀리고, 빌링키가 평문 저장되고, 게스트 레슨 모드가
열린다. **조용히, 아무 경고 없이.** 오설정을 막으려고 만든 가드가 오설정 하나로 통째로 꺼진다.

이 태스크가 끝나면: 판별자가 이 저장소의 실제 배포 방식을 반영하고, **모르는 상태의 기본값이
"잠근다"** 가 된다.

## Scope
- `src/lib/launch-surface.ts` 판정 함수와 타입
- `src/lib/launch-surface.test.ts` 판정 분기 테스트
- `src/lib/env-guard.ts` 위 함수를 재사용하는 쪽
- `src/lib/env-guard.test.ts` 위와 동일
- `cloudbuild.yaml` 프리뷰/프로덕션 구분 변수 주입이 필요하면
- `.env.local.example` 새 변수 문서화
- `docs/RUNBOOK.md` 배포 시 설정해야 할 변수 기록

## Constraints
- **기본값이 안전한 쪽이어야 한다.** 변수가 없거나, 오타가 났거나, 알 수 없는 값이면
  **프로덕션으로 간주**(= 잠근다). "명시적으로 프리뷰라고 말한 경우에만 푼다."
  지금은 정반대다 — `VERCEL_ENV`에 아무 값이나 있으면 프로덕션이 아니라고 판정한다.
- **`VERCEL_ENV` 의존을 제거하라.** 이 저장소는 Vercel에 배포되지 않는다. 저장소 고유 변수
  (예: `KINDY_DEPLOY_ENV`)로 바꾼다. 이름은 판단해서 정하되 `NEXT_PUBLIC_` 접두사는 쓰지 마라
  (빌드타임 인라인되므로 런타임 배포 구분에 부적합 — invariants 6).
- **`NODE_ENV`를 프리뷰 판별에 쓰지 마라.** 프리뷰와 프로덕션이 같은 이미지를 쓰므로 구분이 안 된다.
- 프리뷰를 여는 조건은 **명시적이고 하나여야 한다.** 여러 변수의 조합으로 열리게 하지 마라.
- 로컬 개발(`npm run dev`, `NODE_ENV !== 'production'`)은 지금처럼 전부 열려야 한다.
- `instrumentation.ts`·`billing-crypto.ts`·`proxy.ts`·페이지 가드의 **호출 방식은 바꾸지 마라.**
  판정 함수 내부만 교체한다. 호출자가 늘어나면 다음에 또 흔들린다.
- `supabase db push`·`gcloud`·Secret Manager를 실행하지 마라. `cloudbuild.yaml` 수정은 파일까지만.
- 새 의존성 금지.

## Deliverables

1. **판별 함수 교체** — `VERCEL_ENV` 제거, 저장소 고유 변수 도입, **알 수 없으면 프로덕션(잠금)**.
2. **오설정 가시성** — 프리뷰로 판정될 때 그 사실을 로그로 한 줄 남겨라(어떤 변수가 어떤 값이라
   프리뷰로 열렸는지). 조용히 열리는 것이 문제였다. 시크릿 값은 절대 출력하지 마라.
3. **테스트** — 최소한 이 분기들:
   - 변수 없음 + `NODE_ENV=production` → 프로덕션(잠금)
   - 변수 없음 + `NODE_ENV=development` → 로컬(열림)
   - 명시적 프리뷰 값 → 프리뷰(열림)
   - **알 수 없는 값·오타·빈 문자열 → 프로덕션(잠금)** ← 이게 핵심 회귀 테스트
   - 예전 `VERCEL_ENV=preview`가 더 이상 잠금을 풀지 못한다
   기존 `launch-surface.test.ts`·`env-guard.test.ts`에 추가하라(새 파일 만들지 마라 —
   `package.json` 등록이 또 필요해진다).
4. **`cloudbuild.yaml`** — 프리뷰 빌드/배포에 새 변수를 넣을 자리를 만들거나, 파일로는 불가능하면
   무엇을 어떻게 설정해야 하는지 핸드오프에 정확히 적어라.
5. **`docs/RUNBOOK.md`** — 프리뷰·프로덕션 각각에 설정해야 할 변수 표. 이 미션이 만든 다른
   변수들(`KINDY_LOCAL_PREVIEW`·`LESSON_GUEST_MODE`·`BILLING_KEY_SECRET`)의 기대값도 함께.
6. **`.env.local.example`** — 새 변수와 한 줄 설명.

## Validation

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm test
npm run build
```

추가로 **실제 부팅 동작을 직접 확인하고 출력을 핸드오프에 붙여라**:
- 프리뷰 값 + 우회 플래그 → standalone 서버가 정상 기동
- 변수 없음 + `NODE_ENV=production` + 우회 플래그 → exit 1
- **알 수 없는 값(오타) + 우회 플래그 → exit 1** (기본값이 안전한 쪽인지 증명)

## Handoff requirements

최종 메시지 끝에: summary, files_changed, validation(명령어 + **실제 출력**, 위 3가지 부팅 실증 포함),
risks, handoff_note.

`handoff_note`에 반드시:
- 새 변수 이름과 허용 값 목록.
- **프리뷰 Cloud Run 서비스와 프로덕션 서비스에 리드가 각각 무엇을 설정해야 하는가** — 명령어 수준으로.
- 이 변경 후에도 남는 오설정 시나리오가 있으면 무엇인지.
