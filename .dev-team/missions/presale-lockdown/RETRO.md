# RETRO — presale-lockdown (2026-08-06 종료)

## 무엇이 나갔나 — 9/9 머지

| 태스크 | 커밋 | 결과 |
|---|---|---|
| next-patch | 8fe58d2 | Next 16.2.3 → 16.2.12, 미들웨어 우회 CVE 3건 해소 |
| route-closure | bacb62a | 프리세일 5개 표면만 개방, 나머지 404 + robots/noindex + OG |
| landing-price-claims (try2) | 378a61c | 가격 단일 출처, 이름호명·48편 제거, 랜딩 정적 렌더 전환 |
| rls-lockdown | d655af2 | `0030` — authenticated DML 전면 회수 + 페이월 원본 차단 |
| payment-charge-guard | f7103b7 | 청구 스킵 판정을 프로바이더 실조회로, fail-closed |
| rls-verify-matrix (try2) | 4241d32 | 인증 세션 공격 31종 + authenticated positive control |
| env-hardfail | f73d244 | 프로덕션에서 우회 플래그면 부팅 실패 |
| deploy-env-lock | fb788d4 | 배포 판별자를 저장소 고유·fail-safe로 교체 |
| test-wiring | b65281c | 고아 테스트 5개 편입 (92 → 115) |

## 통합 검증 (리드가 루트에서 실행)

lint · `next typegen && tsc --noEmit` · `npm test` 115/115 · `npm run build` 55페이지 — 전부 통과.
**단, 처음 돌렸을 때는 무의미했다** — 아래 교훈 1 참조.

부팅 실증 3종(머지된 HEAD, standalone):
- production + 우회플래그, `KINDY_DEPLOY_ENV` 없음 → 전체 위반 메시지 후 중단 ✓
- `KINDY_DEPLOY_ENV=preveiw`(오타) → 여전히 중단 ✓ (fail-safe 기본값 증명)
- `KINDY_DEPLOY_ENV=preview` → 정상 기동, 경고 1줄, `/` 200 ✓

## 교훈 1 — 머지는 매니페스트를 옮길 뿐 node_modules를 옮기지 않는다 (가장 중요)

wave hygiene을 돌렸을 때 lint·tsc·test·build가 전부 초록이었는데, **설치된 Next는 여전히 16.2.3**이었다.
`package.json`은 `^16.2.12`, lockfile도 16.2.12인데 메인 트리 `node_modules`만 옛 버전이었다.
즉 **첫 통합 검증은 업그레이드 이전 코드를 검증한 것**이었고, 초록불이 거짓이었다.

`npm ci` 후 재검증해서 16.2.12 기준으로 다시 통과시켰다.

→ **의존성 매니페스트를 건드린 태스크를 머지한 뒤에는 반드시 루트에서 `npm ci`를 먼저 하고
통합 검증을 돌린다.** 워커는 자기 워크트리에서 설치했으므로 워크트리 초록불이 메인 트리를
보증하지 않는다. 불변조항 17("워크트리 검증 통과 ≠ 통합 통과")의 의존성 판.

## 교훈 2 — 정적 프리렌더 페이지의 런타임 가드는 빌드 타임에 얼어붙는다

`/island`·`/world`·`/start`·`/demo/*`·`/sample/library`는 `○`(정적)이라
`isLaunchSurfaceClosed(...) → notFound()`가 **빌드 시점 env로 평가돼 404가 굳는다.**
그래서 `KINDY_DEPLOY_ENV=preview`로 띄워도 이 페이지들은 열리지 않는다(실측 확인).
미들웨어로 막히는 동적 라우트(`/dashboard` → 307)는 런타임에 반응하므로 **동작이 갈린다.**

프리세일에는 무해하다(어차피 닫고 싶다). 하지만:
- **프리뷰 서비스로 제품 표면을 QA할 수 없다.** 프리뷰의 존재 이유가 반쯤 사라진다.
- `KINDY_DEPLOY_ENV=preview`가 "연다"고 약속하는데 일부만 연다 — 오해를 부른다.

→ G2에서 제품 표면을 다시 열 때 **선행 과제**다. 해법 후보: 해당 페이지에
`export const dynamic = 'force-dynamic'`, 또는 프리뷰 전용 빌드, 또는 미들웨어 단일화.
`/robots.txt`도 같은 이유로 프리뷰가 프로덕션 규칙을 받는다(deploy-env-lock 워커가 신고).

