# Review: script-repair-retry
decision: approve
- 정확히 1회 리페어: validate 실패 → 오류+실패 JSON+브리프로 재호출 → 재검증 → 실패 시 두 사유+비용 포함 throw. 스펙 일치.
- 비용 합산(초기+리페어), [director-repair] 로그, 캐시 재사용(리페어 저렴), validateEpisodeScript 룰 무변경, 타 스테이지 무침범, scope_ok=1.
- nice_to_have: 1차 응답 non-JSON 파싱 실패는 리페어 경로 밖(희귀·비차단).
