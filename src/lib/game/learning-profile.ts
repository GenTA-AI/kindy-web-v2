/**
 * 학습 조건 진단 (C6 빈도 카운트를 넘어서).
 *
 * 기존 c6-profile 은 "어느 도구를 몇 번 했나"(노출 빈도)만 본다. 부모가 돈을 내는 이유 =
 * "우리 아이가 어떻게/어떤 조건에서 잘 배우는지"를 아는 것. 이 모듈은 game_rounds 가 이미
 * 담고 있는 신호(정확도 score/max_score, 속도 latency_ms, 끈기 retried, 난이도 difficulty)로
 * 도구별 숙련 신호와 "잘 배우는 조건" 한 줄을 뽑는다.
 *
 * 가드레일(sel-report 원칙): 부모 화면에 점수·등급·백분위 금지. 내부 계산엔 수치를 쓰되
 * 노출은 전부 정성 문장으로. 표본이 적으면 진단을 지어내지 않고 "관찰 중"으로 둔다.
 */
import type { GameRoundResult } from '@/types/game';
import { C6_TOOLS, inferC6Tool, type C6ToolKey } from './c6-profile';

const MIN_ATTEMPTS_PER_TOOL = 2; // 도구별 신호를 말하려면 최소 시도 수
const MIN_TOTAL_ATTEMPTS = 4; // 전체 진단을 열려면 최소 라운드 수

export type MasterySignal = 'strong' | 'growing' | 'emerging' | 'insufficient';

export interface ToolMastery {
  toolKey: C6ToolKey;
  parentLabel: string;
  attempts: number;
  accuracy: number; // 0..1 (내부용)
  retryRate: number; // 0..1 (내부용)
  avgLatencyMs: number | null; // 내부용
  signal: MasterySignal;
  parentNote: string; // 정성, 숫자 없음
}

export interface LearningProfile {
  enoughData: boolean;
  perTool: ToolMastery[];
  /** 잘 해내는(높은 숙련) 도구. */
  strengthTool: ToolMastery | null;
  /** 시도하지만 아직 버거운(낮은 숙련) 도구 = '진짜 약점'(최소사용 도구와 다름). */
  struggleTool: ToolMastery | null;
  /** "어떤 조건에서 잘 배우는지" 한 줄(정성). 표본 부족 시 null. */
  conditionInsight: string | null;
}

const LABEL_BY_KEY = new Map(C6_TOOLS.map((t) => [t.key, t.parentLabel] as const));

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function classify(accuracy: number, retryRate: number, attempts: number): MasterySignal {
  if (attempts < MIN_ATTEMPTS_PER_TOOL) return 'insufficient';
  if (accuracy >= 0.8 && retryRate <= 0.34) return 'strong';
  if (accuracy >= 0.5) return 'growing';
  return 'emerging';
}

function noteFor(signal: MasterySignal, label: string): string {
  switch (signal) {
    case 'strong':
      return `${label} 놀이를 막힘없이 잘 해내요.`;
    case 'growing':
      return `${label} 놀이가 점점 익숙해지고 있어요.`;
    case 'emerging':
      return `${label} 놀이는 아직 함께 더 해보면 좋아요.`;
    default:
      return `${label} 놀이를 조금 더 해보면 흐름이 보여요.`;
  }
}

function conditionInsight(rounds: GameRoundResult[]): string | null {
  const scored = rounds.filter((r) => typeof r.max_score === 'number' && (r.max_score ?? 0) > 0);
  if (scored.length < MIN_TOTAL_ATTEMPTS) return null;

  const accuracy = mean(scored.map((r) => (r.score ?? 0) / (r.max_score as number)));
  const retryRate = mean(rounds.map((r) => (r.retried ? 1 : 0)));
  const latencies = rounds.map((r) => r.latency_ms).filter((v): v is number => typeof v === 'number' && v > 0);
  const avgLatency = latencies.length ? mean(latencies) : null;

  // 난이도가 올라가도 정확도가 유지되는지 (끈기/집중 신호).
  const hard = scored.filter((r) => (r.difficulty ?? 1) >= 3);
  const hardAccuracy = hard.length >= 2 ? mean(hard.map((r) => (r.score ?? 0) / (r.max_score as number))) : null;

  // 가장 두드러진 '조건'을 하나 고른다(정성, 숫자 없음).
  if (hardAccuracy !== null && hardAccuracy >= 0.7) {
    return '어려운 문제에서도 끝까지 집중을 이어가요.';
  }
  if (retryRate >= 0.4 && accuracy >= 0.6) {
    return '한 번에 안 돼도 여러 번 시도하며 끝내 해내는 끈기가 있어요.';
  }
  if (avgLatency !== null && avgLatency <= 6000 && accuracy >= 0.7) {
    return '단서를 빠르게 알아채고 척척 골라내요.';
  }
  if (accuracy >= 0.75) {
    return '차분히 살펴보고 정확하게 골라내요.';
  }
  return '천천히 살펴보며 자기 속도로 익혀가고 있어요.';
}

export function buildLearningProfile(rounds: GameRoundResult[]): LearningProfile {
  const byTool = new Map<C6ToolKey, GameRoundResult[]>();
  for (const round of rounds) {
    const tool = inferC6Tool(round);
    if (!tool) continue;
    const list = byTool.get(tool) ?? [];
    list.push(round);
    byTool.set(tool, list);
  }

  const perTool: ToolMastery[] = [];
  for (const [toolKey, toolRounds] of byTool) {
    const scored = toolRounds.filter((r) => typeof r.max_score === 'number' && (r.max_score ?? 0) > 0);
    const accuracy = scored.length ? mean(scored.map((r) => (r.score ?? 0) / (r.max_score as number))) : 0;
    const retryRate = mean(toolRounds.map((r) => (r.retried ? 1 : 0)));
    const latencies = toolRounds.map((r) => r.latency_ms).filter((v): v is number => typeof v === 'number' && v > 0);
    const avgLatencyMs = latencies.length ? Math.round(mean(latencies)) : null;
    const signal = classify(accuracy, retryRate, toolRounds.length);
    const label = LABEL_BY_KEY.get(toolKey) ?? '이 놀이';
    perTool.push({
      toolKey,
      parentLabel: label,
      attempts: toolRounds.length,
      accuracy,
      retryRate,
      avgLatencyMs,
      signal,
      parentNote: noteFor(signal, label),
    });
  }

  const rated = perTool.filter((t) => t.signal !== 'insufficient');
  const totalAttempts = perTool.reduce((sum, t) => sum + t.attempts, 0);
  const enoughData = totalAttempts >= MIN_TOTAL_ATTEMPTS && rated.length > 0;

  // 강점 = 정확도 최고, 약점 = 시도했지만 정확도 최저(동률 시 재시도율 높은 쪽).
  const byAccuracyDesc = [...rated].sort((a, b) => b.accuracy - a.accuracy || a.retryRate - b.retryRate);
  const byStruggle = [...rated].sort((a, b) => a.accuracy - b.accuracy || b.retryRate - a.retryRate);

  return {
    enoughData,
    perTool,
    strengthTool: enoughData ? byAccuracyDesc[0] ?? null : null,
    struggleTool: enoughData ? byStruggle[0] ?? null : null,
    conditionInsight: enoughData ? conditionInsight(rounds) : null,
  };
}
