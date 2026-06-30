import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isSupabaseServiceConfigured, supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { LOCAL_PREVIEW_ATTENTION_QUESTIONS, LOCAL_PREVIEW_LIBRARY_VIDEO } from '@/lib/library-preview';
import type { VideoScript } from '@/lib/video-providers/director.types';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

async function verifyChildOwner(childId: string, parentId: string) {
  const { data, error } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

/**
 * POST /api/attention-quiz
 *
 * 영상의 VideoScript 를 읽어 Claude 가 "장면 단서 질문" 3문항 생성.
 * 아이에게 시험처럼 보이지 않도록, 방금 본 장면을 떠올리는 짧은 선택 질문만 만든다.
 *
 * 질문 예시:
 *   - "미리의 머리핀은 어떤 모양이었지?"  (외형 관찰)
 *   - "미리가 가장 먼저 한 동작은?"      (순서 기억)
 *   - "구름 위에 있던 것은?"            (장면 디테일)
 *
 * body: { video_id: string, child_age?: number } | { library_video_id: string, child_age?: number }
 * returns: { questions: Array<{ question: string; options: string[]; correctAnswer: number; focus: 'appearance'|'action'|'detail'|'count' }> }
 */

interface AttentionQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  focus: 'appearance' | 'action' | 'detail' | 'count';
}

export async function POST(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  const { video_id, library_video_id, child_age } = await request.json();
  if (!video_id && !library_video_id) {
    return NextResponse.json({ error: 'video_id or library_video_id required' }, { status: 400 });
  }
  if (video_id && library_video_id) {
    return NextResponse.json({ error: 'only one of video_id or library_video_id allowed' }, { status: 400 });
  }

  if (!isSupabaseServiceConfigured() && library_video_id === LOCAL_PREVIEW_LIBRARY_VIDEO.id) {
    return NextResponse.json({
      questions: LOCAL_PREVIEW_ATTENTION_QUESTIONS,
      meta: { source: 'local-preview' },
    });
  }

  let script: VideoScript | null = null;
  let title = '';
  let topic = '';

  if (video_id) {
    const { data: video, error } = await supabase
      .from('videos')
      .select('script, title, topic, child_id')
      .eq('id', video_id)
      .single();
    if (error || !video?.script) {
      return NextResponse.json({ error: 'video or script not found' }, { status: 404 });
    }

    const owned = await verifyChildOwner(video.child_id, parentId);
    if (!owned) {
      return NextResponse.json({ error: 'video not found' }, { status: 404 });
    }

    script = video.script as VideoScript;
    title = video.title;
    topic = video.topic;
  } else {
    const { data: lib, error } = await supabase
      .from('library_videos')
      .select('script, title, topic, age_band')
      .eq('id', library_video_id)
      .eq('published', true)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!lib?.script) {
      return NextResponse.json({ error: 'library video or script not found' }, { status: 404 });
    }

    script = lib.script as VideoScript;
    title = lib.title;
    topic = lib.topic;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 });
  }

  const scriptSummary = summarizeScript(script);
  const ageLabel = typeof child_age === 'number' ? `${child_age}세` : '5-7세';

  const client = new Anthropic({ apiKey });
  const t0 = Date.now();

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-opus-4-7',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `영상 제목: ${title}
주제: ${topic}
시청자 연령: ${ageLabel}

## 영상 씬 요약
${scriptSummary}

	위 영상을 보고 아이가 방금 본 장면을 자연스럽게 떠올릴 수 있는 단서 질문 3개를 생성해.
	각 질문은 visual/auditory 세부사항을 묻는다. 개념/학습 내용 질문은 금지.

JSON 만 응답. 다른 말 금지.`,
      },
    ],
  });

  const elapsedMs = Date.now() - t0;

  const rawText = response.content
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('')
    .trim();

  const parsed = parseQuestions(rawText);
  if (!parsed) {
    return NextResponse.json(
      { error: 'claude returned unparseable quiz', raw: rawText.slice(0, 800) },
      { status: 502 }
    );
  }

  const costUsd = ((response.usage.input_tokens * 15) + (response.usage.output_tokens * 75)) / 1_000_000;

  return NextResponse.json({
    questions: parsed,
    meta: {
      model: response.model,
      elapsed_ms: elapsedMs,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost_usd: Number(costUsd.toFixed(4)),
    },
  });
}

const SYSTEM_PROMPT = `너는 한국 어린이(3-8세)를 위한 "장면 단서 질문" 설계자다.

