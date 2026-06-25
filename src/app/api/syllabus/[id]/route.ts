import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import type {
  LessonProgress,
  LessonProgressStatus,
  LessonWithProgress,
  Syllabus,
  SyllabusDetail,
  SyllabusEnrollment,
  SyllabusLesson,
  SyllabusUnit,
  UnitWithLessons,
} from '@/types/syllabus';

type LessonWithDerivedStatus = LessonWithProgress & {
  derived_status: LessonProgressStatus;
};

type UnitWithDerivedLessons = Omit<UnitWithLessons, 'lessons'> & {
  lessons: LessonWithDerivedStatus[];
};

type SyllabusDetailWithDerivedStatus = Omit<SyllabusDetail, 'units'> & {
  units: UnitWithDerivedLessons[];
};

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parentId = await getCurrentParentId();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');

    if (!childId) {
      return NextResponse.json({ error: 'childId required' }, { status: 400 });
    }

    const owns = await verifyChildOwner(parentId, childId);
    if (!owns) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const supabase = getSupabase();
    const { data: syllabus, error: syllabusError } = await supabase
      .from('syllabuses')
      .select('*')
      .eq('id', id)
      .eq('published', true)
      .maybeSingle();

    if (syllabusError) {
      return NextResponse.json({ error: syllabusError.message }, { status: 500 });
    }
    if (!syllabus) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const { data: unitsData, error: unitsError } = await supabase
      .from('syllabus_units')
      .select('*')
      .eq('syllabus_id', id)
      .order('sort_order');

    if (unitsError) {
      return NextResponse.json({ error: unitsError.message }, { status: 500 });
    }

    const units = (unitsData ?? []) as SyllabusUnit[];
    const unitIds = units.map((unit) => unit.id);
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

    const lessonIds = lessons.map((lesson) => lesson.id);
    let progressRows: LessonProgress[] = [];

    if (lessonIds.length > 0) {
      const { data: progressData, error: progressError } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('child_id', childId)
        .in('lesson_id', lessonIds);

      if (progressError) {
        return NextResponse.json({ error: progressError.message }, { status: 500 });
      }
      progressRows = (progressData ?? []) as LessonProgress[];
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('syllabus_enrollments')
      .select('*')
      .eq('child_id', childId)
      .eq('syllabus_id', id)
      .maybeSingle();

    if (enrollmentError) {
      return NextResponse.json({ error: enrollmentError.message }, { status: 500 });
    }

    const progressByLessonId = new Map(progressRows.map((progress) => [progress.lesson_id, progress]));
    const flatLessons = flattenLessons(units, lessons);
    const derivedStatusByLessonId = new Map<string, LessonProgressStatus>();

    flatLessons.forEach((lesson, index) => {
      const progress = progressByLessonId.get(lesson.id);
      if (progress) {
        derivedStatusByLessonId.set(lesson.id, progress.status);
        return;
      }

      const previousLesson = flatLessons[index - 1];
      const previousProgress = previousLesson ? progressByLessonId.get(previousLesson.id) : null;
      const derivedStatus = index === 0 || previousProgress?.status === 'completed'
        ? 'available'
        : 'locked';

      derivedStatusByLessonId.set(lesson.id, derivedStatus);
    });

    const lessonsByUnitId = new Map<string, SyllabusLesson[]>();
    for (const lesson of lessons) {
      const unitLessons = lessonsByUnitId.get(lesson.unit_id) ?? [];
      unitLessons.push(lesson);
      lessonsByUnitId.set(lesson.unit_id, unitLessons);
    }

    const unitsWithLessons: UnitWithDerivedLessons[] = units.map((unit) => {
      const unitLessons = (lessonsByUnitId.get(unit.id) ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((lesson) => ({
          ...lesson,
          progress: progressByLessonId.get(lesson.id) ?? null,
          derived_status: derivedStatusByLessonId.get(lesson.id) ?? 'locked',
        }));

      return {
        ...unit,
        lessons: unitLessons,
      };
    });

    const syllabusDetail: SyllabusDetailWithDerivedStatus = {
      ...((syllabus as Syllabus)),
      units: unitsWithLessons,
      enrollment: (enrollment as SyllabusEnrollment | null) ?? null,
    };

    return NextResponse.json({ syllabus: syllabusDetail });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw error;
  }
}
