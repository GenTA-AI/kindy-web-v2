-- 0019: 빌링키 보안 강화 (P0)
--
-- 배경: 0017 의 billing_keys_select_own 정책은 부모가 본인 billing_keys 행을 직접 SELECT
-- 하도록 허용했는데, 그 행에는 결제 가능한 민감정보(billing_key)가 포함된다. 코드 점검 결과
-- 클라이언트(anon/authenticated)는 billing_keys 를 직접 읽지 않는다 — 카드 요약(card_summary)
-- 등은 전부 service-role API 응답으로 전달된다. 따라서 SELECT 정책을 제거해 클라이언트가
-- billing_keys 행을 아예 읽지 못하게 한다.
--
-- RLS 가 켜져 있고 SELECT 정책이 없으면 anon/authenticated 는 0행을 받는다.
-- service-role(API route)은 RLS 를 우회하므로 결제 플로우 동작은 불변.
-- 추가 방어: billing_key 컬럼은 앱레벨 AES-256-GCM 암호화 후 저장된다(src/lib/billing-crypto.ts).

drop policy if exists billing_keys_select_own on public.billing_keys;

comment on column public.billing_keys.billing_key is
  '토스 빌링키. 앱레벨 AES-256-GCM 암호화(enc:v1:...) 후 저장. 클라이언트 SELECT 불가(RLS), service-role 전용. 복호화는 charge 시점에만(src/lib/billing-crypto.ts).';
