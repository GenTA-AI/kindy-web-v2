# Mission brief: presale-lockdown
date: 2026-08-03
domain: backend (보안·머니코드·릴리즈 표면)

## What we're building

대표 지시: "claudecodex 바탕으로 플랜 만들어서 개발 시작." 범위는 면담에서 **잠그기 트랙만**으로 확정.

리드 재진술: 8/31 실가 프리세일을 열기 전에, **로그인한 사용자가 코드를 거치지 않고 DB를
직접 조작해 돈·체험·콘텐츠를 가져가는 경로를 전부 막는다.** 동시에 프리세일 퍼널에 필요 없는
제품 표면을 프로덕션에서 닫고, 표시가격과 실제 청구액을 일치시킨다.

이 미션이 끝나면 이렇게 된다:
- 인증 사용자가 PostgREST로 `purchases`를 위조해 **무료 구독을 켤 수 없다**.
- `game_sessions`를 지워 **무료체험을 리셋할 수 없다**.
- `credits`를 지웠다 아이를 추가해 **크레딧을 재발급받을 수 없다**.
- 결제되지 않은 주문이 서버 판단만으로 `paid` 취급되지 않는다(프로바이더 실조회로 확인).
- 프리세일 퍼널(`/`, `/first-story`, `/legal/*`, `/auth/*`, 결제) **밖의 라우트는 프로덕션에서 닫히고** 검색에 안 걸린다.
- 화면에 적힌 금액과 실제 청구 금액이 100% 같다.
- 환경변수 하나가 새어도 빌링키가 평문 저장되거나 유료 레슨이 공개되지 않는다(시작 시 하드페일).
- `verify-rls.ts`가 **인증 세션으로 쓰기를 시도**해서, 같은 종류의 구멍이 다음 마이그레이션에서 재발하면 잡아낸다.

근거 문서: `claudecodex.md` Part II (§B-3 신규 P0 · §C G1). 검증 방식은 9개 도메인 병렬 감사팀의
코드 원문 대조.

## Success criteria

- [ ] `0030` 마이그레이션 파일이 존재하고, `0006`/`0014`/`0016`의 authenticated INSERT/UPDATE/DELETE 정책을 전부 회수한다. **앱 코드 변경 0줄**로 lint/tsc/test/build가 통과한다.
- [ ] `library_videos`·`syllabuses` 원본 테이블에서 미디어 로케이터·스크립트가 authenticated SELECT로 보이지 않는다.
- [ ] 첫 달 청구 스킵 판정(`alreadyPaid`)이 `purchases.status`가 아니라 **프로바이더 실조회 결과**에 근거한다.
- [ ] `verify-rls.ts`가 인증 JWT로 own-row / cross-tenant INSERT·UPDATE·DELETE를 시도하고, 전부 거부되어야 통과한다. (실행은 키가 있는 사람 게이트 — 스크립트 자체는 이번 미션 산출물)
- [ ] 프로덕션 모드에서 프리세일 허용 목록 밖 라우트가 404/403이고, `robots`가 색인을 막는다.
- [ ] 25,000원 문자열이 소스에서 사라지고 가격 출처가 한 곳(`src/lib/subscription.ts`)이다.
- [ ] `NODE_ENV=production`에서 `KINDY_LOCAL_PREVIEW=1` 또는 `LESSON_GUEST_MODE=1`이면 부팅이 실패한다.
- [ ] Next.js가 16.2.12 이상이고 전체 검증이 통과한다.

## Mission validation

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm test
npm run build
```

## Boundaries (out of scope / do not touch)

- **환불 정책·이용약관·개인정보 처리방침 본문** — 대표 결정은 "14일 100% 보장 유지"로 났으나
  약관 §7 개정은 법무 검토가 선행되어야 하므로 **후속 미션**. `src/content/legal/*.md` 수정 금지.
- **카톡 관련 카피** — 대표 결정 "채널 개설 전제로 유지". 이번 미션에서 손대지 않는다.
- **교수·런던·경쟁사 가격 비교표** — 대표 결정 "유지". 삭제 금지.
- **프리세일 일회성 결제 라우트 신규 구현** — 별도 미션(상품 정의 확정 후).
- **세션 루프 엔진·읽기·창작·회상·리포트 재작성** — G2 이행 미션.
- **연령 3-8 → 7-9 정렬** — G2. 지금 건드리면 온보딩·API·DB가 한꺼번에 흔들린다.
- **등대섬/월드 게임 내부** — 대표 07-21 폴리싱 동결. noindex만 건다.
- **성능 최적화(폰트 서브셋·영상 지연로딩)** — 유용하지만 잠그기 아님. 후속.
- **`supabase db push`·`gcloud`·Secret Manager·원격 설정** — invariants 13, 사람 전용. 워커 실행 금지.

## Minefields (known risks, fragile areas)

- **머니코드**: `src/app/api/payments/**`, `src/lib/subscription.ts`, `src/lib/portone.ts`,
  `src/lib/billing-crypto.ts`. 웹훅 HMAC fail-closed·프로바이더 재조회·AES-GCM 암호화는 **이미 잘 돼 있다.
  깨뜨리지 말 것.** 고칠 것은 `alreadyPaid` 판정 하나다.
- **RLS 회수의 안전 근거**: 브라우저 Supabase 클라이언트는 인증 호출에만 쓰인다
  (`auth/login/page.tsx`, `onboarding/page.tsx`, `start/AttributionTracker.tsx`). 나머지 전부
  service-role API 경유(`src/lib/supabase.ts`). **그래서 DML 정책 회수가 앱을 깨지 않는다.**
  단, 이 전제를 워커가 재확인해야 한다 — 새 클라이언트 호출이 추가됐으면 즉시 보고.
- **마이그레이션 컨벤션**: `0024~0029`가 올바른 패턴(owner-SELECT만, DML 정책 없음). 재발명 금지,
  그 패턴을 역이식할 것. 프로드 pgcrypto는 `extensions` 스키마.
- **`0099_rls_disable_rollback.sql`**: `supabase/manual/`에 RLS 전체 해제 스크립트가 있다.
  migrations로 되돌리지 말 것(invariants 6).
- **Next 16**: 훈련 데이터와 다르다. 코드 전 `node_modules/next/dist/docs/` 확인.
  `instrumentation.ts`·`proxy.ts`(미들웨어)·metadata API는 특히.
- **미들웨어 우회 CVE**: 16.2.3에 미들웨어 우회 3건. 라우트 폐쇄를 미들웨어에만 의존하면 안 되고,
  **핸들러/페이지 자체에서도 막아야 한다.**
- **스코프 게이트**: 불릿당 경로 1개(첫 토큰)만 읽는다. 쉼표 병기 금지(invariants 16).

## Dials

- default effort: high
- parallel cap: 3 (단, 고위험 태스크는 단독 실행 — invariants 7)
- merge mode: squash
