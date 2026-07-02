import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MoriCharacter from '@/components/MoriCharacter';
import FirstJourneyShell from '@/components/game/FirstJourneyShell';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { LOCAL_PREVIEW_CHILD_COOKIE, parseLocalPreviewChildCookie } from '@/lib/local-preview-child';
import { getSupabase, isSupabaseServiceConfigured } from '@/lib/supabase';
import type { Child } from '@/types';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type FirstJourneyPageProps = {
  searchParams: Promise<SearchParams>;
};
type ChildContext = Pick<Child, 'id' | 'name' | 'age' | 'topics'>;

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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

function EmptyChildrenState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <section className="max-w-md rounded-3xl border border-line bg-white p-6 text-center shadow-sm">
        <MoriCharacter className="mx-auto h-28 w-28 overflow-hidden rounded-full border border-line bg-white" imageClassName="scale-125" label="모리" withGlow={false} />
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-sage">모리의 이야기 숲</p>
        <h1 className="mt-2 text-2xl font-black text-ink">첫 이름표가 필요해요</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-ink2">
          숲길을 열려면 아이 이름표를 먼저 만들어주세요.
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

export default async function FirstJourneyPage({ searchParams }: FirstJourneyPageProps) {
  let parentId: string;

  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) {
      redirect('/auth/login?next=/play/first-journey');
    }
    throw error;
  }

  const resolvedSearchParams = await searchParams;
  const requestedChildId = firstParam(resolvedSearchParams.childId);
  const children = await loadChildren(parentId);
  const selectedChild = requestedChildId
    ? children.find((child) => child.id === requestedChildId) ?? children[0] ?? null
    : children[0] ?? null;

  if (!selectedChild) {
    return <EmptyChildrenState />;
  }

  return (
    <FirstJourneyShell
      childId={selectedChild.id}
      childName={selectedChild.name || '아이'}
    />
  );
}
