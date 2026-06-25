// 커리큘럼 척추(syllabus spine) 타입.
// 0014_syllabus.sql 의 5개 테이블과 1:1 대응. 컬럼명은 DB 와 동일한 snake_case.

export type EnrollmentStatus = 'active' | 'paused' | 'completed';
export type LessonProgressStatus = 'locked' | 'available' | 'in_progress' | 'completed';

/** 커리큘럼 한 벌 (과목/연령). subject-agnostic — subject 는 자유 문자열 키. */
export interface Syllabus {
  id: string;
  subject: string;
  age_band: number;
  level_code: string;
  title: string;
  description: string | null;
  sort_order: number;
  published: boolean;
  created_at: string;
}

/** 단원. */
export interface SyllabusUnit {
  id: string;
  syllabus_id: string;
  title: string;
  description: string | null;
  objective: string | null;
  sort_order: number;
  created_at: string;
}

/** 차시/회차. library_video_id=null → 콘텐츠 준비중. */
export interface SyllabusLesson {
  id: string;
  unit_id: string;
  title: string;
  objective: string | null;
  sort_order: number;
  estimated_min: number;
  library_video_id: string | null;
  created_at: string;
}

/** 아이별 수강 등록. */
export interface SyllabusEnrollment {
  id: string;
  child_id: string;
  syllabus_id: string;
  cadence: EnrollmentCadence;
  status: EnrollmentStatus;
  started_at: string;
  created_at: string;
}

/** enrollments.cadence jsonb 의 형태. */
export interface EnrollmentCadence {
  lessons_per_week: number;
}

/** 아이별 차시 진도. quiz_score = 정답 개수 (null=미응시). */
export interface LessonProgress {
  id: string;
  child_id: string;
  lesson_id: string;
  status: LessonProgressStatus;
  video_watched: boolean;
  quiz_score: number | null;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// API 응답 합성 타입 — api-syllabus / ui-syllabus-dashboard 공용.
// ─────────────────────────────────────────────────────────────

/** 차시 + (있다면) 해당 아이의 진도. progress=null → 아직 진도 행 없음. */
export interface LessonWithProgress extends SyllabusLesson {
  progress: LessonProgress | null;
}

/** 단원 + 그 단원의 차시들(진도 포함). */
export interface UnitWithLessons extends SyllabusUnit {
  lessons: LessonWithProgress[];
}

/** GET /api/syllabus/[id] 의 응답: syllabus + 단원/차시/진도 트리 + 등록 정보. */
export interface SyllabusDetail extends Syllabus {
  units: UnitWithLessons[];
  enrollment: SyllabusEnrollment | null;
}
