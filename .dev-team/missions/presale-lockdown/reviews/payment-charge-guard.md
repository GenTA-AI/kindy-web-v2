# review: payment-charge-guard
decision: approve

## 렌즈 2 — 머니 판정의 신뢰 원천 (이 태스크의 존재 이유): 통과

`alreadyPaid`가 더 이상 `purchases.status`만으로 결정되지 않는다. `resolveFirstPayment`
(`src/lib/portone.ts`, `src/lib/toss.ts` 대칭)이 세 갈래로 나눈다:

- **위조된 `paid` 행 + 프로바이더에 결제 없음(404)** → `beforeCharge()` + `chargePayment()`로
  **실제 청구가 일어난다.** 위조가 무력화된다. 이게 태스크의 목표였다.
- **진짜 `paid` + 프로바이더 확인** → `verifyPayment`로 `payment.id === orderId` ·
  `amount.total` · `currency` 3중 대조 후 재사용. 이중청구 없음.
- **조회 실패(네트워크·5xx·2xx 빈 본문)** → `PortOnePaymentLookupError` → 라우트가 502 반환,
  **구독 활성화도 entitlement 동기화도 안 한다.** fail-closed.

핵심 판단: **404만 "결제 없음"으로 분류**한 것이 정확하다. 모호한 응답을 "없음"으로 읽으면
이중청구, "있음"으로 읽으면 무료 제공이 된다. `READY`/`IN_PROGRESS`도 완료로 안 보고 닫는다.

## 이중청구 방어 — 리드가 요구한 한 문단 근거, 납득함

결정적 `sub_first_<parentId>_<YYYYMMDD>` 생성식을 그대로 유지하고, **프로바이더에 결제가 없다고
확인된 경우에도 새 ID를 만들지 않고 같은 ID로만 청구**한다. 따라서 동시 요청·재시도·조회 직후
레이스에서도 방어가 3겹이다: 프로바이더의 동일 paymentId 중복 거부 → `purchases.order_id`
unique 제약 → 조회 선행. 환불·취소 후 재구독의 랜덤 suffix 분기만 기존대로 남겼다 — 맞는 판단이다.

## 렌즈 3 — 기존 통제 보존: 통과
웹훅 HMAC·프로바이더 재조회·AES-GCM·결제 전 동의 강제를 건드리지 않았다. 태스크 Scope 밖인
웹훅 파일을 수정하지 않은 것도 지시 준수.

## 태스크 Deliverable 3 (빌링키 소유권 fail-closed): 통과
`billingKeyBelongsToCustomer`가 `info.customer?.id === customerId`로 단순화됐다. 기존
`if (issued.customer?.id && ...)`는 `customer.id`가 없으면 검사를 통째로 건너뛰었다. 이제 누락도 거부.

## 렌즈 5 — 회귀 감시: 통과
`payment-charge-guard.test.ts` 19케이스, 두 프로바이더 대칭. 태스크가 요구한 5개 시나리오
(위조 paid+결제없음 → 청구 / 진짜 paid → 스킵 / 조회실패 → fail-closed / 금액 불일치 /
customer.id 누락) 전부 커버하고, 추가로 `READY`·`IN_PROGRESS`·2xx 빈 본문까지 넣었다.
프로바이더 호출은 주입 함수로 대체 — 실 API 호출 없음.

## critical
없음.

## should_fix
없음.

## 이월 (워커가 risks에 정직하게 적은 것 — 리드 동의)
- **웹훅 단독 상태 전환의 금액·통화 대조는 여전히 없다.** Scope 밖이라 안 건드린 게 맞다.
  현재는 모든 결제가 서버 개시라 이론적 갭이지만, **프리세일(클라이언트 개시 결제)이 붙는
  순간 실제 취약점이 된다.** 프리세일 결제 라우트 미션에서 반드시 함께 처리할 것.
- 결제 직후 조회 전파 지연으로 404가 나면 동일 주문 재청구가 프로바이더에서 중복 거부되어
  사용자에게 재시도 오류로 보일 수 있다. **이중청구는 아니다.** 재시도로 복구.
- 조회 장애 중에는 실제 결제한 사용자도 일시적으로 활성화되지 않는다 — 의도된 fail-closed.

## 리드 귀책
스코프 게이트가 `package.json`과 테스트 파일을 out-of-scope로 잡았다. 둘 다 내 스펙 버그다 —
테스트를 요구하면서 파일 경로를 안 적었고, `npm test`가 파일 목록 하드코딩이라 등록에
`package.json` 수정이 필수인 것도 스코프에 반영 안 했다. **불변조항 16 세 번째 재발.**
