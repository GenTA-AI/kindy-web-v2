# t4-avatar-spec: E13-1 아바타 144조합 스틸 스펙 프리즈 + 샘플 생성 스크립트
effort: medium

## Goal
E13-1 "아바타 발주"의 실체 = **스펙 프리즈 문서**(D-6 LoRA-first — 외주 발주 대체) + 샘플 3조합 생성 스크립트. `docs/hero/E13-1_AVATAR_144_STILL_SPEC.md`를 04 Task 2.3의 7 필수항목으로 작성하고, 기존 nano-banana 어댑터로 샘플 3조합을 생성하는 스크립트를 만든다. 절차 정본: `docs/plan/04_R0_EXECUTION_PLAN.md` Task 2.3.

## Scope
- `NEW: docs/hero/E13-1_AVATAR_144_STILL_SPEC.md`
- `NEW: scripts/gen-avatar-samples.ts`

## Constraints
- 스펙 7항목(04 Task 2.3): ① 베이스 3(체형·헤어 실루엣 정의) ② 팔레트 8(의상·헤어 색 HEX — DESIGN.md·BRAND_DNA 팔레트 내) ③ 단짝 6(여우·고래·부엉이·토끼·거북·다람쥐 — HERO v1.0 §3) ④ 시트 규격 **8각도×표정 4**(아바타·단짝용 — 모리 8종과 구분, 03 문서 §5-0 각주) ⑤ QC 기준(실사 유사 금지 판정·KINDYTOY 룩 정합 — BRAND_DNA.md) ⑥ 슬롯 계약(`avatar_slots = [{shot_id, kind: still|moving, duration_s, fallback_shot_id}]` — 0027 코멘트 원문) ⑦ 사전조합 경제(에피소드당 2컷×144 ≈ +$12 — HERO v1.0 §3).
- 스타일 앵커: `src/content/studio/approved-frames/`(승인 캐스트)·`docs/BRAND_DNA.md` 참조. **실사 유사 절대 금지**(재조준 보고 결재 ③) — 프롬프트에 negative 명시.
- `scripts/gen-avatar-samples.ts`: 기존 `src/lib/video-providers/nano-banana.ts` 어댑터 재사용, 3조합(베이스×팔레트×단짝 각 1) × 1컷, 출력 `tmp/avatar-samples/`(gitignored), 예상 비용 ≤$0.12, `DRY_RUN=1` 지원(API 호출 없이 프롬프트만 출력). **API 키 값 출력 금지.**
- 실생성 실행은 하지 마라 — `DRY_RUN=1`만 검증(실생성은 리드/[사람], 샌드박스 네트워크 불확실). 스크립트는 실행 가능 상태로.
- 금칙: 사진 업로드·카메라 관련 코드 추가 금지(E13-10과 충돌 — t5 스캔 대상).

## Deliverables
- 스펙 문서(7항목 완비, Studio W3 keyframe 프리즈의 입력) + DRY_RUN 검증된 생성 스크립트

## Validation
```bash
test -f docs/hero/E13-1_AVATAR_144_STILL_SPEC.md && echo spec-ok
grep -c "베이스\|팔레트\|단짝\|시트\|QC\|slot\|사전조합" docs/hero/E13-1_AVATAR_144_STILL_SPEC.md | awk '$1>=7{print "sections-ok"}'
grep -q "fallback_shot_id" docs/hero/E13-1_AVATAR_144_STILL_SPEC.md && echo slot-ok
DRY_RUN=1 npx tsx scripts/gen-avatar-samples.ts | grep -qi "prompt\|dry" && echo dryrun-ok
npm run lint
npx tsc --noEmit
```

## Handoff requirements
End your final message with: summary, files_changed, validation, risks, handoff_note — 특히 팔레트 8의 HEX 근거(어느 정본에서 왔는지)와 DRY_RUN 출력 예시 1건.
