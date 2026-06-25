// 동물 마을 세계 → SessionShell 이 쓰는 GameRoundSpec[] + 활동 config 로 변환.
// 엔진/태그 계약 보존: 라운드 태그는 기존 tagForGameType 으로, 막(phase) 흐름은 그대로.
// 시나리오(act1 정서 → 전환 → act2 창의)가 활동을 직접 배치한다(랜덤 생성 아님).

import {
  ANIMAL_VILLAGE,
  getActivity,
  type ActivityConfig,
  type VillageSession,
} from '@/data/worlds/animal-village';
import { tagForGameType } from '@/lib/game/curriculum-tags';
import type { GameRoundParams, GameRoundSpec } from '@/types/game';

export interface VillageRound {
  spec: GameRoundSpec;
  activity: ActivityConfig;
}

export interface VillagePlan {
  session: VillageSession;
  rounds: GameRoundSpec[];
  activities: ActivityConfig[];
}

function paramsForActivity(activity: ActivityConfig, seed: number, difficulty: number): GameRoundParams & {
  items: ActivityConfig['items'];
  categories?: string[];
  answer_token?: string;
  prompt_ko: string;
  freeform?: boolean;
} {
  return {
    seed,
    difficulty,
    asset_pool_id: `village:${activity.id}`,
    item_count: activity.items.length,
    time_limit_sec: 60,
    items: activity.items,
    ...(activity.categories ? { categories: activity.categories } : {}),
    ...(activity.answerToken ? { answer_token: activity.answerToken } : {}),
    ...(activity.freeform ? { freeform: true } : {}),
    prompt_ko: activity.prompt_ko,
  };
}

function specForActivity(activity: ActivityConfig, roundIndex: number, seed: number): GameRoundSpec {
  const difficulty = 1 + Math.floor(roundIndex / 3);
  // 막에 맞는 태그: 정서 막=SEL, 창의 막=교수 도구. (tagForGameType 가 토픽으로 분기)
  const tagTopic = activity.phase === 'emotion' ? 'sel_emotion' : 'creativity';
  const tag = tagForGameType(activity.game_type, tagTopic, roundIndex);

  return {
    round_index: roundIndex,
    game_type: activity.game_type,
    params: paramsForActivity(activity, seed + roundIndex * 101, difficulty),
    tag,
    topic: 'animal-village',
    phase: activity.phase,
  };
}

/** 세션 시나리오(act1 → act2)를 라운드 순서대로 펼친다. */
export function buildVillagePlan(session: VillageSession, seed: number): VillagePlan {
  const orderedIds = [...session.act1, ...session.act2];
  const activities: ActivityConfig[] = [];
  const rounds: GameRoundSpec[] = [];

  orderedIds.forEach((activityId, index) => {
    const activity = getActivity(activityId);
    if (!activity) return;
    activities.push(activity);
    rounds.push(specForActivity(activity, index, seed));
  });

  return { session, rounds, activities };
}

/** 'animal-village' 세계의 첫 세션("꾸미 곰의 날") 플랜. */
export function buildAnimalVillagePlan(seed: number): VillagePlan {
  const session = ANIMAL_VILLAGE.sessions[0];
  return buildVillagePlan(session, seed);
}

export function isAnimalVillageTopic(topic: string): boolean {
  const key = topic.trim().toLocaleLowerCase('ko-KR');
  return key === 'animal-village' || key.includes('동물 마을') || key.includes('animal');
}
