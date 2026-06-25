import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import type {
  EnrollmentCadence,
  SyllabusEnrollment,
  SyllabusLesson,
  SyllabusUnit,
} from '@/types/syllabus';

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

    const { child_id, syllabus_id, lessons_per_week } = body as {
      child_id?: unknown;
      syllabus_id?: unknown;
      lessons_per_week?: unknown;
    };

    if (typeof child_id !== 'string' || typeof syllabus_id !== 'string') {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    if (
      lessons_per_week !== undefined
      && (typeof lessons_per_week !== 'number' || !Number.isFinite(lessons_per_week))
    ) {
      return NextResponse.json({ error: 'invalid_lessons_per_week' }, { status: 400 });
    }

    const owns = await verifyChildOwner(parentId, child_id);
    if (!owns) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const supabase = getSupabase();
    const { data: syllabus, error: syllabusError } = await supabase
      .from('syllabuses')
      .select('id')
      .eq('id', syllabus_id)
      .eq('published', true)
      .maybeSingle();

    if (syllabusError) {
      return NextResponse.json({ error: syllabusError.message }, { status: 500 });
    }
    if (!syllabus) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const cadence: EnrollmentCadence = {
      lessons_per_week: lessons_per_week ?? 5,
    };

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('syllabus_enrollments')
      .upsert(
        {
          child_id,
          syllabus_id,
          cadence,
        },
        { onConflict: 'child_id,syllabus_id', ignoreDuplicates: false },
      )
      .select()
      .single();

    if (enrollmentError) {
      return NextResponse.json({ error: enrollmentError.message }, { status: 500 });
    }

    const { data: unitsData, error: unitsError } = await supabase
      .from('syllabus_units')
      .select('*')
      .eq('syllabus_id', syllabus_id)
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

    const firstLesson = flattenLessons(units, lessons)[0];
    if (firstLesson) {
      const { error: progressError } = await supabase
        .from('lesson_progress')
        .upsert(
          {
            child_id,
            lesson_id: firstLesson.id,
            status: 'available',
          },
          { onConflict: 'child_id,lesson_id', ignoreDuplicates: true },
        );

      if (progressError) {
        return NextResponse.json({ error: progressError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ enrollment: enrollment as SyllabusEnrollment });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw error;
  }
}
