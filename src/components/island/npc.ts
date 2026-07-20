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

const PACK_TILE = 16;
const AVATAR_FRAME_SIZE = 64;
const FISHER_FRAME_SIZE = 64;
const FISHER_POSITION = { col: 35, row: 62 } as const;
const FISHER_APPROACH_RADIUS = PACK_TILE * 4;
const CHILD_TAP_TARGET = 60;
const FISHER_FRAMES = [
  atlasFrameName('fisherwoman', 0, 0),
  atlasFrameName('fisherwoman', 0, 1),
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
}

function findAvatar(scene: Phaser.Scene): Phaser.GameObjects.Sprite | undefined {
  return scene.children.list.find(
    (child): child is Phaser.GameObjects.Sprite =>
      child instanceof Phaser.GameObjects.Sprite && child.texture.key.startsWith('av-'),
  );
}

export function renderNpcs(
  scene: Phaser.Scene,
  reducedMotion: boolean,
  onBottleTap: (bottleId: string) => void,
): void {
  if (!scene.textures.exists(CHARACTER_ATLAS) || !scene.textures.exists(UI_ATLAS)) return;

  const x = FISHER_POSITION.col * PACK_TILE;
  const y = FISHER_POSITION.row * PACK_TILE;
  if (!scene.anims.exists('npc-fisher-idle')) {
    scene.anims.create({
      key: 'npc-fisher-idle',
      frames: FISHER_FRAMES.map((frame) => ({ key: CHARACTER_ATLAS, frame })),
      frameRate: 2,
      repeat: -1,
    });
  }

  const fisher = scene.add
    .sprite(x, y, CHARACTER_ATLAS, FISHER_FRAMES[0])
    .setOrigin(0.5, 1)
    .setDepth(y);
  if (!reducedMotion) fisher.play('npc-fisher-idle');

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
