import assert from 'node:assert/strict';
import test from 'node:test';

import { CHARACTERS } from '../../data/worlds/animal-village';
import {
  ANIMAL_VILLAGE_BIBLE,
  EPISODE_VOICE_EMOTIONS,
  getCastMember,
  resolveVoiceCasting,
  resolveVoiceStyle,
  wrapWithPromptRules,
} from './animal-village-bible';

test('cast ids and voices match the deployed animal village characters', () => {
  const bibleCast = ANIMAL_VILLAGE_BIBLE.cast.map((member) => ({
    id: member.id,
    voice: member.voice,
  }));
  const worldCast = Object.values(CHARACTERS).map((character) => ({
    id: character.id,
    voice: character.voice,
  }));

  assert.deepEqual(bibleCast, worldCast);
});

test('all cast members keep child voice guidance and complete emotion specs', () => {
  for (const member of ANIMAL_VILLAGE_BIBLE.cast) {
    assert.match(member.voiceStyle, /절대 어른/);
    assert.deepEqual(Object.keys(member.emotions).sort(), [...EPISODE_VOICE_EMOTIONS].sort());

    for (const emotion of EPISODE_VOICE_EMOTIONS) {
      assert.ok(member.emotions[emotion].visual);
      assert.ok(member.emotions[emotion].voiceStyle);
    }
  }
});

test('negative prompt blocks canonical unsafe visual artifacts', () => {
  const negativePrompt = ANIMAL_VILLAGE_BIBLE.promptRules.negativePrompt.toLowerCase();

  for (const term of ['letter a', 'text', 'watermark', 'photorealistic', 'horror']) {
    assert.ok(negativePrompt.includes(term), `expected negative prompt to include ${term}`);
  }
});

test('prompt wrapper includes prefix, suffix, style tags, and negative prompt', () => {
  const wrapped = wrapWithPromptRules('Mori waves from the story library.');
  const rules = ANIMAL_VILLAGE_BIBLE.promptRules;

  assert.ok(wrapped.includes(rules.mandatoryPrefix));
  assert.ok(wrapped.includes(rules.mandatorySuffix));
  assert.ok(wrapped.includes('NEGATIVE (must NOT appear):'));
  assert.ok(wrapped.includes(rules.negativePrompt));
  for (const tag of rules.styleConsistencyTags) {
    assert.ok(wrapped.includes(tag));
  }
});

test('voice helpers resolve cast members and fall back to Kore narrator', () => {
  assert.equal(getCastMember('toto')?.voice, 'Puck');
  assert.equal(getCastMember('unknown'), null);

  assert.deepEqual(resolveVoiceCasting(undefined), {
    voice: 'Kore',
    style: ANIMAL_VILLAGE_BIBLE.narrator.style,
  });
  assert.deepEqual(resolveVoiceCasting('doto'), {
    voice: 'Leda',
    style: getCastMember('doto')?.voiceStyle,
  });

  const style = resolveVoiceStyle('bangul', 'excited');
  assert.match(style, /절대 어른/);
  assert.match(style, /들뜬 목소리/);
});
