export type CompanionState = {
  id: string;
  named_by_child: string;
};

export type CharacterMet = {
  id: string;
  relation: string;
  ep: number;
  choice_node: string;
};

export type ItemInvented = {
  id: string;
  name: string;
  ep: number;
  asset_ref: string | null;
};

export type OpenThread = {
  id: string;
  desc: string;
  opened_ep: number;
  resolve_by_ep: number;
};

export type MoodPref = {
  gacs: [number, number, number, number];
};

export type WorldState = {
  version: number;
  digest: string;
  companion: CompanionState | null;
  characters_met: CharacterMet[];
  items_invented: ItemInvented[];
  places_visited: string[];
  open_threads: OpenThread[];
  mood_pref: MoodPref;
  safety_flags: string[];
};

export type StoryChoicePayload = {
  node?: string;
  choice?: string;
  prosocial?: string;
  character_id?: string;
  characterId?: string;
  default_path?: boolean;
  timeout_default?: boolean;
  no_response?: boolean;
  open_thread?: Partial<OpenThread>;
};

export type ExpressionSavedPayload = {
  template_id?: string;
  templateId?: string;
  item_id?: string;
  itemId?: string;
  name?: string;
  asset_ref?: string | null;
  assetRef?: string | null;
};

export type EpisodeCompletedPayload = {
  place_id?: string;
  placeId?: string;
  place?: string;
};

export type WorldStateEvent = {
  id?: string;
  child_id?: string;
  event_type: 'story_choice' | 'expression_saved' | 'episode_completed' | string;
  ep?: number;
  episode?: number;
  response_payload?: StoryChoicePayload | ExpressionSavedPayload | EpisodeCompletedPayload | null;
  created_at?: string;
};

export type ContinuityScript = {
  ep?: number;
  companion_name?: string;
  companion?: Partial<CompanionState> | null;
  characters?: Array<{
    id: string;
    relation?: string;
    status?: string;
  }>;
  item_mentions?: Array<{
    id: string;
    denies_existence?: boolean;
    appears?: boolean;
  }>;
  place_mentions?: Array<{
    id: string;
    revisit?: boolean;
  }>;
  resolved_thread_ids?: string[];
};

export type ContinuityRejectionCode =
  | 'relation_conflict'
  | 'open_thread_overdue'
  | 'item_existence_denied'
  | 'place_revisit_without_visit'
  | 'companion_name_mismatch';

export type ContinuityRejection = {
  code: ContinuityRejectionCode;
  id: string;
  message: string;
};

export type WorldProjectorEventRow = WorldStateEvent & {
  id: string;
  child_id: string;
};

export type ProjectWorldStateBatchInput = {
  limit?: number;
  now?: string;
  loadUnprocessedEvents: (limit: number) => Promise<WorldProjectorEventRow[]>;
  claimEvent: (eventId: string, now: string) => Promise<boolean>;
  loadLatestState: (childId: string) => Promise<WorldState | null>;
  insertWorldState: (childId: string, state: WorldState) => Promise<void>;
};

export type ProjectWorldStateBatchResult = {
  claimed: number;
  inserted: number;
};

export const NEUTRAL_WORLD_STATE_DIGEST = 'Neutral continuity brief: no recurring world_state elements.';

export const EMPTY_WORLD_STATE: WorldState = {
  version: 1,
  digest: NEUTRAL_WORLD_STATE_DIGEST,
  companion: null,
  characters_met: [],
  items_invented: [],
  places_visited: [],
  open_threads: [],
  mood_pref: { gacs: [0, 0, 0, 0] },
  safety_flags: [],
};

function cloneWorldState(state: WorldState): WorldState {
  return {
    version: state.version,
    digest: state.digest,
    companion: state.companion ? { ...state.companion } : null,
    characters_met: state.characters_met.map((character) => ({ ...character })),
    items_invented: state.items_invented.map((item) => ({ ...item })),
    places_visited: [...state.places_visited],
    open_threads: state.open_threads.map((thread) => ({ ...thread })),
    mood_pref: { gacs: [...state.mood_pref.gacs] },
    safety_flags: [...state.safety_flags],
  };
}

function eventEpisode(event: WorldStateEvent): number {
  return event.ep ?? event.episode ?? 0;
}

