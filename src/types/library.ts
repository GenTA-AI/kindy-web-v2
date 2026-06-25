export interface LibraryVideoScene {
  type: 'narration' | 'character_speaking';
  start_sec: number;
  end_sec: number;
  narration_text?: string;
  dialogue_text?: string;
  lipsync_required: boolean;
}

export interface LibraryVideo {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  age_band: number;
  style_tags: string[];
  duration_sec: number;
  video_url: string;
  thumbnail_url: string | null;
  subtitles_url?: string | null;
  script?: unknown | null;
  scenes?: LibraryVideoScene[] | null;
  episode_unit_sec?: number | null;
  character_name: string;
  view_count: number;
  published: boolean;
  featured: boolean;
  created_at: string;
}

export interface LibraryFilters {
  topic?: string;
  age_band?: number;
  style_tag?: string;
  featured_only?: boolean;
}
