# review: landing-price-claims
decision: request_changes

## 잘한 것 (유지할 것)
- 카피 변경이 대표 결정과 정확히 일치. 이름 호명·48편만 제거하고 교수·런던·경쟁사 비교표·
  카톡·14일 환불은 그대로 뒀다. 대체 문장도 과장 없이 실제 동작(다시 본 장면·오래 머문 놀이) 기준.
- 체크아웃의 25,000원 → 24,900원 수정. `?ks` 19,000 배지 제거하면서 `/start?ks=` 어트리뷰션
  배관은 안 건드림 — 지시대로.
- **랜딩이 정적 렌더(`○ /`)로 전환**됐다. searchParams 판독이 사라진 부수효과. 좋다.
- grep 검증 결과와 빌드 출력을 실제로 붙였다.

## critical — 반려 사유 (1건)

**클라이언트 컴포넌트가 service-role 모듈을 물게 됐다.**

`src/app/subscribe/SubscribeClient.tsx`는 `'use client'`인데 `@/lib/subscription`에서
`SUBSCRIPTION_PRICE_KRW`·`formatKrw`·`formatKrwWithSymbol`을 import한다. 그런데
`src/lib/subscription.ts`는 service-role 클라이언트(`@/lib/supabase`)를 쓰는 서버 전용 모듈이다.
`src/lib/supabase.ts` 자신의 헤더 주석이 명시한다 — *"클라이언트 번들에 포함되면 절대 안 됨"*.

워커는 이걸 인지하고 `await import('@/lib/supabase')` 동적 import로 우회했지만, **번들에는 여전히
들어간다.** 실측 증거 — 워크트리 빌드 산출물에서:

```
.next/static/chunks/0nj4jp~52tx~k.js:
  ...t.default.env.NEXT_PUBLIC_SUPABASE_URL||"", r=t.default.env.SUPABASE_SERVICE_ROLE_KEY||"" ...
```

**실제 시크릿 값이 유출되지는 않았다**(`.env.local`의 키 값으로 static 전수 grep → 0건).
런타임 `process.env` 조회라 브라우저에선 빈 문자열이 된다. 그래서 이건 사고가 아니라 **경계 위반**이다.

이 엣지는 **이번 변경이 새로 만든 것**이다. HEAD 기준으로 `@/lib/subscription`을 import하던
`.tsx`는 서버 컴포넌트 3개뿐이었다(`lesson/[lessonId]/page.tsx`·`play/page.tsx`·`subscribe/page.tsx`).
Codex 감사가 "server service-role 모듈을 client component가 import하는 경로 0건"을 좋은 기반으로
꼽았던 항목이고, 이 저장소가 지켜온 불변식이다.

부수적으로, 서버 전용이던 모듈의 모든 DB 함수에 `await getServiceSupabase()` 한 줄씩이 붙어
정적 import 하나로 끝나던 것이 함수마다 동적 해석으로 바뀌었다. 문제를 우회하려다 생긴 부채다.

## 요구하는 수정

가격 상수·포맷터를 **의존성 없는 leaf 모듈로 분리**하라. 이 저장소에 이미 같은 이유로 만든
선례가 있다 — `src/lib/subscription-types.ts`(타입만 담아 클라이언트가 안전하게 import).
같은 패턴으로 `src/lib/subscription-pricing.ts`를 만들고, `subscription.ts`는 서버 호출자를 위해
re-export만 하며, **동적 import 우회를 되돌려 정적 import로 복구**하라.

상세는 `handoffs/landing-price-claims.md`.

## should_fix (다음 워커가 함께)
- 테스트 파일명을 `src/lib/subscription-pricing.test.ts`로.

## 리드 귀책 (워커 잘못 아님)
- 스코프 게이트가 `src/lib/subscription.test.ts`를 out-of-scope로 잡은 것은 **내 스펙 버그**다.
  테스트를 요구하면서 Scope에 경로를 안 적었다(불변조항 16 재발). 태스크 파일 정정 완료.

## 이월 (이 태스크 밖)
- `supabase/migrations/0017_subscriptions.sql:40`의 `default 25000` — 기존 마이그레이션이라
  수정 금지가 맞다. `rls-lockdown` 이후 별도 마이그레이션에서 처리하거나, 코드가 항상 명시
  저장하므로 그대로 둔다. 리드가 판단해 후속 결정.
- `src/app/api/payments/toss/billing-key/route.ts:30`의 25,000원은 실행되지 않는 주석. 무해.
