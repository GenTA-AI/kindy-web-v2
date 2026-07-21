# Island Audio License Record

등대섬의 환경음·효과음은 `src/components/island/island-audio.ts`가 Web Audio API로 직접
합성한다. 편지와 꾸미기 안내는 라이브 TTS를 사용하지 않고, 아래의 사전
렌더링된 MP3 실파일만 버튼 제스처 후 재생한다.

| Runtime key | 용도 | 출처 |
| --- | --- | --- |
| `island-wave-ambience-island-audio` | 잔잔한 파도 앨비언스 | KINDY 자체 Web Audio 합성 |
| `island-birds-ambience-island-audio` | 먼 바닷새 앨비언스 | KINDY 자체 Web Audio 합성 |
| `island-move-sfx-island-audio` | 탭 이동 피드백 | KINDY 자체 Web Audio 합성 |
| `island-letter-sfx-island-audio` | 편지 열기 | KINDY 자체 Web Audio 합성 |
| `island-place-sfx-island-audio` | 이야기 조각 놓기 | KINDY 자체 Web Audio 합성 |
| `island-lighthouse-sfx-island-audio` | 등대 점등 | KINDY 자체 Web Audio 합성 |
| `island-letter-read-aloud-npc` | `npc-letter-ko.mp3` 편지 읽어주기 | Google Translate 한국어 음성, 로컬 사전 렌더링 |
| `island-decorate-read-aloud-npc` | `decorate-guide-ko.mp3` 꾸미기 안내 | Google Translate 한국어 음성, 로컬 사전 렌더링 |

## 사전 렌더링 음성 취득 기록

| 파일 | 원본 서비스 | 취득일 | 수정 | 현재 사용 범위 |
| --- | --- | --- | --- | --- |
| `npc-letter-ko.mp3` | `https://translate.google.com/translate_tts` | 2026-07-21 | 없음(24kHz mono MP3 원본) | 비상업 개발·시안 전용 |
| `decorate-guide-ko.mp3` | `https://translate.google.com/translate_tts` | 2026-07-21 | 없음(24kHz mono MP3 원본) | 비상업 개발·시안 전용 |

## 배포 게이트

- Web Audio 합성 키에는 Cute Fantasy 또는 제3자 무료 티어 음원이 포함되지 않는다.
- Google Translate 사전 렌더링 파일은 배포·상업 이용권을 확인하지 않은 개발용 플레이스홀더다.
- **무료 티어 에셋은 비상업 개발·시안 전용이다. 실배포 전에 상용 라이선스가 확인된
  자체 녹음 또는 유료 에셋으로 교체하고, 이 파일과 `docs/ASSETS.md`를 함께 갱신해야 한다.**
- 외부 음원으로 교체할 때는 원본 URL, 제작자, 라이선스, 취득일, 수정 여부를 키별로 기록한다.
