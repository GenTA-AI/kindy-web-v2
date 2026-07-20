import {
  DEFAULT_AVATAR,
  type AccessoryId,
  type AvatarConfig,
  type BodyColorId,
} from '@/lib/world/world-state';
import { atlasFrameName } from '@/components/island/atlas-frames';

export type AvatarDirection = 'down' | 'side' | 'up';
export type PackHatId = 'farmer' | 'none';

export interface PackShirtOption {
  body: BodyColorId;
  label: string;
  source: string;
}

export interface PackHatOption {
  accessory: AccessoryId;
  id: PackHatId;
  label: string;
}

/** kindy:world 몸색을 팩에 실제로 들어 있는 농부 셔츠 색으로 일대일 대응한다. */
export const PACK_SHIRTS: readonly PackShirtOption[] = [
  { body: 'peach', label: '주황 셔츠', source: 'shirt-orange' },
  { body: 'mint', label: '초록 셔츠', source: 'shirt-green' },
  { body: 'sky', label: '파랑 셔츠', source: 'shirt-blue' },
  { body: 'lavender', label: '보라 셔츠', source: 'shirt-purple' },
  { body: 'lemon', label: '크림 셔츠', source: 'shirt-white-brown' },
  { body: 'rose', label: '분홍 셔츠', source: 'shirt-pink' },
];

/** 기존 accessory 값은 보존하면서 섬에서는 모자 없음/농부 모자로 단순화한다. */
export const PACK_HATS: readonly PackHatOption[] = [
  { accessory: 'sprout', id: 'none', label: '모자 없음' },
  { accessory: 'star', id: 'farmer', label: '노랑 농부 모자' },
];

const DIRECTION_ROW: Readonly<Record<AvatarDirection, number>> = {
  down: 0,
  side: 1,
  up: 2,
};

export function normalizePackAvatar(avatar: AvatarConfig | null): AvatarConfig {
  return avatar ?? DEFAULT_AVATAR;
}

export function selectedPackHat(avatar: AvatarConfig): PackHatId {
  return avatar.accessory === 'star' ? 'farmer' : 'none';
}

export function packAvatarFrames(
  avatar: AvatarConfig | null,
  direction: AvatarDirection,
  frame: 0 | 1,
): readonly string[] {
  const normalized = normalizePackAvatar(avatar);
  const shirt = PACK_SHIRTS.find(({ body }) => body === normalized.body) ?? PACK_SHIRTS[1];
  const row = DIRECTION_ROW[direction];
  const frames = [
    atlasFrameName('avatar-base', row, frame),
    atlasFrameName(shirt.source, row, frame),
  ];
  if (selectedPackHat(normalized) === 'farmer') {
    frames.push(atlasFrameName('farmer-hat', row, frame));
  }
  return frames;
}

export function withPackShirt(avatar: AvatarConfig, body: BodyColorId): AvatarConfig {
  return { ...avatar, body };
}

export function withPackHat(avatar: AvatarConfig, hat: PackHatId): AvatarConfig {
  return { ...avatar, accessory: hat === 'farmer' ? 'star' : 'sprout' };
}
