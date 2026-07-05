# E13-1 아바타 144조합 스틸 스펙 프리즈

> Status: frozen for Studio W3 keyframe preset input, 2026-07-05  
> Source of procedure: `docs/plan/04_R0_EXECUTION_PLAN.md` Task 2.3  
> Style anchors: `docs/BRAND_DNA.md`, `DESIGN.md`, `src/content/studio/approved-frames/20260703-cast-*.png`

## 0. 목적

E13-1의 "아바타 발주"는 외주 계약이 아니라 D-6 LoRA-first 결정에 따른 스펙 프리즈다. R1 E13-5 배치가 `base 1-3 x palette 1-8 x companion 1-6 = 144` 조합을 생성할 수 있도록 조합 키, 프롬프트 계약, QC, 저장 경로, slot 계약을 고정한다.

- 조합 키: `b{base}-p{palette}-c{companion}`
- Storage 경로: Supabase Storage `videos` 버킷 `avatars/base/b{base}-p{palette}-c{companion}.png`
- 1군 모델: Studio `keyframe_image`의 `flux-2-kindytoy-lora-v1`
- 2군 폴백: 기존 nano-banana 어댑터
- 레퍼런스: 승인 캐스트 6인 프레임과 BRAND_DNA KINDYTOY 룩

## 1. 베이스 3

베이스는 아이의 실제 얼굴, 사진, 신체 특징을 추정하지 않는 조립식 KINDYTOY 주인공 체형이다. 모든 베이스는 치비 비율, 큰 머리, 작고 둥근 몸, 짧은 팔다리, 이빨 없는 부드러운 미소, 따뜻한 catchlight를 공유한다.

| base | 이름 | 체형 정의 | 헤어 실루엣 정의 | 금지 |
|---|---|---|---|---|
| 1 | 둥근 잎머리 | 가장 작은 키, 폭이 넓은 둥근 몸, 안정적인 발 | 잎사귀 두 장이 겹친 듯한 둥근 앞머리, 귀와 목선을 가리지 않음 | 실제 아이 얼굴 비율, 긴 인체형 팔 |
| 2 | 구름 단발 | 중간 키, 볼륨 있는 머리와 짧은 목, 포근한 실루엣 | 구름처럼 부드러운 단발 곡선, 양옆 볼륨은 둥글게 | 사실적 머릿결, 세밀한 모공 |
| 3 | 새싹 꽁지 | 가장 활동적인 균형, 살짝 긴 몸통과 둥근 손 | 작은 새싹 꽁지 1개와 짧은 옆머리, 뾰족하지 않게 둥글림 | 날카로운 스파이크, 성인형 헤어 |

## 2. 팔레트 8

팔레트는 의상 주색과 헤어 색을 동시에 정의한다. HEX 근거는 `DESIGN.md` R3 색상 토큰과 `docs/BRAND_DNA.md` §2 팔레트 및 `src/app/globals.css` 실토큰이다. `DESIGN.md`와 `BRAND_DNA.md`에 값 차이가 있는 Cream/Sage/Gold 계열은 아래 표의 `source`에 명시한 정본 값을 사용한다.

| palette | 이름 | 의상 HEX | 헤어 HEX | source | 프롬프트 요약 |
|---|---|---:|---:|---|---|
| 1 | Cream Sage | `#F4EAD2` | `#46763F` | `DESIGN.md` R3 Cream/Sage | cream outfit, sage soft hair |
| 2 | Surface Moss | `#FBF7EC` | `#2E5129` | `DESIGN.md` R3 Surface/Sage-deep | warm surface outfit, deep moss hair |
| 3 | Sage Soft | `#E4EDDF` | `#93B589` | `DESIGN.md` R3 Sage-bg/Sage-soft | pale sage outfit, soft sage hair |
| 4 | Kindy Cream | `#FBF7EF` | `#5F735F` | `BRAND_DNA.md` §2, `globals.css` | KINDYTOY cream outfit, canonical sage hair |
| 5 | Warm Wood | `#E3D8C8` | `#3F5140` | `BRAND_DNA.md` §2, `globals.css` | warm wood outfit, deep sage hair |
| 6 | Gentle Heart | `#DDE8DE` | `#83A58D` | `globals.css` tokens, BRAND_DNA sage family | gentle sage outfit, muted leaf hair |
| 7 | Gold Point | `#D19A43` | `#EEE5D4` | `BRAND_DNA.md` §2, `globals.css` | small gold-point outfit, cream-deep hair |
| 8 | Living Ink | `#AFC4AE` | `#233126` | `BRAND_DNA.md` §2, `globals.css` | sage-soft outfit, warm ink hair |

팔레트 적용 규칙: 의상 70%, 헤어 25%, 골드 또는 catchlight 포인트 5% 이하. 채도 높은 원색 도배와 차가운 청색광은 금지한다.

## 3. 단짝 6

단짝은 HERO v1.0 §3의 여우·고래·부엉이·토끼·거북·다람쥐 선택지를 따른다. Task 2.3의 승인 캐스트 6인 레퍼런스 요구에 맞춰 `src/content/studio/approved-frames/20260703-cast-{mori,kkumi,bangul,naong,doto,owl}.png`를 스타일 앵커로 사용한다. 동물 종은 아래 companion 정의가 우선이고, 승인 캐스트는 KINDYTOY 조형·질감·눈·조명 기준으로만 참조한다.

