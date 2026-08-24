# review: landing-price-claims (attempt 2)
decision: approve

이전 시도(attempt 1)의 반려 사유는 카피·가격이 아니라 **모듈 경계** 하나였다. 그것만 고쳐졌고,
승인됐던 부분은 그대로 살아 있다.

## critical 해소 확인 — 리드가 직접 실측

**요구**: 클라이언트 번들에 service-role 모듈이 없을 것.

```
$ grep -rl "SUPABASE_SERVICE_ROLE_KEY" .next/static
→ 매치 없음.  OK: 클라이언트 번들에 service-role 없음
```

attempt 1에서는 `.next/static/chunks/0nj4jp~52tx~k.js`에
`t.default.env.SUPABASE_SERVICE_ROLE_KEY||""`가 박혀 있었다. 사라졌다.

## 수정의 모양도 요구한 대로다

- **`src/lib/subscription-pricing.ts`** — import 문 **0건**. 순수 상수 + 순수 포맷터만.
  `subscription-types.ts`가 타입을 위해 존재하는 것과 같은 자리에 가격이 놓였다.
- **`src/lib/subscription.ts`** — `import { supabase } from '@/lib/supabase'` **정적 import 복구**.
  attempt 1이 함수마다 붙였던 `await getServiceSupabase()` 우회가 전부 사라졌다. 서버 호출자를 위한
  re-export만 추가돼 기존 import 경로가 안 깨진다.
- **`SubscribeClient.tsx`**(`'use client'`) — `@/lib/subscription-pricing`에서 가져온다.
  서버 전용 모듈을 더 이상 물지 않는다.
- 일 환산가도 `SUBSCRIPTION_LIST_DAILY_PRICE_KRW`로 leaf에 들어가 페이지에서 산술을 안 한다.

## 승인됐던 부분 보존 확인
- 제거 유지: "이름을 부르며" · "마흔여덟" · "₩19,000" → 랜딩에서 **0건**.
- **대표 유지 결정 항목 살아 있음**: 30년 교수 커리큘럼 · 런던 · 예술의전당 비교표 → 4건 잔존.
- 랜딩에 `searchParams` 없음 → **정적 렌더 유지**.
- `/start?ks=` 어트리뷰션 배관 무수정.

## 게이트
validation_exit=0, scope_ok=1. 테스트 파일명도 `subscription-pricing.test.ts`로 정정됐다.

## nice_to_have / 이월
- `supabase/migrations/0017_subscriptions.sql:40`의 `default 25000` — 기존 마이그레이션이라
  손대지 않은 것이 맞다. 두 결제 경로가 항상 가격을 명시 저장하므로 실피해는 없다.
  후속 마이그레이션에서 정리 대상으로 이월.
- `src/app/api/payments/toss/billing-key/route.ts:30`의 25,000원은 실행되지 않는 주석. 무해.

## 컴파운드할 교훈 (리트로 반영)
**서버 전용 모듈에서 클라이언트가 쓸 값을 export하지 말 것.** 필요하면 의존성 없는 leaf로 분리한다.
`@/lib/supabase`(service-role)를 물고 있는 모듈은 `'use client'` 파일이 import하는 순간 번들에 들어간다 —
동적 import로도 못 막는다. 실제 시크릿이 인라인되지 않아도 경계는 이미 깨진 것이다.
검증법: 빌드 후 `grep -rl "SUPABASE_SERVICE_ROLE_KEY" .next/static`이 비어야 한다.