## 교훈 3 — 태스크에서 테스트를 요구하면 테스트 파일 경로를 Scope에 반드시 적는다

스코프 게이트 오탐 **4회 전부 리드 스펙 버그**였다(route-closure · landing-price-claims ·
payment-charge-guard · 그리고 payment는 `package.json`까지). 불변조항 16이 이미 경고한
패턴인데 재발했다. 추가로 발견: 이 저장소의 `npm test`는 **파일 목록 하드코딩**이라
새 테스트 등록에 `package.json` 수정이 필수다 — 이것도 Scope에 넣어야 한다.

더 나쁜 2차 피해: 등록을 안 한 채 머지된 테스트 2개가 **고아 상태로 CI에서 한 번도 안 돌았다.**
`test-wiring` 태스크를 급조해 메웠고, 그 과정에서 미션 이전부터 방치된 3개(아동 금지 에셋 차단
게이트 포함)도 함께 편입했다.

## 워커 실수 패턴

- **문제를 우회하려다 부채를 만든 사례**(landing-price-claims try1): 클라이언트 컴포넌트가
  service-role 모듈을 물게 되자 동적 import로 우회했다. 번들에는 그대로 들어갔고, 함수마다
  `await` 해석이 붙었다. **경계 위반은 우회가 아니라 분리로 푼다** — 저장소에 이미 선례
  (`subscription-types.ts`)가 있었는데 못 찾았다. Scope에 leaf 모듈 경로를 명시하니 한 번에 해결.
- **검증 스크립트의 거짓 초록불**(rls-verify-matrix try1): 16개 공격의 판정 구조는 정확했는데,
  **인증이 실제로 붙었는지 증명하는 장치가 없었다.** JWT가 안 붙으면 전부 anon으로 나가
  전 항목 PASS. 리뷰 서브에이전트가 잡았고, 리드가 코드에서 재확인했다.

## 리뷰 렌즈 적중

- "머니 판정의 신뢰 원천" 렌즈가 `0030`과 `payment-charge-guard` 둘 다에서 결정적이었다.
- "닫힘의 다층성" 렌즈로 route-closure의 미들웨어+페이지 이중 가드를 확인했고,
  그 덕에 `next-patch`(미들웨어 CVE)와의 의존 관계가 선명해졌다.
- **리드가 워커 주장을 재확인한 것이 두 번 값을 했다**: rls-lockdown에서 워커는 브라우저
  클라이언트만 조사했는데 anon 키를 쓰는 서버 SSR 클라이언트도 RLS를 받는다 — 4곳 전부
  auth 전용임을 직접 확인하고서야 승인했다. deploy-env-lock에서는 `VERCEL_ENV`가 배포 설정
  어디에도 없다는 걸 grep으로 확인해 배포 차단을 선언했다.

## 남은 사람 게이트 (코드로 못 닫음)

1. **`0030` 적용** — 스테이징 먼저, 트랜잭션 안에서. **아직 실 DB 실행 이력 0.**
2. **`verify-rls.ts` 실행** — `0030` 적용 후. 이걸 통과해야 "네 구멍이 막혔다"가 증명된다.
   지금은 코드상 막았을 뿐이다.
3. **Cloud Run env 설정** — `docs/RUNBOOK.md §2`의 `gcloud run services update` 2건.
   **이거 없이 배포하면 프리뷰가 안 뜬다.** 프로덕션은 `BILLING_KEY_SECRET`이 없으면 부팅 실패.
4. **통신판매업 신고번호** — 체크아웃 하드 차단 해제의 열쇠. 임계경로 최상단.

## 이월 (후속 미션)

- 환불 14일 정본 → 약관 §7·체크아웃 정렬 (법무 선행).
- 카톡 채널 개설 + 알림톡 심사 (배송·해지 약속의 근거).
- 프리세일 일회성 결제 라우트 + **웹훅 금액·통화 검증**(현재 없음 — 클라이언트 개시 결제가
  붙는 순간 실제 취약점이 된다).
- 남은 API 계열 폐쇄(`/api/library`·`/api/game/events`·`/api/syllabus` 등).
- CI가 `npm run build`를 안 돌리고 `npx tsx typegen` 없이 plain `tsc`를 쓴다.
- `0017:40`의 `default 25000` 정리.
- G2: 세션 루프 엔진 · 파일럿 4편 · 연령 7-9 정렬 · 리포트 정직화 · 성능.
