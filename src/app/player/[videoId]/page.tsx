import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function LegacyPlayerRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const childId = firstParam((await searchParams).childId);
  redirect(childId ? `/library?childId=${encodeURIComponent(childId)}` : '/dashboard');
}