## 역할
영상의 씬 요약을 받아 아이가 방금 본 장면을 짧게 떠올리는 선택 질문 3개를 만든다.
아이에게는 놀이처럼 보여야 하며, 보호자 리포트에는 관찰 가능한 활동 기록으로만 사용된다.

## 질문 유형 (4가지 focus 중 하나를 각 질문에 태그)
- appearance: 캐릭터/사물의 외형(색·모양·옷·머리·소품)을 관찰했는지
- action: 캐릭터가 한 동작/순서를 기억하는지
- detail: 배경의 구체적인 요소(구름·꽃·글자 등)를 포착했는지
- count: 등장한 개수(꽃 몇 송이, 구름 몇 개 등)를 주의깊게 봤는지

## 규칙
- 한국어. 아이 레벨 문장 (15자 이내 선호).
- 각 질문 보기는 2~4개. 정답 1개만 명확.
- 학습 개념 (비, 구름 원리 등) 을 묻지 말 것. 오직 화면/소리 디테일.
- script 에 실제로 존재하는 내용만 질문 (환각 금지).
- 오답 보기는 그럴듯해야 함 (아이가 추측으로 맞추기 어렵게).

## 출력 포맷 (JSON 만, 다른 말 금지)
{
  "questions": [
    {
      "question": "미리의 머리핀 색깔은?",
      "options": ["하늘색", "노란색", "분홍색"],
      "correctAnswer": 0,
      "focus": "appearance"
    },
    ...3개...
  ]
}`;

/** VideoScript 를 짧은 한국어 요약으로 직렬화. Opus 가 script 객체를 이해하기 쉽게. */
function summarizeScript(script: unknown): string {
  if (!script || typeof script !== 'object') return '(스크립트 없음)';
  const s = script as Record<string, unknown>;

  const lines: string[] = [];

  // 캐릭터
  const chars = s.characters as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(chars) && chars.length > 0) {
    lines.push('### 캐릭터');
    for (const c of chars) {
      const name = c.displayName ?? c.id;
      const appearance = c.appearance ?? c.visualDescription ?? '';
      lines.push(`- ${name}: ${appearance}`);
    }
  }

  // 배경
  const bg = s.background as Record<string, unknown> | undefined;
  if (bg) {
    const world = bg.worldDescription ?? bg.description ?? '';
    if (world) lines.push(`### 배경\n${world}`);
  }

  // 씬별 상세
  const scenes = s.scenes as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(scenes)) {
    lines.push('### 씬별 내용');
    for (const sc of scenes) {
      const id = sc.id ?? '?';
      const action = sc.action ?? '';
      const effects = sc.effects ?? '';
      const location = sc.location ?? '';
      const emotion = sc.emotion ?? '';
      const dialogueRaw = sc.dialogue;
      let dialogueText = '';
      if (typeof dialogueRaw === 'string') dialogueText = dialogueRaw;
      else if (Array.isArray(dialogueRaw)) {
        dialogueText = dialogueRaw
          .map((d) => (typeof d === 'string' ? d : (d as { text?: string }).text))
          .filter(Boolean)
          .join(' / ');
      } else if (dialogueRaw && typeof dialogueRaw === 'object') {
        dialogueText = (dialogueRaw as { text?: string }).text ?? '';
      }
      lines.push(
        `[${id}] 장소: ${location} | 동작: ${action} | 효과: ${effects} | 대사: ${dialogueText} | 감정: ${emotion}`
      );
    }
  }

  return lines.join('\n');
}

/** Claude 응답에서 JSON 블록 추출 + 검증. */
function parseQuestions(raw: string): AttentionQuestion[] | null {
  // 코드블록 제거
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    const obj = JSON.parse(cleaned) as { questions?: unknown };
    if (!Array.isArray(obj.questions)) return null;
    const valid: AttentionQuestion[] = [];
    for (const q of obj.questions) {
      if (!q || typeof q !== 'object') continue;
      const item = q as Record<string, unknown>;
      if (
        typeof item.question === 'string' &&
        Array.isArray(item.options) &&
        item.options.every((o) => typeof o === 'string') &&
        typeof item.correctAnswer === 'number' &&
        item.correctAnswer >= 0 &&
        item.correctAnswer < item.options.length
      ) {
        const focus = (item.focus as string) || 'detail';
        const allowedFocus = ['appearance', 'action', 'detail', 'count'];
        valid.push({
          question: item.question,
          options: item.options as string[],
          correctAnswer: item.correctAnswer,
          focus: allowedFocus.includes(focus)
            ? (focus as AttentionQuestion['focus'])
            : 'detail',
        });
      }
    }
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}
