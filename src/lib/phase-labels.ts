const PHASE_LABELS: Record<string, string> = {
  // 신규 phase 키 (spec)
  character_design: '미리가 옷을 고르고 있어요',
  scene_composition: '장면을 꾸미고 있어요',
  voice_recording: '미리가 목소리를 입히고 있어요',
  rendering: '영상을 마무리하고 있어요',
  subtitles: '자막을 그리고 있어요',
  // 옛 VideoPhase 키 (back-compat — DB 에 잔존하는 옛 데이터)
  director: '미리가 대본을 쓰고 있어요',
  refs: '미리가 옷을 고르고 있어요',
  keyframes: '장면을 꾸미고 있어요',
  video_s01: '영상을 만들고 있어요',
  video_s02: '영상을 마무리하고 있어요',
  concat: '영상을 이어 붙이고 있어요',
  upload: '영상을 올리고 있어요',
  done: '완료',
};

export function phaseLabel(key: string): string {
  return PHASE_LABELS[key] ?? '준비 중';
}