| companion | HERO 선택지 | 승인 캐스트 스타일 앵커 | 시각 정의 |
|---|---|---|---|
| 1 | 여우 | `20260703-cast-naong.png` | 둥근 귀와 풍성한 꼬리, 코랄이 아닌 세이지 계열 리본 포인트 |
| 2 | 고래 | `20260703-cast-kkumi.png` | 작고 둥근 보 고래, 등은 소프트 세이지, 배는 크림 |
| 3 | 부엉이 | `20260703-cast-owl.png` | 둥근 안경 같은 눈, 니트 목도리, 밤 장면에서도 공포감 없음 |
| 4 | 토끼 | `20260703-cast-bangul.png` | 긴 귀를 둥글게 접은 활발한 토끼, 금방울 대신 작은 골드 포인트 |
| 5 | 거북 | `20260703-cast-mori.png` | 둥근 등껍질과 느린 미소, 책정령 잎귀 느낌은 등껍질 패턴으로만 반영 |
| 6 | 다람쥐 | `20260703-cast-doto.png` | 꼬리를 안는 작은 다람쥐, 도토리 소품 1개 이하 |

## 4. 시트 규격

아바타와 단짝 시트 규격은 `8각도 x 표정 4`다. 8각도는 front, front-left, left, back-left, back, back-right, right, front-right를 의미한다. 표정 4종은 neutral smile, curious, delighted, gentle worried로 고정한다.

이 규격은 `docs/plan/03_MORI_STUDIO_PLAN.md` §5-0 각주의 구분을 따른다. 모리 마스터 시트의 표정 8종과 다르며, 아바타 베이스·단짝은 HERO v1.0 §3의 캐릭터 시트 `8각도 x 표정 4`가 정본이다.

## 5. QC 기준

QC는 실사 유사 금지와 KINDYTOY 룩 정합을 모두 통과해야 한다. 실패한 컷은 HITL 승인 대상에 올리지 않는다.

- 실사 유사 금지: photorealistic human, realistic child face, camera photo, skin pore detail, real hair strand, DSLR portrait, uncanny realism이 보이면 실패.
- KINDYTOY 정합: 벨벳 플로킹 소프트매트 질감, 광택 0, 큰 둥근 눈, 따뜻한 catchlight, 치비 비율, 이빨 없는 미소, 따뜻한 주광/랜턴 글로우, 미니어처 스토리북 숲 마을 디오라마.
- 금지 프롬프트: `photorealistic, realistic human, child photo, camera capture, 3D glossy plastic, porcelain, scary, horror, dark shadows, villain, predator, sharp teeth, letter above head, floating letters, any text, watermark, logo`
- 골든 태스크 연결: K19-K20 아바타 슬롯 합성 2종이 이 스펙을 검증한다.
- 안전 원칙: 사진 업로드·카메라 입력·실제 아동 외형 추정은 E13-10과 충돌하므로 이 스펙과 샘플 스크립트의 범위 밖이다.

## 6. slot 계약

에피소드 메타데이터는 0027 코멘트 원문 계약을 유지한다. 모든 slot은 fallback을 가져야 하며, moving 컷이 지연되거나 실패하면 still 컷으로 즉시 대체한다.

```ts
type AvatarSlot = {
  shot_id: string;
  kind: 'still' | 'moving';
  duration_s: number;
  fallback_shot_id: string;
};

const avatar_slots: AvatarSlot[] = [
  { shot_id: 'avatar_intro_still', kind: 'still', duration_s: 2.0, fallback_shot_id: 'avatar_intro_still' },
  { shot_id: 'companion_reaction_still', kind: 'still', duration_s: 1.5, fallback_shot_id: 'companion_reaction_still' },
  { shot_id: 'avatar_wave_moving', kind: 'moving', duration_s: 3.0, fallback_shot_id: 'avatar_intro_still' },
];
```

slot 렌더 입력은 `b{base}-p{palette}-c{companion}` 조합 키와 episode shot context만 받는다. child_id, 이름, 사진, 카메라 입력, 진단/점수 정보는 프롬프트에 포함하지 않는다.

## 7. 사전조합 경제

사전조합 경제는 HERO v1.0 §3의 공유 자산 가정을 따른다. 에피소드당 주인공 스틸 2컷 x 144조합 = 288장이고, LoRA 또는 nano-banana 추론 단가를 약 $0.04/장으로 보면 에피소드당 약 +$12다. 이 비용은 아이별 실시간 생성이 아니라 공유 사전조합으로 상각한다.

샘플 검증은 3조합 x 1컷만 사용하며 예상 비용은 nano-banana 기준 `3 x $0.039 = $0.117`, 즉 ≤ $0.12다. 실제 생성은 리드/사람 승인 후 실행하고, 워커 검증은 `DRY_RUN=1`로 프롬프트와 레퍼런스 계약만 확인한다.

## 8. 생성 프롬프트 계약

기본 프롬프트는 아래 요소를 순서대로 결합한다.

1. `KINDYTOY style soft matte designer toy`
2. 베이스 체형·헤어 실루엣
3. 팔레트 의상·헤어 HEX
4. 단짝 동물 시각 정의
5. storybook forest village diorama, warm daylight and lantern glow
6. QC negative

샘플 조합:

| sample | combo | 목적 |
|---|---|---|
| 1 | `b1-p1-c1` | 가장 기본적인 크림+세이지 여우 조합 |
| 2 | `b2-p4-c3` | BRAND_DNA canonical cream/sage와 부엉이 조합 |
| 3 | `b3-p8-c6` | 어두운 헤어 대비와 다람쥐 조합 |

## 9. 대표 승인란

| 항목 | 값 |
|---|---|
| 샘플 경로 | `tmp/avatar-samples/` |
| 대표 승인 일자 | [사람] 샘플 실생성 후 기입 |
| 승인 샘플 | [사람] `b1-p1-c1.png`, `b2-p4-c3.png`, `b3-p8-c6.png` 확인 후 기입 |
| 비고 | LoRA 생존 확인(Task 4.2) 전에는 nano-banana 샘플만 스모크 가능 |
