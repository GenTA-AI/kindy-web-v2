# Handoff: minimal-invisible-pass (attempt 1 → retry 필요)

## 이전 런 요약
카피·미니멀 정비는 리뷰 통과(금지어·AI 언급 0, 법정 라벨 보존, 과삭제 아님, 조사 교정 정확). 단 1건 블로킹.

## 반려 사유 (critical 1)
MoriDemoJourney.tsx의 START_HREF를 `/start?from=ai-diagnosis` → `/start`로 바꿔 어트리뷰션 파라미터를 제거:
- start/page.tsx normalizeMarketingSource가 항상 null → kindy_source 쿠키 기록 단절(데모→가입 캡처 사멸)
- isAiDiagnosis 분기 사멸 → 데모 유입자가 데모 연결 카피 대신 일반 카피
- 패키지 "라우팅 변경 금지" 제약 위반

## 지시
`?from=ai-diagnosis` 원복(고객 비가시 소스코드 값). 다른 파일·카피는 건드리지 말 것.
