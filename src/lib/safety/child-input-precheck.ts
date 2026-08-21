export const CHILD_INPUT_MAX_CHARACTERS = 240;
export const CHILD_INPUT_MAX_UTF8_BYTES = CHILD_INPUT_MAX_CHARACTERS * 4;

const RAW_INPUT_CODE_UNIT_CEILING = 2_048;
const MAX_REPORTED_REDACTIONS = 9;

const PII_CATEGORIES = [
  'name',
  'school',
  'email',
  'url',
  'phone',
  'exact_location',
  'sns_contact',
] as const;

export type ChildInputPiiCategory = (typeof PII_CATEGORIES)[number];

export type ChildInputSafetyReasonCode =
  | 'self_harm_imminent'
  | 'abuse_disclosure'
  | 'sexual_grooming'
  | 'secret_offline_meeting';

export type ChildInputRedactionSummary = Readonly<{
  total: number;
  capped: boolean;
  categories: ReadonlyArray<Readonly<{
    category: ChildInputPiiCategory;
    count: number;
  }>>;
}>;

export type ChildInputPrecheckResult =
  | Readonly<{
    kind: 'allow_sanitized';
    sanitizedText: string;
  }>
  | Readonly<{
    kind: 'privacy_redirect';
    reasonCode: 'high_confidence_pii';
    redactions: ChildInputRedactionSummary;
  }>
  | Readonly<{
    kind: 'safety_redirect';
    reasonCode: ChildInputSafetyReasonCode;
  }>
  | Readonly<{
    kind: 'invalid';
    reasonCode:
      | 'not_string'
      | 'empty'
      | 'too_long'
      | 'malformed_unicode'
      | 'unsupported_control';
  }>;

type PiiRule = Readonly<{
  category: ChildInputPiiCategory;
  pattern: RegExp;
  replacement: string;
}>;

const INVISIBLE_FORMAT_CHARACTERS = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;
const UNSUPPORTED_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;

const SOCIAL_PLATFORM = '(?:\uce74\uce74\uc624\ud1a1|\uce74\ud1a1|\uc778\uc2a4\ud0c0\uadf8\ub7a8|\uc778\uc2a4\ud0c0|instagram|\ud2f1\ud1a1|tiktok|\ub514\uc2a4\ucf54\ub4dc|discord|\ud154\ub808\uadf8\ub7a8|telegram|\uc2a4\ub0c5\ucc57|snapchat|\ub77c\uc778|line|\uc624\ud508\ucc44\ud305|openchat)';
const SOCIAL_IDENTIFIER = '[a-z0-9][a-z0-9._-]{2,31}';

/**
 * Closed, high-confidence PII rules. Name and school detection requires an
 * explicit self-identification cue; this does not claim to find every proper
 * name, school reference, or free-form address. A privacy redirect sends no
 * child-authored text to a vendor, so placeholders stay internal.
 */
