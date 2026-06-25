/**
 * 스모크 1: Claude 감독 에이전트만 격리 검증.
 *
 * 주제: "비는 왜 올까?" (초등 저학년 교육 애니메이션).
 * 출력: tmp/smoke/script.json + 콘솔 summary.
 *
 * 실행:
 *   npx tsx scripts/smoke-director.ts
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ClaudeDirector } from '../src/lib/video-providers/claude-director';
import {
  getBackgroundDescription,
  getSceneDialogue,
  type VideoBrief,
} from '../src/lib/video-providers/director.types';

const BRIEF: VideoBrief = {
  topic: '비는 왜 올까?',
  audience: '초등 저학년 (7-9세)',
  targetDurationSec: 30,
  learningGoals: [
    '물의 순환 개념 이해 (증발 → 응결 → 강수)',
    '구름이 어떻게 만들어지는지 감각적으로 파악',
    '일상에서 물 순환을 관찰할 수 있다는 호기심 자극',
  ],
  styleReference:
    'cinematic 2D cel animation with soft watercolor backgrounds, K-pop idol inspired character design meets Pinkfong/Pororo-level kid-friendly aesthetic, pastel palette, single-take feel',
  tone: '밝고 따뜻하며 호기심을 자극하는',
  roughSynopsis:
    '주인공 여자아이 1명이 물의 순환을 직접 안내한다. 바다 → 하늘 → 구름 → 비 → 연못으로 이어지는 연속 여정을 시청자에게 설명.',
  protagonistHint:
    '**인간형 여자아이 주인공 1명**, 8~9세. K-pop 아이돌 스타일 비주얼 (트렌디한 헤어스타일 — 양갈래 포니테일 또는 하이 포니테일, 반짝이는 큰 눈, 분홍 볼, 또렷한 입술과 치아), 물/비 테마 귀여운 의상 (하늘색-화이트 배색, 물방울/구름 장식, 레인부츠 또는 운동화), 핑크퐁 어린이 TV 주인공 같은 친근함 + 현대 K-kids 애니메이션 스타일링. **입이 항상 명확하게 보이도록 디자인** — 이는 립싱크 필수 요구사항. 표정 변화 풍부 (웃음/놀람/호기심) 가능해야 함. 이름은 감독이 자유롭게 제안 (한국어, 귀엽고 부르기 쉬운 2-3음절).',
};

/** 캐릭터 디자인 기술 요구사항 — 립싱크 품질 확보용 명시적 제약 */
const TECHNICAL_REQUIREMENTS = [
  '캐릭터는 반드시 인간형 여자아이 (humanoid), 의인화된 사물/요정 불가',
  '입술(upper lip + lower lip)이 항상 명확히 시각화되어야 함 — AI 립싱크 툴이 인식 가능한 수준',
  '말하지 않을 때도 입이 보이는 디자인 (작은 웃음 또는 살짝 벌린 neutral)',
  '대사 있는 씬은 최소 한 번 얼굴 정면 또는 3/4 각도 클로즈업 포함 (shot size ≥ medium)',
  '캐릭터 얼굴 비율은 치비(chibi) 과장 안 함 — 입 영역이 얼굴 대비 최소 5% 이상 차지',
  '표정 range: neutral smile, talking (open mouth with visible teeth/tongue), surprised (O shape), cheerful (wide smile)',
];

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL ?? 'claude-opus-4-7';
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY 가 .env.local 에 없음');
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log(`  스모크 1: Claude 감독 에이전트 (${model})`);
  console.log('='.repeat(70));
  console.log(`\n주제: ${BRIEF.topic}`);
  console.log(`청중: ${BRIEF.audience}`);
  console.log(`목표 길이: ${BRIEF.targetDurationSec}초`);
  console.log(`스타일: ${BRIEF.styleReference}`);
  console.log(`\n감독 에이전트 호출 중...`);

  const director = new ClaudeDirector({ apiKey, model });
  // 기술 요구사항을 브리프에 합쳐 전달
  const briefWithTech: typeof BRIEF = {
    ...BRIEF,
    roughSynopsis:
      `${BRIEF.roughSynopsis}\n\n**캐릭터 디자인 기술 요구사항 (필수 준수):**\n${TECHNICAL_REQUIREMENTS.map((r) => `- ${r}`).join('\n')}`,
  };
  const result = await director.direct(briefWithTech);

  // 출력 저장
  const outDir = join(process.cwd(), 'tmp', 'smoke');
  mkdirSync(outDir, { recursive: true });
  const scriptPath = join(outDir, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(result.script, null, 2), 'utf-8');

  const metaPath = join(outDir, 'director-meta.json');
  writeFileSync(
    metaPath,
    JSON.stringify(
      {
        model: result.model,
        costUsd: result.costUsd,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cacheReadTokens: result.cacheReadTokens,
        cacheCreationTokens: result.cacheCreationTokens,
        elapsedMs: result.elapsedMs,
      },
      null,
      2
    ),
    'utf-8'
  );

  // 콘솔 요약
  const s = result.script;
  const styleStr = Array.isArray(s.styleDirectives)
    ? s.styleDirectives.join(', ')
    : s.styleDirectives;
  console.log('\n' + '─'.repeat(70));
  console.log(`  📜 대본 요약`);
  console.log('─'.repeat(70));
  console.log(`제목: ${s.title}`);
  console.log(`총 길이: ${s.totalDurationSec}초 (${s.scenes.length}씬)`);
  console.log(`\n등장 캐릭터:`);
  for (const c of s.characters) {
    console.log(`  • ${c.displayName} (${c.id}) — ${c.voice} / ${c.personality.slice(0, 40)}...`);
  }
  const bgDesc = getBackgroundDescription(s);
  console.log(`\n배경: ${(bgDesc || '(미기재)').slice(0, 100)}...`);
  console.log(`톤앤무드: ${s.toneAndMood ?? '(미기재)'}`);
  console.log(`스타일: ${(styleStr ?? '').slice(0, 120)}...`);
  console.log(`\n씬 브레이크다운:`);
  for (const sc of s.scenes) {
    const tr = sc.timeRange ?? `${sc.durationSec}s`;
    const cam = (sc.camera ?? '').slice(0, 50);
    console.log(
      `  [${sc.id}] ${tr} — ${sc.emotion ?? ''} / ${cam}`
    );
    const dial = getSceneDialogue(sc);
    if (dial) console.log(`         💬 "${dial.text}"`);
    const action = sc.action ?? '';
    console.log(`         🎬 ${action.slice(0, 100)}${action.length > 100 ? '...' : ''}`);
  }
  const checklist = s.consistencyChecklist ?? [];
  console.log(`\n일관성 체크리스트 (${checklist.length}개):`);
  for (const item of checklist.slice(0, 3)) {
    const t = typeof item === 'string' ? item : String(item);
    console.log(`  • ${t.slice(0, 90)}${t.length > 90 ? '...' : ''}`);
  }
  if (checklist.length > 3) {
    console.log(`  ... +${checklist.length - 3}개`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`  💰 비용 / 성능`);
  console.log('─'.repeat(70));
  console.log(`모델: ${result.model}`);
  console.log(`입력 토큰: ${result.inputTokens} (캐시 write: ${result.cacheCreationTokens}, 캐시 read: ${result.cacheReadTokens})`);
  console.log(`출력 토큰: ${result.outputTokens}`);
  console.log(`비용: $${result.costUsd.toFixed(4)}`);
  console.log(`소요: ${(result.elapsedMs / 1000).toFixed(1)}초`);

  console.log(`\n✅ 저장:\n  ${scriptPath}\n  ${metaPath}`);
}

main().catch((e) => {
  console.error('\n❌ 실패:', e);
  process.exit(1);
});