function isDefaultPath(payload: StoryChoicePayload): boolean {
  return Boolean(payload.default_path || payload.timeout_default || payload.no_response);
}

function storyChoicePayload(event: WorldStateEvent): StoryChoicePayload {
  return (event.response_payload ?? {}) as StoryChoicePayload;
}

function expressionSavedPayload(event: WorldStateEvent): ExpressionSavedPayload {
  return (event.response_payload ?? {}) as ExpressionSavedPayload;
}

function episodeCompletedPayload(event: WorldStateEvent): EpisodeCompletedPayload {
  return (event.response_payload ?? {}) as EpisodeCompletedPayload;
}

function hasCharacterMet(state: WorldState, next: CharacterMet): boolean {
  return state.characters_met.some((character) => (
    character.id === next.id
    && character.ep === next.ep
    && character.choice_node === next.choice_node
  ));
}

function hasItemInvented(state: WorldState, next: ItemInvented): boolean {
  return state.items_invented.some((item) => item.id === next.id);
}

function hasOpenThread(state: WorldState, next: OpenThread): boolean {
  return state.open_threads.some((thread) => thread.id === next.id);
}

function normalizeOpenThread(payload: StoryChoicePayload, characterId: string, ep: number): OpenThread {
  const openThread = payload.open_thread ?? {};
  const node = payload.node ?? 'unknown';

  return {
    id: openThread.id ?? `help_${characterId}_${ep}_${node}`,
    desc: openThread.desc ?? `Follow up with ${characterId}`,
    opened_ep: openThread.opened_ep ?? ep,
    // TODO: replace this fallback when the HERO §2 open_thread creation rule table is available.
    resolve_by_ep: openThread.resolve_by_ep ?? ep + 6,
  };
}

function applyStoryChoice(state: WorldState, event: WorldStateEvent): void {
  const payload = storyChoicePayload(event);
  if (isDefaultPath(payload) || payload.prosocial !== 'help') return;

  const characterId = payload.character_id ?? payload.characterId;
  if (!characterId) return;

  const ep = eventEpisode(event);
  const character: CharacterMet = {
    id: characterId,
    relation: 'helped',
    ep,
    choice_node: payload.node ?? '',
  };
  const openThread = normalizeOpenThread(payload, characterId, ep);

  if (!hasCharacterMet(state, character)) {
    state.characters_met.push(character);
  }
  if (!hasOpenThread(state, openThread)) {
    state.open_threads.push(openThread);
  }
}

function applyExpressionSaved(state: WorldState, event: WorldStateEvent): void {
  const payload = expressionSavedPayload(event);
  const templateId = payload.template_id ?? payload.templateId;
  if (templateId !== 'T7') return;

  const itemId = payload.item_id ?? payload.itemId;
  if (!itemId || !payload.name) return;

  const item: ItemInvented = {
    id: itemId,
    name: payload.name,
    ep: eventEpisode(event),
    asset_ref: payload.asset_ref ?? payload.assetRef ?? null,
  };

  if (!hasItemInvented(state, item)) {
    state.items_invented.push(item);
  }
}

function applyEpisodeCompleted(state: WorldState, event: WorldStateEvent): void {
  const payload = episodeCompletedPayload(event);
  const place = payload.place_id ?? payload.placeId ?? payload.place;

  if (place && !state.places_visited.includes(place)) {
    state.places_visited.push(place);
  }

  state.version += 1;
}

export function buildWorldStateDigest(state: WorldState): string {
  const parts = [
    state.companion ? `companion=${state.companion.named_by_child}` : null,
    state.characters_met.length > 0
      ? `characters=${state.characters_met.map((character) => `${character.id}:${character.relation}`).join(',')}`
      : null,
    state.items_invented.length > 0
      ? `items=${state.items_invented.map((item) => item.name).join(',')}`
      : null,
    state.places_visited.length > 0 ? `places=${state.places_visited.join(',')}` : null,
    state.open_threads.length > 0
      ? `open_threads=${state.open_threads.map((thread) => `${thread.id}@${thread.resolve_by_ep}`).join(',')}`
      : null,
  ].filter((part): part is string => Boolean(part));

  const digest = parts.length > 0 ? parts.join(' | ') : NEUTRAL_WORLD_STATE_DIGEST;
  return digest.length <= 500 ? digest : digest.slice(0, 500);
}

