# handoff: landing-price-claims (attempt 2)

## 상황

이전 워커의 작업은 **대부분 맞다.** 카피 변경·가격 단일화·배지 제거·정적 렌더 전환 전부 승인됐다.
반려 사유는 **딱 한 가지 — 모듈 경계**다. 처음부터 다시 하지 마라. 아래 한 부분만 고치면 된다.

## 무엇이 문제인가

`src/app/subscribe/SubscribeClient.tsx`는 `'use client'` 컴포넌트다. 여기서
`@/lib/subscription`의 `SUBSCRIPTION_PRICE_KRW`·`formatKrw`·`formatKrwWithSymbol`을 import했다.

그런데 `src/lib/subscription.ts`는 **service-role Supabase 클라이언트를 쓰는 서버 전용 모듈**이다.
`src/lib/supabase.ts` 헤더 주석이 직접 못박아 뒀다:

> service_role 키를 사용하므로 **클라이언트 번들에 포함되면 절대 안 됨**

이전 워커는 이 문제를 인지하고 `await import('@/lib/supabase')` 동적 import + 함수마다
`await getServiceSupabase()`로 우회했다. **하지만 번들에는 여전히 들어갔다.** 워크트리 빌드
산출물에서 실제로 확인된 클라이언트 청크:

```
.next/static/chunks/0nj4jp~52tx~k.js
  ... t.default.env.NEXT_PUBLIC_SUPABASE_URL||"", r=t.default.env.SUPABASE_SERVICE_ROLE_KEY||"" ...
```

실제 시크릿 값이 인라인되지는 않았다(런타임 조회라 브라우저에선 빈 문자열). 그래서 사고는 아니고
**경계 위반**이다. 하지만 이 저장소가 지켜온 불변식("service-role 모듈을 client component가
import하는 경로 0건")을 깨는 첫 사례가 된다. 그리고 동적 import 우회는 정적 import 하나로
끝나던 코드를 함수마다 비동기 해석으로 바꿔 놓았다 — 문제를 피하려다 생긴 부채다.

## 어떻게 고치는가

**이 저장소에 이미 같은 이유로 만든 선례가 있다**: `src/lib/subscription-types.ts` — 타입만 담아
클라이언트가 안전하게 import하는 leaf 모듈. 똑같이 하면 된다.

1. **`src/lib/subscription-pricing.ts`를 새로 만든다.** 여기에는 **어떤 import도 없어야 한다**
   (Supabase, 타입, 아무것도). 순수 상수와 순수 함수만:
   - `SUBSCRIPTION_PRICE_KRW`
   - `SUBSCRIPTION_LIST_PRICE_KRW`
   - `formatKrw`
   - `formatKrwWithSymbol`
   - 일 환산가 파생이 필요하면 그 헬퍼도 여기에
2. **`src/lib/subscription.ts`를 원래 모양으로 되돌린다.**
   - `import { supabase } from '@/lib/supabase'` **정적 import 복구**.
   - `getServiceSupabase()` 헬퍼와 함수마다 붙인 `await getServiceSupabase()` **전부 제거**.
   - 파일 상단 주석도 원래의 "server-only" 서술로 복구.
   - 가격 상수는 `subscription-pricing`에서 `export ... from`으로 **re-export**한다. 기존 서버
     호출자(`@/lib/subscription`에서 가격을 가져오던 코드)가 안 깨지게.
3. **소비자 import 경로 정리**
   - `'use client'` 파일(`SubscribeClient.tsx`)은 반드시 `@/lib/subscription-pricing`에서 가져온다.
   - 서버 컴포넌트(`src/app/page.tsx`, `subscribe/page.tsx`, `first-story/page.tsx`)도
     **가격만 쓴다면 `subscription-pricing`에서 가져와라.** 서버 전용 모듈을 불필요하게 물 이유가 없다.
4. **테스트 파일명을 `src/lib/subscription-pricing.test.ts`로 바꾼다**(이전 `subscription.test.ts` 삭제).
   내용은 그대로 재사용해도 된다.

## 반드시 유지할 것 (이전 작업에서 승인된 부분)

- 랜딩 카피 변경 3건 — 이름 호명 제목·본문 교체, 48편 문장 제거, ₩19,000 배지 제거.
- 체크아웃 "첫 달 24,900원" 수정, `/subscribe` 메타데이터 가격.
- `SubscribeClient.tsx`의 중복 가격 상수 제거.
- 랜딩의 `searchParams` 판독 제거로 인한 **정적 렌더 전환** — 되돌리지 마라.
- 교수·런던·경쟁사 비교표·카톡·14일 환불 문구는 **그대로 유지**(대표 결정).
- `/start?ks=` 어트리뷰션 배관 무수정.

## 검증에 추가할 것

기존 Validation에 더해, **클라이언트 번들에 service-role 모듈이 없다는 것을 직접 증명**하라.
빌드 후:

```bash
grep -rl "SUPABASE_SERVICE_ROLE_KEY" .next/static 2>/dev/null && echo "LEAK: service-role in client bundle" || echo "OK: no service-role in client bundle"
```

이 명령이 `OK`를 출력해야 한다. **출력을 핸드오프에 그대로 붙여라.** 이것이 이번 시도의 통과 조건이다.

## 이전 시도의 검증 결과 (참고 — 다시 안 돌려도 되는 것들)

- `npm run lint` / `tsc --noEmit` / `npm test`(48+12) / `npm run build`(54페이지) 전부 통과했다.
- `grep -rn "25,000\|25000" src/app src/lib` → `toss/billing-key/route.ts:30`의 실행 안 되는
  주석 1건만 남음(스코프 밖, 무시).
- `grep -rn "19,000\|₩19" src/app` → 없음.
