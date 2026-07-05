# review: t5-no-camera-test
decision: approve
date: 2026-07-05

- 테스트 실재(렌즈 #3): 실제 스캐너(`scripts/scan-camera-tokens.ts`) — 금지 토큰 7종 전부 정규식 구현, `type="file"`+`accept="image"` 조합 검출, 허용리스트(자기 자신) 최소. 동어반복 아님.
- 위반 주입 재현: `_camera-violation.tmp.tsx` 주입→실패(2건 검출)→삭제→통과, handoff에 기록. 임시 파일 커밋 잔재 없음(porcelain 확인).
- 기존 코드 위반 0건 = 01 문서 실사와 일치. 단언 메시지에 DB측 가드(0025 무 사진 컬럼)·키오스크 별도 커버(E13-7') 명시 — E13-10 AC 충족.
- 환경 노트: 워커 샌드박스에서 `npx tsx --test`의 IPC listen EPERM → `node --import tsx --test`로 등가 검증(게이트는 리드 환경에서 원명령 통과).