export function foldWorldState(events: WorldStateEvent[], prev: WorldState | null = null): WorldState {
  const next = cloneWorldState(prev ?? EMPTY_WORLD_STATE);

  for (const event of events) {
    if (event.event_type === 'story_choice') {
      applyStoryChoice(next, event);
    } else if (event.event_type === 'expression_saved') {
      applyExpressionSaved(next, event);
    } else if (event.event_type === 'episode_completed') {
      applyEpisodeCompleted(next, event);
    }
  }

  next.digest = buildWorldStateDigest(next);
  return next;
}

export function neutralizeWorldStateForContinuity(prev: WorldState | null = null): WorldState {
  return {
    ...cloneWorldState(EMPTY_WORLD_STATE),
    version: prev?.version ?? EMPTY_WORLD_STATE.version,
    digest: NEUTRAL_WORLD_STATE_DIGEST,
  };
}

function hostileRelation(relation: string | undefined): boolean {
  return relation === 'hostile' || relation === 'enemy' || relation === 'adversarial';
}

function reject(
  rejections: ContinuityRejection[],
  code: ContinuityRejectionCode,
  id: string,
  message: string,
): void {
  rejections.push({ code, id, message });
}

export function checkContinuity(
  script: ContinuityScript,
  worldState: WorldState | null,
): ContinuityRejection[] {
  const state = worldState ?? neutralizeWorldStateForContinuity();
  const rejections: ContinuityRejection[] = [];
  const helpedCharacters = new Set(
    state.characters_met
      .filter((character) => character.relation === 'helped')
      .map((character) => character.id),
  );

  for (const character of script.characters ?? []) {
    if (helpedCharacters.has(character.id) && hostileRelation(character.relation)) {
      reject(
        rejections,
        'relation_conflict',
        character.id,
        'helped character cannot reappear as hostile',
      );
    }
  }

  const resolvedThreadIds = new Set(script.resolved_thread_ids ?? []);
  const scriptEp = script.ep ?? 0;
  for (const thread of state.open_threads) {
    if (scriptEp > thread.resolve_by_ep && !resolvedThreadIds.has(thread.id)) {
      reject(rejections, 'open_thread_overdue', thread.id, 'open_thread deadline passed without resolution');
    }
  }

  const inventedItemIds = new Set(state.items_invented.map((item) => item.id));
  for (const mention of script.item_mentions ?? []) {
    if (mention.denies_existence && inventedItemIds.has(mention.id)) {
      reject(rejections, 'item_existence_denied', mention.id, 'invented item existence is denied');
    }
  }

  const visitedPlaces = new Set(state.places_visited);
  for (const place of script.place_mentions ?? []) {
    if (place.revisit && !visitedPlaces.has(place.id)) {
      reject(rejections, 'place_revisit_without_visit', place.id, 'unvisited place is described as a revisit');
    }
  }

  const companionName = script.companion_name ?? script.companion?.named_by_child;
  if (state.companion && companionName && companionName !== state.companion.named_by_child) {
    reject(rejections, 'companion_name_mismatch', state.companion.id, 'companion name differs from world_state');
  }

  return rejections;
}

export async function projectWorldStateBatch(
  input: ProjectWorldStateBatchInput,
): Promise<ProjectWorldStateBatchResult> {
  const limit = input.limit ?? 100;
  const now = input.now ?? new Date().toISOString();
  const events = await input.loadUnprocessedEvents(limit);
  const claimedByChild = new Map<string, WorldProjectorEventRow[]>();
  let claimed = 0;

  for (const event of events) {
    const didClaim = await input.claimEvent(event.id, now);
    if (!didClaim) continue;

    claimed += 1;
    const childEvents = claimedByChild.get(event.child_id) ?? [];
    childEvents.push(event);
    claimedByChild.set(event.child_id, childEvents);
  }

  let inserted = 0;
  for (const [childId, childEvents] of claimedByChild) {
    const prev = await input.loadLatestState(childId);
    const folded = foldWorldState(childEvents, prev);

    // Snapshot version is the reducer output: episode_completed increments it.
    // It is not a per-batch counter. Source: 02 §3 HERO v1.0 §2 reducer mapping.
    await input.insertWorldState(childId, folded);
    inserted += 1;
  }

  return { claimed, inserted };
}
