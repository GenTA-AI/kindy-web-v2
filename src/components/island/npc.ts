import Phaser from 'phaser';
import { SEURAT_BOTTLE_ID } from '@/lib/island/island-state';
import type { AvatarConfig } from '@/lib/world/world-state';
import { atlasFrameName } from '@/components/island/atlas-frames';
import {
  packAvatarFrames,
  type AvatarDirection,
} from '@/components/island/avatar-parts';

const CHARACTER_ATLAS = 'island-character-pack';
const CHARACTER_IMAGE_URL = '/island/tiles/character.png';
const CHARACTER_JSON_URL = '/island/tiles/character.json';
const AVATAR_PARTS_ATLAS = 'island-avatar-parts-pack';
const AVATAR_PARTS_IMAGE_URL = '/island/tiles/avatar-parts.png';
const AVATAR_PARTS_JSON_URL = '/island/tiles/avatar-parts.json';
const UI_ATLAS = 'island-ui-pack';
const UI_IMAGE_URL = '/island/tiles/ui.png';
const UI_JSON_URL = '/island/tiles/ui.json';
const NPC_PROP_ATLAS = 'island-props-npc';
const NPC_PROP_IMAGE_URL = '/island/tiles/props.png';
const NPC_PROP_JSON_URL = '/island/tiles/props.json';

export const NPC_DIALOGUE =
  '점으로 그린 강가로 놀러 오지 않을래? 재미있는 이야기가 기다리고 있어.';
export const DECORATE_GUIDANCE = '마음에 드는 가구를 고르고, 반짝이는 칸을 톡 눌러요.';

export const ISLAND_READ_ALOUD_KEYS = [
  'island-letter-read-aloud-npc',
  'island-decorate-read-aloud-npc',
] as const;

export type IslandReadAloudKey = (typeof ISLAND_READ_ALOUD_KEYS)[number];

interface IslandReadAloudAsset {
  label: string;
  src: string;
  transcript: string;
}

/** 라이브 TTS 대신 버튼 제스처에서만 재생하는 사전 렌더링 음성 실키다. */
export const ISLAND_READ_ALOUD_ASSETS: Readonly<
  Record<IslandReadAloudKey, IslandReadAloudAsset>
> = {
  'island-letter-read-aloud-npc': {
    label: '편지',
    src: '/island/audio/npc-letter-ko.mp3',
    transcript: NPC_DIALOGUE,
  },
  'island-decorate-read-aloud-npc': {
    label: '꾸미기 안내',
    src: '/island/audio/decorate-guide-ko.mp3',
    transcript: DECORATE_GUIDANCE,
  },
};

const PACK_TILE = 16;
const AVATAR_FRAME_SIZE = 64;
const FISHER_FRAME_SIZE = 64;
const FISHER_POSITION = { col: 35, row: 62 } as const;
const FISHER_APPROACH_RADIUS = PACK_TILE * 4;
const CHILD_TAP_TARGET = 60;
const FISHER_BOB_DISTANCE = 1;
const FISHER_BOB_DURATION = 1_600;
const FISHER_ROD_OFFSET_X = PACK_TILE * 0.375;
const FISHER_FEET_OFFSET_Y = -PACK_TILE * 0.25;
const FISHER_IDLE_ANIMATION = 'island-fisher-idle-npc';
const FISHER_FRAMES = [
  atlasFrameName('fisherwoman', 0, 0),
  atlasFrameName('fisherwoman', 0, 1),
] as const;
const FISHER_ROD_FRAMES = [
  atlasFrameName('outdoor-decor', 10, 8),
  atlasFrameName('outdoor-decor', 11, 8),
  atlasFrameName('outdoor-decor', 12, 8),
] as const;
const FISHER_ROCK_FRAMES = [
  [atlasFrameName('outdoor-decor', 11, 6), atlasFrameName('outdoor-decor', 11, 7)],
  [atlasFrameName('outdoor-decor', 12, 6), atlasFrameName('outdoor-decor', 12, 7)],
] as const;
const SPEECH_FRAME = atlasFrameName('ui-icons', 1, 0);

const AVATAR_FRAMES = [
  ['av-down-0', 'down', 0],
  ['av-down-1', 'down', 1],
  ['av-side-0', 'side', 0],
  ['av-side-1', 'side', 1],
  ['av-up-0', 'up', 0],
  ['av-up-1', 'up', 1],
] as const satisfies readonly (readonly [string, AvatarDirection, 0 | 1])[];

function copyAvatarLayers(scene: Phaser.Scene, targetKey: string, frames: readonly string[]): void {
  if (scene.textures.exists(targetKey)) scene.textures.remove(targetKey);
  const target = scene.textures.createCanvas(targetKey, AVATAR_FRAME_SIZE, AVATAR_FRAME_SIZE);
  if (!target) return;

  const context = target.getContext();
  const atlas = scene.textures.get(AVATAR_PARTS_ATLAS);
  context.clearRect(0, 0, AVATAR_FRAME_SIZE, AVATAR_FRAME_SIZE);
  for (const frameName of frames) {
    const frame = atlas.get(frameName);
    const source = frame.source.image as CanvasImageSource;
    context.drawImage(
      source,
      frame.cutX,
      frame.cutY,
      frame.cutWidth,
      frame.cutHeight,
      0,
      0,
      AVATAR_FRAME_SIZE,
      AVATAR_FRAME_SIZE,
    );
  }
  target.refresh();
}

