# Island Audio License Record

등대섬 오디오는 외부 녹음 파일을 포함하지 않는다. 아래 실키는
`src/components/island/island-audio.ts`가 Web Audio API의 oscillator, noise buffer, filter, gain으로
브라우저에서 직접 합성하며 KINDY 프로젝트 코드와 동일한 권리 범위로 관리한다.

| Runtime key | 용도 | 출처 |
| --- | --- | --- |
| `island-wave-ambience-island-audio` | 잔잔한 파도 앰비언스 | KINDY 자체 Web Audio 합성 |
| `island-birds-ambience-island-audio` | 먼 바닷새 앰비언스 | KINDY 자체 Web Audio 합성 |
| `island-move-sfx-island-audio` | 탭 이동 피드백 | KINDY 자체 Web Audio 합성 |
| `island-letter-sfx-island-audio` | 편지 열기 | KINDY 자체 Web Audio 합성 |
| `island-place-sfx-island-audio` | 이야기 조각 놓기 | KINDY 자체 Web Audio 합성 |
| `island-lighthouse-sfx-island-audio` | 등대 점등 | KINDY 자체 Web Audio 합성 |

## 배포 게이트

- 현재 오디오 키에는 Cute Fantasy 또는 제3자 무료 티어 음원이 포함되지 않는다.
- **무료 티어 에셋은 비상업 개발·시안 전용이다. 무료 티어 음원을 추가할 경우 실배포 전에 상용
  라이선스가 확인된 유료 에셋으로 교체하고, 이 파일과 `docs/ASSETS.md`를 함께 갱신해야 한다.**
- 외부 음원으로 교체할 때는 원본 URL, 제작자, 라이선스, 취득일, 수정 여부를 키별로 기록한다.