const PII_RULES: readonly PiiRule[] = [
  {
    category: 'name',
    pattern: /(?:(?:\ub0b4|\uc81c)\s*\uc774\ub984|my\s+name)\s*(?:\uc740|\ub294|\uc774|\uac00|:|=|is)?\s*[\p{L}][\p{L}'-]{1,39}/giu,
    replacement: '[REDACTED_NAME]',
  },
  {
    category: 'school',
    pattern: /[\p{Script=Hangul}]{1,20}(?:\ucd08\ub4f1\ud559\uad50|\uc911\ud559\uad50|\uace0\ub4f1\ud559\uad50)\s*(?:[1-6]\s*\ud559\ub144|[1-9]\s*\ubc18)/gu,
    replacement: '[REDACTED_SCHOOL]',
  },
  {
    category: 'school',
    pattern: /(?:\uc6b0\ub9ac\s*\ud559\uad50|(?:\ub0b4|\uc81c)\uac00?\s*\ub2e4\ub2c8\ub294\s*\ud559\uad50)\s*(?:\ub294|\uc740|\uc774|\uac00|:|=)?\s*[\p{Script=Hangul}]{1,20}(?:\ucd08\ub4f1\ud559\uad50|\uc911\ud559\uad50|\uace0\ub4f1\ud559\uad50)/gu,
    replacement: '[REDACTED_SCHOOL]',
  },
  {
    category: 'school',
    pattern: /(?:\ub098\ub294|\uc800\ub294|\ub0b4\uac00|\uc81c\uac00)\s+[\p{Script=Hangul}]{1,20}(?:\ucd08\ub4f1\ud559\uad50|\uc911\ud559\uad50|\uace0\ub4f1\ud559\uad50)\s*(?:\ub2e4\ub140|\ub2e4\ub2c8)/gu,
    replacement: '[REDACTED_SCHOOL]',
  },
  {
    category: 'email',
    pattern: /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}][\p{L}\p{N}._%+-]{0,63}\s*@\s*(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\s*\.\s*)+[a-z]{2,24}(?![a-z0-9-])/giu,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    category: 'email',
    pattern: /(?<![\p{L}\p{N}._%+-])[a-z0-9][a-z0-9._%+-]{0,63}\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\uace8\ubc45\uc774)\s*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\ub2f7)\s*(?:com|net|org|kr|io|me|app|ai)(?![a-z0-9-])/giu,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    category: 'url',
    pattern: /\b(?:https?:\/\/|www\.)[^\s<>"']{3,200}/giu,
    replacement: '[REDACTED_URL]',
  },
  {
    category: 'url',
    pattern: /(?<![@\p{L}\p{N}.-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:co\.kr|com|net|org|kr|io|me|app|ai|gg|dev|xyz)(?:\/[^\s<>"']*)?(?![\p{L}\p{N}-])/giu,
    replacement: '[REDACTED_URL]',
  },
  {
    category: 'phone',
    pattern: /(?<!\d)(?:(?:\+82[\s().-]*(?:0[\s().-]*)?1[016789])|(?:01[016789]))(?:[\s().-]*\d){7,8}(?!\d)/gu,
    replacement: '[REDACTED_PHONE]',
  },
  {
    category: 'phone',
    pattern: /(?<!\d)(?:(?:\+82[\s().-]*(?:0[\s().-]*)?(?:2|3[1-3]|4[1-4]|5[1-5]|6[1-4]))|(?:0(?:2|3[1-3]|4[1-4]|5[1-5]|6[1-4])))[\s().-]+\d{3,4}[\s().-]+\d{4}(?!\d)/gu,
    replacement: '[REDACTED_PHONE]',
  },
  {
    category: 'phone',
    pattern: /(?<![\d+])\+(?:\d[\s().-]*){8,15}(?!\d)/gu,
    replacement: '[REDACTED_PHONE]',
  },
  {
    category: 'exact_location',
    pattern: /(?:\uc6b0\ub9ac\s*\uc9d1|\uc9d1|\uc8fc\uc18c)\s*(?:\uc740|\ub294|\uc774|\uac00|:|=)?\s*(?:\uc11c\uc6b8|\ubd80\uc0b0|\ub300\uad6c|\uc778\ucc9c|\uad11\uc8fc|\ub300\uc804|\uc6b8\uc0b0|\uc138\uc885|\uacbd\uae30|\uac15\uc6d0|\ucda9\ubd81|\ucda9\ub0a8|\uc804\ubd81|\uc804\ub0a8|\uacbd\ubd81|\uacbd\ub0a8|\uc81c\uc8fc)\s*(?:[\p{Script=Hangul}]{1,12}(?:\uc2dc|\uad70|\uad6c)\s*){0,3}[\p{Script=Hangul}\d]{1,20}(?:\ub300\ub85c|\ub85c|\uae38)\s*\d{1,4}(?:-\d{1,4})?/gu,
    replacement: '[REDACTED_LOCATION]',
  },
  {
    category: 'exact_location',
    pattern: /(?:\ub098\ub294|\uc800\ub294|\ub0b4\uac00|\uc81c\uac00)\s+[\p{Script=Hangul}\s]{1,30}(?:\uc2dc|\uad70|\uad6c|\ub3d9|\uc74d|\uba74|\ub9ac)(?:\uc5d0|\uc5d0\uc11c)\s*(?:\uc0b4\uc544|\uc0b4\uace0|\uac70\uc8fc)/gu,
    replacement: '[REDACTED_LOCATION]',
  },
  {
    category: 'exact_location',
    pattern: /(?:\uc11c\uc6b8(?:\ud2b9\ubcc4\uc2dc)?|\ubd80\uc0b0(?:\uad11\uc5ed\uc2dc)?|\ub300\uad6c(?:\uad11\uc5ed\uc2dc)?|\uc778\ucc9c(?:\uad11\uc5ed\uc2dc)?|\uad11\uc8fc(?:\uad11\uc5ed\uc2dc)?|\ub300\uc804(?:\uad11\uc5ed\uc2dc)?|\uc6b8\uc0b0(?:\uad11\uc5ed\uc2dc)?|\uc138\uc885(?:\ud2b9\ubcc4\uc790\uce58\uc2dc)?|\uacbd\uae30(?:\ub3c4)?|\uac15\uc6d0(?:\ud2b9\ubcc4\uc790\uce58\ub3c4|\ub3c4)?|\ucda9\uccad[\ub0a8\ubd81](?:\ub3c4)?|\uc804\ub77c[\ub0a8\ubd81](?:\ub3c4)?|\uacbd\uc0c1[\ub0a8\ubd81](?:\ub3c4)?|\uc81c\uc8fc(?:\ud2b9\ubcc4\uc790\uce58\ub3c4|\ub3c4)?)(?:\s+[\p{Script=Hangul}]{1,12}(?:\uc2dc|\uad70|\uad6c)){1,3}\s+[\p{Script=Hangul}\d]{1,20}(?:\ub300\ub85c|\ub85c|\uae38|\ub3d9|\uc74d|\uba74|\ub9ac)\s*\d{1,4}(?:-\d{1,4})?/gu,
    replacement: '[REDACTED_LOCATION]',
  },
  {
    category: 'exact_location',
    pattern: /(?:\uc6b0\ub9ac\s*\uc9d1|\uc9d1|\uc8fc\uc18c|\uc0ac\ub294\s*\uacf3)\s*(?:\uc8fc\uc18c)?\s*(?:\uc740|\ub294|\uc774|\uac00|:|=)?\s*(?:[\p{Script=Hangul}]{1,12}(?:\uc2dc|\uad70|\uad6c)\s+){0,3}[\p{Script=Hangul}\d]{1,20}(?:\ub300\ub85c|\ub85c|\uae38|\ub3d9|\uc74d|\uba74|\ub9ac)\s*\d{1,4}(?:-\d{1,4})?/gu,
    replacement: '[REDACTED_LOCATION]',
  },
  {
    category: 'sns_contact',
    pattern: new RegExp(`${SOCIAL_PLATFORM}\\s*[:=]\\s*@?${SOCIAL_IDENTIFIER}`, 'giu'),
    replacement: '[REDACTED_SNS]',
  },
  {
    category: 'sns_contact',
    pattern: new RegExp(`${SOCIAL_PLATFORM}\\s+@?(?=[a-z0-9._-]{3,32}(?![a-z0-9._-]))(?=[a-z0-9._-]{0,31}[0-9._-])${SOCIAL_IDENTIFIER}(?![a-z0-9._-])`, 'giu'),
    replacement: '[REDACTED_SNS]',
  },
  {
    category: 'sns_contact',
    pattern: new RegExp(`${SOCIAL_PLATFORM}\\s*(?:\\uc544\\uc774\\ub514|id|\\uacc4\\uc815|\\ud578\\ub4e4|\\ub2c9\\ub124\\uc784|\\uc5f0\\ub77d\\ucc98|\\ucf54\\ub4dc)\\s*(?:\\uc740|\\ub294|\\uc774|\\uac00|:|=)?\\s*@?${SOCIAL_IDENTIFIER}`, 'giu'),
    replacement: '[REDACTED_SNS]',
  },
  {
    category: 'sns_contact',
    pattern: new RegExp(`${SOCIAL_PLATFORM}\\s*(?:\\uc740|\\ub294|:|=)?\\s*@${SOCIAL_IDENTIFIER}`, 'giu'),
    replacement: '[REDACTED_SNS]',
  },
  {
    category: 'sns_contact',
    pattern: /(?<![\p{L}\p{N}@])@[a-z0-9][a-z0-9._-]{2,31}(?![\p{L}\p{N}@])/giu,
    replacement: '[REDACTED_SNS]',
  },
];

const SELF_HARM_INTENT = /(?:\uc8fd\uace0\s*\uc2f6|\uc8fd\uc5b4\s*\ubc84\ub9b4|\uc8fd\uc744\s*(?:\ub798|\uac70\uc57c|\uac70\uc608\uc694|\uaebc\uc57c)|\uc790\uc0b4\s*(?:\ud560|\ud558\ub824|\ud558\uace0\s*\uc2f6)|\ubaa9\uc228\uc744?\s*\ub04a|\ub6f0\uc5b4\ub0b4\ub9ac\s*(?:\ub824|\uace0\s*\uc2f6|\uac70\uc57c|\uaebc\uc57c)|(?:\uc218\uba74\uc81c|\uc57d)\uc744?\s*(?:\ub9ce\uc774\s*)?\uba39\uace0\s*\uc8fd|\uc190\ubaa9\uc744?\s*(?:\uadf8\uc5c8|\uadf8\uc73c\ub824|\uce7c\ub85c\s*\uadf8))/iu;
const SELF_HARM_MODIFIER = '(?:\uc9c0\uae08|\ub2f9\uc7a5|\uc624\ub298\ubc24?|\uace7|\uc774\uc81c|\uc815\ub9d0|\uc9c4\uc9dc|\ucc28\ub77c\ub9ac|\ub108\ubb34|\uadf8\ub0e5|\uc81c\ubc1c|\uacc4\uc18d)';
const SELF_HARM_FIRST_PERSON_INTENT = new RegExp(
  `(?:\ub098\ub294|\ub0b4\uac00|\ub098\ub3c4|\uc800\ub294|\uc81c\uac00|\uc800\ub3c4|\ub09c|\uc804|\ub098(?=\\s)|\uc800(?=\\s))\\s*[,，]?\\s*(?:${SELF_HARM_MODIFIER}\\s*){0,4}${SELF_HARM_INTENT.source}`,
  'iu',
);
const SELF_HARM_DIRECT_OPENING = new RegExp(
  `^(?:${SELF_HARM_MODIFIER}\\s*){0,4}${SELF_HARM_INTENT.source}`,
  'iu',
);
const SELF_HARM_ATTEMPT_IN_PROGRESS = /(?:\uc774\ubbf8|\ubc29\uae08|\uc9c0\uae08)\s*(?:(?:\uc218\uba74\uc81c|\uc57d)\uc744?\s*\ub9ce\uc774\s*\uba39\uc5c8|\uc190\ubaa9\uc744?\s*(?:\uadf8\uc5c8|\uce7c\ub85c\s*\uadf8\uc5c8)|\uc625\uc0c1\uc5d0\s*(?:\uc62c\ub77c\uc654|\uc788))/iu;

const ABUSE_AGGRESSOR_VIOLENCE = /(?:\uc544\ube60|\uc5c4\ub9c8|\ubd80\ubaa8\ub2d8|\ubcf4\ud638\uc790|\uc0bc\ucd0c|\uc774\ubaa8|\uace0\ubaa8|\ud560\uc544\ubc84\uc9c0|\ud560\uba38\ub2c8|\uc120\uc0dd\ub2d8|\ucf54\uce58|\uc5b4\ub978|\ub204\uad6c|\uadf8\s*\uc0ac\ub78c)(?:\uc774|\uac00)?\s*(?:\uc5b4\uc81c\s*|\uc624\ub298\s*|\ubc29\uae08\s*|\uc544\uae4c\s*|\uc9c0\ub09c\ubc88\uc5d0\s*)?(?:\ub098\ub97c|\uc800\ub97c|\ub0a0|\uc81c\uac8c)?\s*(?:\uacc4\uc18d\s*|\uc9c0\uae08\s*|\uc790\uc8fc\s*)?(?:\ub54c\ub9ac|\ub54c\ub838|\ub54c\ub824|\ub54c\ub9b0|\ub9de\uac8c\s*\ud558|\ubaa9\uc744?\s*\uc870\ub974|\uce7c\ub85c\s*\uc704\ud611|\uac00\ub450)/iu;
const ABUSE_AGGRESSOR_VIOLENCE_FLEXIBLE = /(?:\uc544\ube60|\uc5c4\ub9c8|\ubd80\ubaa8\ub2d8|\ubcf4\ud638\uc790|\uc0bc\ucd0c|\uc774\ubaa8|\uace0\ubaa8|\ud560\uc544\ubc84\uc9c0|\ud560\uba38\ub2c8|\uc120\uc0dd\ub2d8|\ucf54\uce58|\uc5b4\ub978|\ub204\uad6c|\uadf8\s*\uc0ac\ub78c)(?:\uc774|\uac00)?\s*(?:\uc9c0\uae08\s*|\uacc4\uc18d\s*|\uc790\uc8fc\s*)?(?:\ub098\ub97c|\uc800\ub97c|\ub0a0|\uc81c\uac8c)\s*(?:\uc9c0\uae08\s*|\uacc4\uc18d\s*|\uc790\uc8fc\s*)?(?:\ub54c\ub9ac|\ub54c\ub838|\ub54c\ub824|\ub54c\ub9b0|\ub9de\uac8c\s*\ud558|\ubaa9\uc744?\s*\uc870\ub974|\uce7c\ub85c\s*\uc704\ud611|\uac00\ub450)/iu;
const ABUSE_PASSIVE_DISCLOSURE = /(?:\uc544\ube60|\uc5c4\ub9c8|\ubd80\ubaa8\ub2d8|\ubcf4\ud638\uc790|\uc120\uc0dd\ub2d8|\ucf54\uce58|\uc0bc\ucd0c|\uc774\ubaa8|\uace0\ubaa8|\uc5b4\ub978)(?:\ud55c\ud14c|\uc5d0\uac8c)\s*(?:\uacc4\uc18d\s*|\uc790\uc8fc\s*|\uc5b4\uc81c\s*|\uc624\ub298\s*)?(?:\ub9de\uc558|\ub9de\uace0\s*\uc788|\ub450\ub4e4\uaca8\s*\ub9de)/iu;
const ABUSE_ONGOING = /(?:(?:\ub098\ub294|\ub0b4\uac00|\uc800\ub294|\uc81c\uac00|(?:\ub09c|\uc804)(?=\s))\s*(?:\uacc4\uc18d|\uc9c0\uae08|\uc790\uc8fc)|^(?:\uacc4\uc18d|\uc9c0\uae08|\uc790\uc8fc))\s*(?:\ub9de\uace0\s*\uc788|\ub450\ub4e4\uaca8\s*\ub9de|\uac07\ud600\s*\uc788)/iu;
const ABUSE_SEXUAL_TOUCH = /(?:\uc544\ube60|\uc5c4\ub9c8|\ubcf4\ud638\uc790|\uc0bc\ucd0c|\uc774\ubaa8|\uace0\ubaa8|\ud560\uc544\ubc84\uc9c0|\uc120\uc0dd\ub2d8|\ucf54\uce58|\uc5b4\ub978|\uc544\uc800\uc528|\ub204\uad6c|\uadf8\s*\uc0ac\ub78c)(?:\uc774|\uac00)?\s*(?:\ub0b4|\uc81c)\s*(?:\uac00\uc2b4|\uc5c9\ub369\uc774|\uc131\uae30|\uc18d\uc637\s*\uc548)\uc744?\s*(?:\ub9cc\uc84c|\ub9cc\uc838|\ubcf4\uc5ec\s*\ub2ec)/iu;

const GROOMING_REQUEST_WITH_CONTACT = /(?:\uc624\ube60|\ud615|\ub204\ub098|\uc5b8\ub2c8|\uc544\uc800\uc528|\uc5b4\ub978|\uc120\uc0dd\ub2d8|\ub204\uad6c|\uadf8\s*\uc0ac\ub78c|\ucc44\ud305\s*\uc0c1\ub300)(?:\uc774|\uac00)?[^.!?\n]{0,60}(?:\ubc97\uc740|\uc57c\ud55c|\uc18d\uc637|\ubab8|\uac00\uc2b4|\uc5c9\ub369\uc774|\uc131\uae30)[^.!?\n]{0,40}(?:\uc0ac\uc9c4|\uc601\uc0c1)?[^.!?\n]{0,30}(?:\ubcf4\ub0b4|\ubcf4\uc5ec|\ucc0d\uc5b4|\ub9cc\uc838|\ud558\uc790|\ud574\s*\ub2ec)/iu;
const GROOMING_EXPLICIT_MEDIA_DEMAND = /(?:\ubc97\uc740|\uc57c\ud55c|\uc18d\uc637|\ubab8|\uac00\uc2b4|\uc5c9\ub369\uc774|\uc131\uae30)\s*(?:\uc0ac\uc9c4|\uc601\uc0c1)\uc744?\s*(?:\ubcf4\ub0b4\ub798|\ub2ec\ub798|\uc694\uad6c\ud588)/iu;

const SECRET_MEETING = /(?:\ub9cc\ub098|\uc9c1\uc811\s*\ubcf4|\ubc16\uc5d0\uc11c\s*\ubcf4|\uc624\ud504\ub77c\uc778|\ub098\uc624\ub798|\uc624\ub77c\uace0|\ucc3e\uc544\uc624\ub798)/iu;
const PARENTAL_SECRECY = /(?:(?:\ubd80\ubaa8\ub2d8|\uc5c4\ub9c8|\uc544\ube60|\ubcf4\ud638\uc790|\uc120\uc0dd\ub2d8)(?:\ud55c\ud14c|\uc5d0\uac8c)?\s*(?:\ub9d0\ud558\uc9c0\s*\ub9d0|\ube44\ubc00\ub85c|\ubab0\ub798))|(?:(?:\uc544\ubb34\ud55c\ud14c\ub3c4|\ub204\uad6c\uc5d0\uac8c\ub3c4)\s*(?:\ub9d0\ud558\uc9c0\s*\ub9d0|\ube44\ubc00\ub85c))/iu;
const SUSPICIOUS_CONTACT = /(?:\uc628\ub77c\uc778|\ucc44\ud305|\uac8c\uc784\uc5d0\uc11c|\uc624\ud508\ucc44\ud305|\ubaa8\ub974\ub294\s*\uc0ac\ub78c|\ucc98\uc74c\s*\ubcf8\s*\uc0ac\ub78c|\uc544\uc800\uc528|\uc5b4\ub978|\uadf8\s*\uc0ac\ub78c)/iu;
const GENERIC_SECRECY = /(?:\ube44\ubc00\ub85c|\ubab0\ub798|\ub9d0\ud558\uc9c0\s*\ub9d0)/iu;

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return true;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function detectHardRisk(normalizedText: string): ChildInputSafetyReasonCode | null {
  const scanText = normalizedText.toLocaleLowerCase('ko-KR').replace(/\s+/gu, ' ');

  if (
    SELF_HARM_ATTEMPT_IN_PROGRESS.test(scanText)
    || SELF_HARM_FIRST_PERSON_INTENT.test(scanText)
    || SELF_HARM_DIRECT_OPENING.test(scanText)
    || /\bi\s*(?:really\s*)?(?:want|plan|am going)\s+to\s+(?:die|kill myself)\b/iu.test(scanText)
    || /\bi\s+wanna\s+(?:die|kill myself)\b/iu.test(scanText)
    || /\bi(?:'m| am)\s+about\s+to\s+kill myself\b/iu.test(scanText)
  ) {
    return 'self_harm_imminent';
  }

  if (
    ABUSE_AGGRESSOR_VIOLENCE.test(scanText)
    || ABUSE_AGGRESSOR_VIOLENCE_FLEXIBLE.test(scanText)
    || ABUSE_PASSIVE_DISCLOSURE.test(scanText)
    || ABUSE_ONGOING.test(scanText)
    || ABUSE_SEXUAL_TOUCH.test(scanText)
    || /\bmy\s+(?:dad|mom|parent|teacher|coach|uncle)\s+(?:hits|beats|touches)\s+me\b/iu.test(scanText)
  ) {
    return 'abuse_disclosure';
  }

  if (
    GROOMING_REQUEST_WITH_CONTACT.test(scanText)
    || GROOMING_EXPLICIT_MEDIA_DEMAND.test(scanText)
    || /\b(?:an?\s+adult|he|she|they)\s+(?:asked|told)\s+me\s+to\s+send\s+(?:a\s+)?(?:nude|underwear|body)\s+(?:photo|picture|video)\b/iu.test(scanText)
  ) {
    return 'sexual_grooming';
  }

  if (
    SECRET_MEETING.test(scanText)
    && (
      PARENTAL_SECRECY.test(scanText)
      || (SUSPICIOUS_CONTACT.test(scanText) && GENERIC_SECRECY.test(scanText))
      || /\bdon't\s+tell\s+(?:your\s+)?(?:parents|mom|dad|teacher)[^.!?\n]{0,80}\bmeet\b/iu.test(scanText)
    )
  ) {
    return 'secret_offline_meeting';
  }

  return null;
}

function redactHighConfidencePii(normalizedText: string): ChildInputRedactionSummary | null {
  let redactedText = normalizedText;
  const counts = new Map<ChildInputPiiCategory, number>();
  let uncappedTotal = 0;

  for (const rule of PII_RULES) {
    let ruleCount = 0;
    redactedText = redactedText.replace(rule.pattern, () => {
      ruleCount += 1;
      return rule.replacement;
    });
    if (ruleCount === 0) continue;
    uncappedTotal += ruleCount;
    counts.set(rule.category, (counts.get(rule.category) ?? 0) + ruleCount);
  }

  if (uncappedTotal === 0) return null;

  return {
    total: Math.min(uncappedTotal, MAX_REPORTED_REDACTIONS),
    capped: uncappedTotal > MAX_REPORTED_REDACTIONS,
    categories: PII_CATEGORIES.flatMap((category) => {
      const count = counts.get(category) ?? 0;
      return count === 0
        ? []
        : [{ category, count: Math.min(count, MAX_REPORTED_REDACTIONS) }];
    }),
  };
}

/**
 * Performs the only child-authored free-text transformation allowed before a
 * safety vendor or model call. Non-allow outcomes intentionally contain no
 * child-authored text, including redacted excerpts.
 */
export function precheckChildInput(input: unknown): ChildInputPrecheckResult {
  if (typeof input !== 'string') {
    return { kind: 'invalid', reasonCode: 'not_string' };
  }
  if (input.length > RAW_INPUT_CODE_UNIT_CEILING) {
    return { kind: 'invalid', reasonCode: 'too_long' };
  }
  if (hasUnpairedSurrogate(input)) {
    return { kind: 'invalid', reasonCode: 'malformed_unicode' };
  }

  const sanitizedText = input
    .normalize('NFKC')
    .replace(INVISIBLE_FORMAT_CHARACTERS, '')
    .trim();

  if (sanitizedText.length === 0) {
    return { kind: 'invalid', reasonCode: 'empty' };
  }
  if (UNSUPPORTED_CONTROL_CHARACTERS.test(sanitizedText)) {
    return { kind: 'invalid', reasonCode: 'unsupported_control' };
  }

  const characterCount = Array.from(sanitizedText).length;
  const utf8ByteCount = new TextEncoder().encode(sanitizedText).byteLength;
  if (
    characterCount > CHILD_INPUT_MAX_CHARACTERS
    || utf8ByteCount > CHILD_INPUT_MAX_UTF8_BYTES
  ) {
    return { kind: 'invalid', reasonCode: 'too_long' };
  }

  const hardRisk = detectHardRisk(sanitizedText);
  if (hardRisk) {
    return { kind: 'safety_redirect', reasonCode: hardRisk };
  }

  const redactions = redactHighConfidencePii(sanitizedText);
  if (redactions) {
    return {
      kind: 'privacy_redirect',
      reasonCode: 'high_confidence_pii',
      redactions,
    };
  }

  return { kind: 'allow_sanitized', sanitizedText };
}
