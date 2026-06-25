import Link from 'next/link';
import { redirect } from 'next/navigation';
import SessionShell from '@/components/game/SessionShell';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { planSession } from '@/lib/game/engine';
import { buildAnimalVillagePlan } from '@/lib/game/village-session';
import { getSupabase } from '@/lib/supabase';
import type { Child } from '@/types';
import type { LibraryVideo } from '@/types/library';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type PlayPageProps = {
  searchParams: Promise<SearchParams>;
};
type ChildContext = Pick<Child, 'id' | 'name' | 'age' | 'topics'>;

const ROUND_COUNT = 3;
// 기본 토픽 = 통합 미래역량(정서 + 창의를 한 세션에). 아이가 토픽을 고르지 않았을 때의 폴백.
const DEFAULT_TOPIC = 'future_skills';

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function cleanToken(value: string | null, fallback: string): string {
  const cleaned = value?.trim().toLocaleLowerCase('ko-KR').slice(0, 80);
  return cleaned || fallback;
}

function stableSeed(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) || 1;
}

function dedupeVideos(videos: LibraryVideo[], limit: number): LibraryVideo[] {
  const seen = new Set<string>();
  const unique: LibraryVideo[] = [];

  for (const video of videos) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    unique.push(video);
    if (unique.length >= limit) break;
  }

  return unique;
}

async function loadChildren(parentId: string): Promise<ChildContext[]> {
  const { data, error } = await getSupabase()
    .from('children')
    .select('id, name, age, topics')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ChildContext[];
}

async function queryPublishedVideos(input: {
  topic?: string;
  ageBand?: number;
  limit: number;
}): Promise<LibraryVideo[]> {
  let query = getSupabase()
    .from('library_videos')
    .select('*')
    .eq('published', true);

  if (input.topic) query = query.eq('topic', input.topic);
  if (input.ageBand) query = query.eq('age_band', input.ageBand);

  const { data, error } = await query
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(input.limit);

  if (error) return [];
  return (data ?? []) as LibraryVideo[];
}

async function loadLibraryVideos(input: {
  requestedVideoId: string | null;
  topic: string;
  ageBand: number;
  limit: number;
}): Promise<LibraryVideo[]> {
  const leading: LibraryVideo[] = [];

  if (input.requestedVideoId) {
    const { data } = await getSupabase()
      .from('library_videos')
      .select('*')
      .eq('id', input.requestedVideoId)
      .eq('published', true)
      .maybeSingle();

    if (data) leading.push(data as LibraryVideo);
  }

  const topicAge = await queryPublishedVideos({
    topic: input.topic,
    ageBand: input.ageBand,
    limit: input.limit,
  });
  const topicOnly = topicAge.length >= input.limit
    ? []
    : await queryPublishedVideos({
        topic: input.topic,
        limit: input.limit,
      });
  const fallback = topicAge.length + topicOnly.length >= input.limit
    ? []
    : await queryPublishedVideos({
        limit: input.limit,
      });

  return dedupeVideos([...leading, ...topicAge, ...topicOnly, ...fallback], input.limit);
}

function EmptyChildrenState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-violet-50 px-6">
      <section className="max-w-md rounded-3xl bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-violet-500">Kindy Play</p>
        <h1 className="mt-2 text-2xl font-black text-gray-900">아이 프로필이 필요해요</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-gray-500">
          플레이 세션은 아이별 진행과 보상을 저장해요.
        </p>
        <Link
          href="/onboarding"
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700"
        >
          프로필 만들기
        </Link>
      </section>
    </main>
  );
}

function EmptyLibraryState({ childId, topic }: { childId: string; topic: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-violet-50 px-6">
      <section className="max-w-md rounded-3xl bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-violet-500">Kindy Play</p>
        <h1 className="mt-2 text-2xl font-black text-gray-900">볼 수 있는 영상이 아직 없어요</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-gray-500">
          {topic} 주제의 게시된 라이브러리 영상이 준비되면 바로 시작할 수 있어요.
        </p>
        <Link
          href={`/library?childId=${encodeURIComponent(childId)}`}
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700"
        >
          라이브러리 보기
        </Link>
      </section>
    </main>
  );
}

export default async function PlayPage({ searchParams }: PlayPageProps) {
  let parentId: string;

  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) {
      redirect('/auth/login?next=/play');
    }
    throw error;
  }

  const resolvedSearchParams = await searchParams;
  const requestedChildId = firstParam(resolvedSearchParams.childId);
  const requestedTopic = firstParam(resolvedSearchParams.topic);
  const requestedVideoId = firstParam(resolvedSearchParams.videoId);
  const children = await loadChildren(parentId);
  const selectedChild = requestedChildId
    ? children.find((child) => child.id === requestedChildId) ?? children[0] ?? null
    : children[0] ?? null;

  if (!selectedChild) {
    return <EmptyChildrenState />;
  }

  const childTopics = Array.isArray(selectedChild.topics) ? selectedChild.topics : [];
  const topic = cleanToken(requestedTopic, cleanToken(childTopics[0] ?? null, DEFAULT_TOPIC));
  const ageBand = Number.isFinite(selectedChild.age) ? selectedChild.age : 5;
  const requestedWorld = firstParam(resolvedSearchParams.world);

  // 콘텐츠 수직 슬라이스: 기본 세계 = 동물 마을("꾸미 곰의 날"). ?world=engine 로 기존 엔진 세션.
  const useVillage = requestedWorld !== 'engine';

  if (useVillage) {
    const villageSeed = stableSeed(`${selectedChild.id}:animal-village:home-play`);
    const plan = buildAnimalVillagePlan(villageSeed);
    // 동물 마을 영상은 아직 없으면 캐릭터 카드 도입으로 폴백(SessionShell 이 처리).
    const villageVideos = await loadLibraryVideos({
      requestedVideoId,
      topic: 'animal-village',
      ageBand,
      limit: 2,
    });

    return (
      <SessionShell
        key={`${selectedChild.id}:animal-village:${villageSeed}`}
        childId={selectedChild.id}
        childName={selectedChild.name || '아이'}
        context="home"
        rounds={plan.rounds}
        sessionSeed={villageSeed}
        topic="animal-village"
        videos={villageVideos}
        activities={plan.activities}
        villageSession={plan.session}
      />
    );
  }

  const sessionSeed = stableSeed(`${selectedChild.id}:${topic}:home-play`);
  const rounds = planSession({
    seed: sessionSeed,
    topic,
    round_count: ROUND_COUNT,
  });
  const videos = await loadLibraryVideos({
    requestedVideoId,
    topic,
    ageBand,
    limit: rounds.length + 1,
  });

  if (videos.length === 0) {
    return <EmptyLibraryState childId={selectedChild.id} topic={topic} />;
  }

  return (
    <SessionShell
      key={`${selectedChild.id}:${topic}:${sessionSeed}`}
      childId={selectedChild.id}
      childName={selectedChild.name || '아이'}
      context="home"
      rounds={rounds}
      sessionSeed={sessionSeed}
      topic={topic}
      videos={videos}
    />
  );
}
