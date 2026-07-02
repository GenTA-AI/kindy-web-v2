export interface InteractiveVideoClip {
  videoUrl: string;
  posterUrl?: string;
  subtitlesUrl?: string;
  startSec?: number;
  endSec?: number;
}

export interface Scene {
  id: string;
  videoClip: InteractiveVideoClip;
  next?: string;
  choice?: ChoicePoint;
}

export interface ChoicePoint {
  id: string;
  prompt_ko: string;
  format: 'emotion' | 'clue' | 'creative';
  options: ChoiceOption[];
  rejoin: string;
}

export interface ChoiceOption {
  id: string;
  label_ko: string;
  icon?: string;
  branchScenes?: string[];
  tally?: Record<string, number>;
  objective_code?: string;
}

export interface EndingRule {
  threshold: Record<string, number>;
  sceneId: string;
}

export interface InteractiveSessionGraph {
  startSceneId?: string;
  scenes: Scene[];
  endings: EndingRule[];
}
