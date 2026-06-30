# 저비용 Limited Animation 영상 파이프라인

## 배경

`/Users/jongwonlee/Documents/GenTA/bm/art&science/ocean-edu-imagen`의 기존 방식은 다음 구조였다.

1. 씬별 키 이미지 생성
2. TTS 생성
3. 말하는 씬은 VEED Fabric/Kling/Seedance/Veo 같은 외부 영상 또는 립싱크 모델 호출
4. 나레이션/전환 씬은 ffmpeg로 정지 이미지, 페이드, 오디오 합성
5. 전체 클립 concat

품질은 좋지만 대사 컷이 늘거나 길이가 길어질수록 외부 영상 호출 비용이 누적된다.

## 새 방식

서비스 운영용 기본 제작은 `limited` 모드를 쓴다.

```bash
ANIMATION_MODE=limited npx tsx --env-file=.env.local scripts/generate-library-episode-90s.ts
```

`limited` 모드는 이미지 생성과 TTS는 유지하고, 영상 생성 단계만 로컬 ffmpeg 합성으로 대체한다.

1. 캐릭터 레퍼런스 생성
2. 씬별 16:9 키프레임 생성
3. 씬별 TTS 생성
4. 키프레임에 느린 카메라 움직임 적용
5. 말하는 씬은 2프레임 입 모양 레이어를 반복
6. 오디오 합성 후 전체 concat

외부 image-to-video/립싱크 호출이 없으므로 길이가 늘어나도 추가 비용은 주로 TTS와 이미지 컷 수에만 묶인다.

## 모드 구분

- `premium`: Seedance silent video + 선택적 fal lip-sync. 광고, 랜딩 대표 영상, 투자자 데모처럼 첫인상이 중요한 컷에 사용.
- `limited`: 정지 키프레임 + slow zoom/pan + 입뻐끔. 학습 본편, 반복 콘텐츠, 도서관/가정용 대량 라이브러리에 사용.

## 입 위치 조정

기본 입 위치는 화면 중앙 클로즈업 기준이다. 씬 구도가 다르면 환경변수로 조정한다.

```bash
LIMITED_MOUTH_BOX="0.50,0.455,0.082,0.030"
```

순서는 `x,y,width,height`이고 모두 0-1 정규화 좌표다.

## 로컬 스모크 테스트

네트워크와 유료 키 없이 렌더러만 확인한다.

```bash
npm run smoke:limited-animation
```

결과물:

- `tmp/limited-animation-smoke/limited-speaking.mp4`
- `tmp/limited-animation-smoke/preview.jpg`

## 제작 가이드

- 말하는 씬 키프레임은 medium close-up, 정면, 입이 잘 보이는 구도로 만든다.
- 나레이션 씬은 캐릭터 얼굴을 억지로 넣지 말고 배경/오브젝트 중심으로 pan 또는 pull-out을 쓴다.
- 아이용 5-7세 콘텐츠는 한 컷 안의 정보량을 줄이고, 씬당 한 행동만 보여준다.
- 프리미엄 생성은 첫 소개 영상과 핵심 홍보 컷에 집중하고, 본편 학습 반복 영상은 limited로 뽑는다.
