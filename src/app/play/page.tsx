import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MoriCharacter from '@/components/MoriCharacter';
import SessionShell from '@/components/game/SessionShell';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { planSession } from '@/lib/game/engine';
import { buildAnimalVillagePlan } from '@/lib/game/village-session';
import { getSupabase, isSupabaseServiceConfigured } from '@/lib/supabase';
import { FREE_TRIAL_SESSION_LIMIT, getMembershipGateState } from '@/lib/subscription';
import { localPreviewLibraryVideoForAge } from '@/lib/library-preview';
import { LOCAL_PREVIEW_CHILD_COOKIE, parseLocalPreviewChildCookie } from '@/lib/local-preview-child';
import { topicLabel } from '@/lib/topic-label';
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
  if (!isSupabaseServiceConfigured()) {
    const cookieStore = await cookies();
    const child = parseLocalPreviewChildCookie(cookieStore.get(LOCAL_PREVIEW_CHILD_COOKIE)?.value);
    return [{ id: child.id, name: child.name, age: child.age, topics: child.topics }];
  }

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
  if (!isSupabaseServiceConfigured()) return [localPreviewLibraryVideoForAge(input.ageBand)];

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
  if (!isSupabaseServiceConfigured()) return [localPreviewLibraryVideoForAge(input.ageBand)].slice(0, input.limit);

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
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <section className="max-w-md rounded-3xl border border-line bg-white p-6 text-center shadow-sm">
        <MoriCharacter className="mx-auto h-28 w-28 overflow-hidden rounded-full border border-line bg-white" imageClassName="scale-125" label="모리" withGlow={false} />
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-sage">모리의 이야기 숲</p>
        <h1 className="mt-2 text-2xl font-black text-ink">첫 이름표가 필요해요</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-ink2">
          아이에게 맞춘 영상과 보호자 기록을 남기려면 프로필을 먼저 만들어주세요.
        </p>
        <Link
          href="/onboarding"
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-saged px-6 text-sm font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink"
        >
          이름표 만들기
        </Link>
      </section>
    </main>
  );
}

function EmptyLibraryState({ childId, topic }: { childId: string; topic: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <section className="max-w-md rounded-3xl border border-line bg-white p-6 text-center shadow-sm">
        <MoriCharacter className="mx-auto h-28 w-28 overflow-hidden rounded-full border border-line bg-white" imageClassName="scale-125" label="모리" withGlow={false} />
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-sage">이야기 준비 중</p>
        <h1 className="mt-2 text-2xl font-black text-ink">이야기 문을 고르고 있어요</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-ink2">
          {topicLabel(topic)} 영상이 준비되면 바로 이어서 열 수 있어요.
        </p>
        <Link
          href={`/library?childId=${encodeURIComponent(childId)}`}
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-saged px-6 text-sm font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink"
        >
          이야기 숲 보기
        </Link>
      </section>
    </main>
  );
}

function TrialCompleteState({
  childId,
  childName,
  completedTrialSessions,
}: {
  childId: string;
  childName: string;
  completedTrialSessions: number;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6 py-10 text-ink">
      <section className="w-full max-w-md rounded-[28px] border border-line bg-white p-6 text-center shadow-sm">
        <MoriCharacter className="mx-auto h-28 w-28 overflow-hidden rounded-full border border-line bg-cream" imageClassName="scale-125" label="모리" withGlow={false} />
        <p className="mt-5 text-[11px] font-black uppercase tracking-[.16em] text-sage">
          모리 체험 완료
        </p>
        <h1 className="mt-2 text-2xl font-black leading-snug text-ink">
          {childName}의 기록을
          <br />
          먼저 확인해요
        </h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
          모리와 {Math.max(completedTrialSessions, FREE_TRIAL_SESSION_LIMIT)}편을 끝냈어요. 보호자 화면에서 잘 맞았던 놀이와
          다음에 해볼 활동을 보고, 이어갈 이야기를 고를 수 있어요.
        </p>
        <div className="mt-5 grid gap-2">
          <Link
            href={`/dashboard/report?childId=${encodeURIComponent(childId)}`}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-saged px-5 text-sm font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
          >
            오늘 기록 보기
          </Link>
          <Link
            href="/subscribe"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-cream px-5 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98]"
          >
            모리 더 이어가기
          </Link>
        </div>
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

  if (isSupabaseServiceConfigured()) {
    const gateState = await getMembershipGateState(parentId);

    if (!gateState.canUseMemberContent) {
      return (
        <TrialCompleteState
          childId={selectedChild.id}
          childName={selectedChild.name || '아이'}
          completedTrialSessions={gateState.completedTrialSessions}
        />
      );
    }
  }

  const childTopics = Array.isArray(selectedChild.topics) ? selectedChild.topics : [];
  const topic = cleanToken(requestedTopic, cleanToken(childTopics[0] ?? null, DEFAULT_TOPIC));
  const ageBand = Number.isFinite(selectedChild.age) ? selectedChild.age : 5;
  const requestedWorld = firstParam(resolvedSearchParams.world);

  // 콘텐츠 수직 슬라이스: 기본 세계 = 동물 마을("사라진 반짝빛"). ?world=engine 로 기존 엔진 세션.
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
