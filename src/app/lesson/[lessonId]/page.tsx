import { notFound, redirect } from 'next/navigation';
import DocentLessonPlayer from '@/components/lesson/DocentLessonPlayer';
import { LESSONS } from '@/content/lessons/seurat-01';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getMembershipGateState } from '@/lib/subscription';
import { getSignedUrl } from '@/lib/supabase-storage';

export const dynamic = 'force-dynamic';

/**
 * /lesson/[lessonId] — 카톡으로 발송되는 수업 링크 (docs/plan/09 §2).
 * 엄마 폰(카카오 로그인 세션)에서 열리는 전제: 로그인 → 자녀 확인 → 멤버십 게이트(무료체험 포함)
 * → 아이 모드 수업. 완료 이벤트는 기존 파이프라인으로 흘러 리포트 타임라인에 쌓인다.
 */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const lesson = LESSONS[lessonId];
  if (!lesson) notFound();

  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) {
      redirect(`/auth/login?next=/lesson/${encodeURIComponent(lessonId)}`);
    }
    throw error;
  }

  const { data: children } = await supabase
    .from('children')
    .select('id')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })
    .limit(1);
  const childId = children?.[0]?.id;
  if (!childId) {
    redirect(`/onboarding?next=/lesson/${encodeURIComponent(lessonId)}`);
  }

  const gate = await getMembershipGateState(parentId);
  if (!gate.canUseMemberContent) {
    redirect('/subscribe');
  }

  const videoUrl = await getSignedUrl(lesson.videoPath, 60 * 60 * 6);

  return <DocentLessonPlayer lesson={lesson} videoUrl={videoUrl} childId={childId} />;
}
