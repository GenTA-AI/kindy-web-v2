import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import type {
  LessonProgress,
  LessonProgressStatus,
  SyllabusLesson,
  SyllabusUnit,
} from '@/types/syllabus';

const ALLOWED_ACTIONS = new Set(['video_watched', 'quiz_completed', 'complete']);

async function verifyChildOwner(parentId: string, childId: string) {
  const { data, error } = await getSupabase()
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

function flattenLessons(units: SyllabusUnit[], lessons: SyllabusLesson[]) {
  const lessonsByUnitId = new Map<string, SyllabusLesson[]>();
  for (const lesson of lessons) {
    const unitLessons = lessonsByUnitId.get(lesson.unit_id) ?? [];
    unitLessons.push(lesson);
    lessonsByUnitId.set(lesson.unit_id, unitLessons);
  }

  return [...units]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((unit) => {
      const unitLessons = lessonsByUnitId.get(unit.id) ?? [];
      return [...unitLessons].sort((a, b) => a.sort_order - b.sort_order);
    });
}

export async function POST(request: NextRequest) {
  try {
    const parentId = await getCurrentParentId();
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const { child_id, lesson_id, action, quiz_score } = body as {
      child_id?: unknown;
      lesson_id?: unknown;
      action?: unknown;
      quiz_score?: unknown;
    };

    if (
      typeof child_id !== 'string'
      || typeof lesson_id !== 'string'
      || typeof action !== 'string'
    ) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
    }
    if (action === 'quiz_completed' && typeof quiz_score !== 'number') {
      return NextResponse.json({ error: 'quiz_score required' }, { status: 400 });
    }
    if (
      quiz_score !== undefined
      && (typeof quiz_score !== 'number' || !Number.isFinite(quiz_score))
    ) {
      return NextResponse.json({ error: 'invalid_quiz_score' }, { status: 400 });
    }

    const owns = await verifyChildOwner(parentId, child_id);
    if (!owns) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const supabase = getSupabase();
    const { data: lesson, error: lessonError } = await supabase
      .from('syllabus_lessons')
      .select('id, unit_id')
      .eq('id', lesson_id)
      .maybeSingle();

    if (lessonError) {
      return NextResponse.json({ error: lessonError.message }, { status: 500 });
    }
    if (!lesson) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const { data: unit, error: unitError } = await supabase
      .from('syllabus_units')
      .select('id, syllabus_id')
      .eq('id', lesson.unit_id)
      .maybeSingle();

    if (unitError) {
      return NextResponse.json({ error: unitError.message }, { status: 500 });
    }
    if (!unit) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const { data: syllabus, error: syllabusError } = await supabase
      .from('syllabuses')
      .select('id')
      .eq('id', unit.syllabus_id)
      .eq('published', true)
      .maybeSingle();

    if (syllabusError) {
      return NextResponse.json({ error: syllabusError.message }, { status: 500 });
    }
    if (!syllabus) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const { data: existingProgress, error: existingProgressError } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('child_id', child_id)
      .eq('lesson_id', lesson_id)
      .maybeSingle();

    if (existingProgressError) {
      return NextResponse.json({ error: existingProgressError.message }, { status: 500 });
    }

    const now = new Date().toISOString();
    const currentStatus = ((existingProgress as LessonProgress | null)?.status ?? 'available');
    const progressUpsert: {
      child_id: string;
      lesson_id: string;
      status?: LessonProgressStatus;
      video_watched?: boolean;
      quiz_score?: number;
      completed_at?: string;
      updated_at: string;
    } = {
      child_id,
      lesson_id,
      updated_at: now,
    };

    if (action === 'video_watched') {
      progressUpsert.video_watched = true;
      progressUpsert.status = currentStatus === 'locked' || currentStatus === 'available'
        ? 'in_progress'
        : currentStatus;
    }

    if (action === 'quiz_completed') {
      progressUpsert.quiz_score = quiz_score;
      progressUpsert.status = 'in_progress';
    }

    if (action === 'complete') {
      progressUpsert.status = 'completed';
      progressUpsert.completed_at = now;
      progressUpsert.video_watched = true;
      if (typeof quiz_score === 'number') {
        progressUpsert.quiz_score = quiz_score;
      }
    }

    const { data: progress, error: progressError } = await supabase
      .from('lesson_progress')
      .upsert(progressUpsert, { onConflict: 'child_id,lesson_id' })
      .select()
      .single();

    if (progressError) {
      return NextResponse.json({ error: progressError.message }, { status: 500 });
    }

    let unlockedLessonId: string | null = null;

    if (action === 'complete') {
      const { data: unitsData, error: unitsError } = await supabase
        .from('syllabus_units')
        .select('*')
        .eq('syllabus_id', syllabus.id)
        .order('sort_order');

      if (unitsError) {
        return NextResponse.json({ error: unitsError.message }, { status: 500 });
      }

      const units = (unitsData ?? []) as SyllabusUnit[];
      const unitIds = units.map((syllabusUnit) => syllabusUnit.id);
      let lessons: SyllabusLesson[] = [];

      if (unitIds.length > 0) {
        const { data: lessonsData, error: lessonsError } = await supabase
          .from('syllabus_lessons')
          .select('*')
          .in('unit_id', unitIds)
          .order('sort_order');

        if (lessonsError) {
          return NextResponse.json({ error: lessonsError.message }, { status: 500 });
        }
        lessons = (lessonsData ?? []) as SyllabusLesson[];
      }

      const flatLessons = flattenLessons(units, lessons);
      const completedLessonIndex = flatLessons.findIndex((flatLesson) => flatLesson.id === lesson_id);
      const nextLesson = completedLessonIndex >= 0 ? flatLessons[completedLessonIndex + 1] : null;

      if (nextLesson) {
        const { data: nextProgress, error: nextProgressError } = await supabase
          .from('lesson_progress')
          .select('id')
          .eq('child_id', child_id)
          .eq('lesson_id', nextLesson.id)
          .maybeSingle();

        if (nextProgressError) {
          return NextResponse.json({ error: nextProgressError.message }, { status: 500 });
        }

        unlockedLessonId = nextLesson.id;

        if (!nextProgress) {
          const { error: unlockError } = await supabase
            .from('lesson_progress')
            .upsert(
              {
                child_id,
                lesson_id: nextLesson.id,
                status: 'available',
              },
              { onConflict: 'child_id,lesson_id', ignoreDuplicates: true },
            );

          if (unlockError) {
            return NextResponse.json({ error: unlockError.message }, { status: 500 });
          }
        }
      }
    }

    return NextResponse.json({
      progress: progress as LessonProgress,
      unlockedLessonId,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw error;
  }
}