/** Player 베이스 위에 선택 셔츠와 모자를 같은 64px 프레임으로 합성한다. */
export function registerAvatarTextures(scene: Phaser.Scene, avatar: AvatarConfig | null): boolean {
  if (!scene.textures.exists(AVATAR_PARTS_ATLAS)) return false;
  AVATAR_FRAMES.forEach(([targetKey, direction, frame]) => {
    copyAvatarLayers(scene, targetKey, packAvatarFrames(avatar, direction, frame));
  });
  return true;
}

export function preloadCharacters(scene: Phaser.Scene): void {
  scene.load.atlas(CHARACTER_ATLAS, CHARACTER_IMAGE_URL, CHARACTER_JSON_URL);
  scene.load.atlas(AVATAR_PARTS_ATLAS, AVATAR_PARTS_IMAGE_URL, AVATAR_PARTS_JSON_URL);
  scene.load.atlas(UI_ATLAS, UI_IMAGE_URL, UI_JSON_URL);
  scene.load.atlas(NPC_PROP_ATLAS, NPC_PROP_IMAGE_URL, NPC_PROP_JSON_URL);
}

function findAvatar(scene: Phaser.Scene): Phaser.GameObjects.Sprite | undefined {
  return scene.children.list.find(
    (child): child is Phaser.GameObjects.Sprite =>
      child instanceof Phaser.GameObjects.Sprite && child.texture.key.startsWith('av-'),
  );
}

function addFisherRock(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const children = FISHER_ROCK_FRAMES.flatMap((frames, row) =>
    frames.map((frame, column) =>
      scene.add
        .image(-PACK_TILE + column * PACK_TILE, -PACK_TILE * 2 + row * PACK_TILE, NPC_PROP_ATLAS, frame)
        .setOrigin(0),
    ),
  );
  return scene.add.container(x, y, children).setDepth(y);
}

function addFisherRig(
  scene: Phaser.Scene,
  x: number,
  y: number,
): { fisher: Phaser.GameObjects.Sprite; rig: Phaser.GameObjects.Container } {
  const rod = FISHER_ROD_FRAMES.map((frame, row) =>
    scene.add
      .image(FISHER_ROD_OFFSET_X, -PACK_TILE * 3 + row * PACK_TILE, NPC_PROP_ATLAS, frame)
      .setOrigin(0),
  );
  const fisher = scene.add
    .sprite(0, FISHER_FEET_OFFSET_Y, CHARACTER_ATLAS, FISHER_FRAMES[0])
    .setOrigin(0.5, 1);
  const rig = scene.add.container(x, y, [...rod, fisher]).setDepth(y + 1);
  return { fisher, rig };
}

export function renderNpcs(
  scene: Phaser.Scene,
  reducedMotion: boolean,
  onBottleTap: (bottleId: string) => void,
): void {
  if (
    !scene.textures.exists(CHARACTER_ATLAS) ||
    !scene.textures.exists(UI_ATLAS) ||
    !scene.textures.exists(NPC_PROP_ATLAS)
  ) return;

  const x = FISHER_POSITION.col * PACK_TILE;
  const y = FISHER_POSITION.row * PACK_TILE;
  if (!scene.anims.exists(FISHER_IDLE_ANIMATION)) {
    scene.anims.create({
      key: FISHER_IDLE_ANIMATION,
      frames: FISHER_FRAMES.map((frame) => ({ key: CHARACTER_ATLAS, frame })),
      frameRate: 2,
      repeat: -1,
    });
  }

  addFisherRock(scene, x, y);
  const { fisher, rig } = addFisherRig(scene, x, y);
  if (!reducedMotion) {
    fisher.play(FISHER_IDLE_ANIMATION);
    scene.tweens.add({
      targets: rig,
      y: y - FISHER_BOB_DISTANCE,
      duration: FISHER_BOB_DURATION,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  const speech = scene.add
    .image(x, y - FISHER_FRAME_SIZE + 8, UI_ATLAS, SPEECH_FRAME)
    .setOrigin(0.5, 1)
    .setDepth(y + 2)
    .setVisible(false);
  const hit = scene.add
    .zone(x, y - FISHER_FRAME_SIZE / 2, CHILD_TAP_TARGET, CHILD_TAP_TARGET)
    .setDepth(y + 3)
    .setInteractive({ useHandCursor: true });
  if (hit.input) hit.input.enabled = false;

  const setPressed = (pressed: boolean) => speech.setY(y - FISHER_FRAME_SIZE + 8 + (pressed ? 1 : 0));
  hit.on('pointerover', () => setPressed(false));
  hit.on('pointerdown', () => setPressed(true));
  hit.on('pointerup', () => {
    setPressed(false);
    onBottleTap(SEURAT_BOTTLE_ID);
  });
  hit.on('pointerout', () => setPressed(false));

  let nearby = false;
  const updateApproach = () => {
    const avatar = findAvatar(scene);
    const nextNearby = Boolean(
      avatar && Phaser.Math.Distance.Between(avatar.x, avatar.y, x, y) <= FISHER_APPROACH_RADIUS,
    );
    if (nextNearby === nearby) return;
    nearby = nextNearby;
    speech.setVisible(nearby);
    if (hit.input) hit.input.enabled = nearby;
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, updateApproach);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, updateApproach);
  });
}
