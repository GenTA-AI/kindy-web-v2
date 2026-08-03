# PLAN — presale-lockdown

목표: 8/31 실가 프리세일 전에 **DB 직접 조작 경로를 막고, 프리세일 밖 표면을 닫고,
표시가=청구가를 맞춘다.** 근거 = claudecodex.md Part II §C(G1).

## 웨이브 (고위험 태스크는 invariants 7에 따라 단독 실행)

| 웨이브 | 태스크 | effort | 상태 |
|---|---|---|---|
| A (병렬 3) | next-patch · route-closure · landing-price-claims | medium/high/high | TODO |
| B (단독) | rls-lockdown | xhigh | TODO |
| C (단독) | payment-charge-guard | xhigh | TODO |
| D (단독) | env-hardfail | xhigh | TODO |
| E | rls-verify-matrix (deps: rls-lockdown) | high | TODO |

## 태스크 한 줄 요약

- **next-patch** — Next 16.2.3 → 16.2.12. 미들웨어 우회 CVE 3건. 라우트 폐쇄가 이 위에 선다.
- **route-closure** — 프리세일 퍼널 밖 라우트 프로덕션 폐쇄 + robots/noindex + OG 메타데이터.
- **landing-price-claims** — 가격 출처 단일화(25,000·19,000 제거), 이름 호명·48편 클레임 제거.
- **rls-lockdown** — 0030 마이그레이션. authenticated DML 전면 회수 + 페이월 원본 차단.
- **payment-charge-guard** — 첫 달 청구 스킵 판정을 프로바이더 실조회로.
- **env-hardfail** — 프로덕션에서 프리뷰 우회 플래그 켜지면 부팅 실패.
- **rls-verify-matrix** — verify-rls.ts에 인증 세션 쓰기 시도 매트릭스(회귀 감시).

## 사람 게이트 (워커 금지, 리드 대행 또는 대표)

- `0030` 마이그레이션 **적용**(supabase db push) — 워커는 파일 작성까지만.
- `verify-rls.ts` **실행**(실 키 필요).
- 통신판매업 신고번호 확보 — 체크아웃 하드 차단 해제의 열쇠. 코드 아님.

## 후속 미션 (이번 범위 밖 — 대표 결정 기록됨)

- 환불 정본 **14일 100% 유지** 확정 → 약관 §7·체크아웃 문구 정렬 (법무 검토 선행).
- 카톡 **채널 개설 전제로 카피 유지** → 8/31 전 채널·알림톡 심사 완료 필요.
- 랜딩 클레임: 교수·런던·비교표 **유지** 확정.
- 프리세일 일회성 결제 라우트(상품 정의 확정 후) · G2 세션 루프 엔진 · 연령 7-9 정렬 · 성능.
