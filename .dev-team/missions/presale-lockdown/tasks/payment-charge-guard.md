# payment-charge-guard: 첫 달 청구 스킵 판정을 프로바이더 실조회로 교체
effort: xhigh
high_risk: 1

## Goal

구독 첫 달 청구를 건너뛸지 판단하는 근거를 **사용자가 쓸 수 있는 DB 값**에서
**결제 프로바이더의 실제 응답**으로 옮긴다.

지금 두 결제 라우트는 이렇게 동작한다.

```
orderId = `sub_first_<parentId>_<YYYYMMDD>`
existingPurchase = select status from purchases where order_id = orderId
alreadyPaid = existingPurchase?.status === 'paid'
if (!alreadyPaid) { ... 실제 카드 청구 ... }   // paid면 청구를 통째로 건너뛴다
```

`purchases`는 소유자가 UPDATE할 수 있으므로(RLS `purchases_update_own`), 사용자가 자기 행을
`paid`로 바꾸면 **청구 없이 구독이 활성화되고 엔타이틀먼트까지 동기화된다.**

`rls-lockdown` 태스크가 그 쓰기 경로를 막지만, **돈이 걸린 판정이 방어 한 겹에만 기대면 안 된다.**
이 태스크는 두 번째 겹을 세운다: 청구를 건너뛰려면 프로바이더가 그 주문이 실제로 결제됐다고
확인해줘야 한다.

## Scope
- `src/app/api/payments/portone/billing-key/route.ts` 메인 결제 경로
- `src/app/api/payments/toss/billing-key/route.ts` 레거시 동일 패턴
- `src/lib/portone.ts` 조회 헬퍼가 없으면 여기 추가
- `src/lib/toss.ts` 위와 동일
- `src/lib/payment-charge-guard.test.ts` NEW 아래 Deliverables 4의 단위 테스트
- `package.json` test 스크립트가 파일 목록이라 새 테스트 등록에 필요

## Constraints
- **이미 올바른 통제를 건드리지 마라.** 웹훅 HMAC 검증, 프로바이더 재조회, AES-GCM 빌링키 암호화,
  결제 전 `recurring_billing` 동의 강제, 결정적 orderId 멱등성 — 전부 자산이다. 리팩터 명목으로도 손대지 마라.
- **이중청구를 만들면 안 된다.** 결정적 orderId는 이중청구 창을 막으려고 존재한다. 판정 근거만
  바꾸고 orderId 생성 규칙은 유지하라. 애매하면 "청구를 건너뛴다"가 아니라 "안전하게 실패한다"를 골라라.
- 프로바이더 조회가 실패하거나(네트워크·5xx) 응답이 모호하면 **fail-closed** — 청구를 건너뛰지 말고
  기존 멱등성 장치가 이중청구를 막게 하되, 사용자에게는 명확한 에러를 반환하라. 조용히 통과시키지 마라.
- 새 의존성 추가 금지. 프로바이더 SDK/클라이언트는 이미 있다.
- 빌링키·시크릿·프로바이더 raw payload를 로그·에러 응답·URL에 넣지 마라.
- 금액은 `src/lib/subscription.ts`의 상수에서만 온다. 하드코딩 금지.
- `purchases` 테이블의 스키마를 바꾸지 마라(마이그레이션은 `rls-lockdown`의 몫이고 이미 별도로 나갔다).

## Deliverables

1. `alreadyPaid` 판정이 `purchases.status`만으로 결정되지 않는다. 후보 경로:
   - `purchases` 행이 `paid`로 보이면 **프로바이더에 해당 주문/결제를 실조회**해서 실제 결제 완료를
     확인한 뒤에만 청구를 건너뛴다.
   - 프로바이더가 "결제 없음"이라고 답하면 청구를 진행한다(위조된 행에 속지 않는다).
   - 두 결제 라우트(PortOne·Toss) 모두에 적용한다.
2. 확인된 결제의 **금액·통화**를 기대값과 대조한다. 불일치면 성공 처리하지 말고 실패로 기록한다.
   (지금 동기 청구·웹훅 어느 쪽도 금액을 대조하지 않는다.)
3. 빌링키 소유권 검사를 fail-closed로 바꾼다 — 현재 `portone/billing-key/route.ts`는
   재조회한 빌링키에 `customer.id`가 **없으면 검사를 통째로 건너뛴다**. 없으면 거부하도록.
4. 위 로직의 단위 테스트. 최소한 다음 케이스:
   - 위조된 `paid` 행 + 프로바이더 "결제 없음" → **청구가 실행된다**
   - 진짜 `paid` 행 + 프로바이더 결제 확인 → 청구를 건너뛴다(이중청구 없음)
   - 프로바이더 조회 실패 → fail-closed, 구독이 활성화되지 않는다
   - 금액 불일치 → 성공 처리되지 않는다
   - `customer.id` 없는 빌링키 → 거부된다
   테스트는 프로바이더 호출을 주입/모킹해서 돌린다. **실 API를 호출하지 마라.**

## Validation

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm test
npm run build
```

새 테스트가 `npm test`에 포함되어 실행되어야 한다. 테스트 러너 규약: `node:test` + `npx tsx --test`,
상대 경로 import. 기존 테스트 파일들의 패턴을 먼저 읽고 따라라.

## Handoff requirements

최종 메시지 끝에: summary, files_changed, validation(명령어 + **실제 출력**, 새 테스트가 돌았다는
증거 포함), risks, handoff_note.

`handoff_note`에 반드시:
- 프로바이더 조회에 어떤 API/함수를 썼고, "결제 없음"과 "조회 실패"를 어떻게 구분했는가.
- fail-closed 경로에서 사용자가 보게 되는 에러와 그때 DB 상태.
- 이중청구가 불가능한 이유를 한 문단으로 — 리드가 이걸 근거로 승인한다.
- 이 변경으로 **깨질 수 있는 정상 시나리오**가 있다면 무엇인지(예: 웹훅이 먼저 도착한 경우).
