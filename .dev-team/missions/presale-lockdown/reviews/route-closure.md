# review: route-closure
decision: approve

## 판단 근거 (리뷰 렌즈 순)

**렌즈 4 — 닫힘의 다층성 (이 태스크의 핵심)**: 통과.
미들웨어(`src/proxy.ts`)와 페이지/핸들러 자체 가드가 둘 다 있다. `src/app/island/page.tsx`가
`isLaunchSurfaceClosed('/island', process.env)` → `notFound()`를 직접 호출하고, `/world`·`/start`·
`/demo/layout.tsx`·`/sample/layout.tsx`·3개 API 라우트도 같은 패턴. 미들웨어 우회 CVE를 못 믿는다는
전제를 그대로 구현했다.

**환경 판정 — 리드가 직접 검증**: 통과.
`isProductionLaunchEnvironment`가 `VERCEL_ENV`를 먼저 보고 없으면 `NODE_ENV==='production'`으로
떨어진다. 이 프로젝트는 **Cloud Run 배포라 `VERCEL_ENV`가 존재하지 않으므로 폴백 경로가 실동작
경로**다. `Dockerfile:89 ENV NODE_ENV=production` 확인 — 프로덕션에서 폐쇄가 실제로 걸린다.
`KINDY_PRESALE_LOCKDOWN=0`으로 프로덕션 폐쇄를 우회할 수 없게 짠 것도 맞다(fail-closed).
`VERCEL_ENV` 분기는 이 저장소에선 사실상 死코드지만 무해하다.

**렌즈 5 — 회귀 감시**: 통과. `launch-surface.test.ts` 5케이스가 `npm test`에서 돈다.

**G2 되돌리기**: 통과. 허용 목록이 `PRESALE_OPEN_ROUTE_RULES` 한 곳에 있고, 핸드오프가 한 줄
추가로 재개하는 법을 명시했다. 태스크가 요구한 "파일 하나, 목록 한 줄" 조건 충족.

**스모크**: 워커가 프로덕션 모드 HTTP 스모크를 실제로 돌렸다 —
열림 `/`·`/first-story`·`/legal/terms`·`/auth/login` 200, `/subscribe` 307(인증),
닫힘 `/demo`·`/world`·`/island`·`/sample/library`·`/start`·`/dashboard`·`/lesson/*` 404,
`/api/kiosk|videos|attention-quiz` 404 + kiosk OPTIONS의 와일드카드 CORS 소멸.
빌드 55페이지, `○ /robots.txt` 생성 확인.

## critical
없음.

## should_fix
없음 (이번 태스크 범위 안에서는).

## nice_to_have / 후속 (리드 책임 — 스펙 갭이지 워커 잘못 아님)
- **남은 API 계열**: `/api/library`·`/api/game/events`·`/api/syllabus`·`/api/events`·`/api/reactions`·
  `/api/quiz`는 열려 있다. 내가 Scope에 3개만 넣었기 때문이다. 비용·남용 3대 벡터
  (AI 생성·Opus 어텐션 퀴즈·키오스크 익명 ingest)는 닫혔고 나머지는 auth+child ownership으로
  보호되며 `rls-lockdown`이 DB 층을 덮는다. 프리세일 리스크는 수용 가능 —
  **후속 태스크로 이월**(`PRESALE_CLOSED_API_RULES`에 줄 추가만 하면 된다).
- `/api/videos/bespoke`는 상위 `/api/videos` 규칙으로 함께 닫힌다(핸드오프 확인). 별도 조치 불필요.
- 스코프 게이트가 `launch-surface.test.ts`를 out-of-scope로 잡았던 것은 **리드 스펙 버그**
  (테스트를 요구해놓고 Scope에 경로를 안 적음 — 불변조항 16의 재발). 태스크 파일 정정 후 재게이트 통과.
