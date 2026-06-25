// npx tsx --env-file=.env.local scripts/seed-syllabus.ts
// dev/staging 전용. idempotent: 기존 korean_reading syllabus + 하위 units/lessons 를
// 지우고 다시 삽입한다 (FK cascade). prod 에서 진도 데이터가 있는 syllabus 재시드 금지.

import { getSupabase } from '../src/lib/supabase';
import {
  KOREAN_PRESCHOOL_SYLLABUS,
  type SeedLesson,
} from '../src/data/syllabus-korean-preschool';

interface LibraryVideoLookup {
  id: string;
  title: string;
  topic: string;
  age_band: number;
}

function fail(message: string, error: unknown): never {
  console.error(message, error);
  process.exit(1);
}

function uniqueVideoTopics(lessons: SeedLesson[]): string[] {
  const topics = new Set<string>();

  for (const lesson of lessons) {
    if (lesson.videoMatch) {
      topics.add(lesson.videoMatch.topic);
    }
  }

  return [...topics];
}

function resolveLibraryVideoId(
  lesson: SeedLesson,
  libraryVideos: LibraryVideoLookup[],
): string | null {
  const match = lesson.videoMatch;

  if (!match) {
    console.log(`[준비중] ${lesson.title}`);
    return null;
  }

  const candidates = libraryVideos.filter(
    (video) => video.topic === match.topic && video.age_band === match.age_band,
  );
  const normalizedTitleLike = match.titleLike?.toLocaleLowerCase('ko-KR');
  const video = normalizedTitleLike
    ? candidates.find((candidate) =>
        candidate.title.toLocaleLowerCase('ko-KR').includes(normalizedTitleLike),
      )
    : candidates[0];

  if (!video) {
    const hint = [match.topic, `${match.age_band}세`, match.titleLike]
      .filter(Boolean)
      .join(' / ');
    console.log(`[준비중] ${lesson.title} (영상 매칭 실패: ${hint})`);
    return null;
  }

  return video.id;
}

async function main() {
  const supabase = getSupabase();
  const syllabus = KOREAN_PRESCHOOL_SYLLABUS;
  const lessons = syllabus.units.flatMap((unit) => unit.lessons);
  const videoTopics = uniqueVideoTopics(lessons);

  const { data: libraryVideos, error: libraryVideosError } = await supabase
    .from('library_videos')
    .select('id, title, topic, age_band')
    .eq('published', true)
    .in('topic', videoTopics);

  if (libraryVideosError) {
    fail('Failed to fetch published library videos', libraryVideosError);
  }

  const videoLookup = (libraryVideos ?? []) as LibraryVideoLookup[];
  const lessonRowsByUnit = syllabus.units.map((unit) =>
    unit.lessons.map((lesson) => ({
      title: lesson.title,
      objective: lesson.objective,
      sort_order: lesson.sort_order,
      estimated_min: lesson.estimated_min,
      library_video_id: resolveLibraryVideoId(lesson, videoLookup),
    })),
  );
  const mappedLessonCount = lessonRowsByUnit
    .flat()
    .filter((lesson) => lesson.library_video_id !== null).length;

  const { data: existingSyllabuses, error: existingSyllabusesError } = await supabase
    .from('syllabuses')
    .select('id')
    .eq('subject', syllabus.subject);

  if (existingSyllabusesError) {
    fail('Failed to fetch existing korean_reading syllabuses', existingSyllabusesError);
  }

  if (existingSyllabuses && existingSyllabuses.length > 0) {
    console.warn(
      `기존 syllabus ${existingSyllabuses.length}개 삭제 — 연결된 아이 진도도 cascade 삭제됨`,
    );

    const { error: deleteError } = await supabase
      .from('syllabuses')
      .delete()
      .eq('subject', syllabus.subject);

    if (deleteError) {
      fail('Failed to delete existing korean_reading syllabuses', deleteError);
    }
  }

  const { data: insertedSyllabus, error: syllabusInsertError } = await supabase
    .from('syllabuses')
    .insert({
      subject: syllabus.subject,
      age_band: syllabus.age_band,
      level_code: syllabus.level_code,
      title: syllabus.title,
      description: syllabus.description,
      sort_order: 0,
      published: true,
    })
    .select('id')
    .single();

  if (syllabusInsertError || !insertedSyllabus) {
    fail('Failed to insert syllabus', syllabusInsertError);
  }

  const syllabusId = insertedSyllabus.id as string;

  for (const [unitIndex, unit] of syllabus.units.entries()) {
    const { data: insertedUnit, error: unitInsertError } = await supabase
      .from('syllabus_units')
      .insert({
        syllabus_id: syllabusId,
        title: unit.title,
        description: unit.description,
        objective: unit.objective,
        sort_order: unitIndex,
      })
      .select('id')
      .single();

    if (unitInsertError || !insertedUnit) {
      fail(`Failed to insert unit: ${unit.title}`, unitInsertError);
    }

    const unitId = insertedUnit.id as string;
    const lessonRows = lessonRowsByUnit[unitIndex].map((lesson) => ({
      ...lesson,
      unit_id: unitId,
    }));
    const { error: lessonInsertError } = await supabase
      .from('syllabus_lessons')
      .insert(lessonRows);

    if (lessonInsertError) {
      fail(`Failed to insert lessons for unit: ${unit.title}`, lessonInsertError);
    }
  }

  const pendingLessonCount = lessons.length - mappedLessonCount;
  console.log(
    `Seeded syllabus: ${syllabus.units.length} units, ${lessons.length} lessons, ` +
      `${mappedLessonCount} lessons mapped to videos, ${pendingLessonCount} 준비중`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
