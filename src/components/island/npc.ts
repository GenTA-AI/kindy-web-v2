import Phaser from 'phaser';
import { SEURAT_BOTTLE_ID } from '@/lib/island/island-state';
import { BODY_COLORS, type BodyColorId } from '@/lib/world/world-state';

const CHARACTER_SHEET_KEY = 'island-character-sheet';
const CHARACTER_SHEET_URL = '/island/avatar/characters.png';
const PACK_TILE = 16;
const AVATAR_FRAME_WIDTH = PACK_TILE * 2;
const AVATAR_FRAME_HEIGHT = PACK_TILE * 2;
const FISHER_FRAME_SIZE = { width: PACK_TILE * 3, height: PACK_TILE * 3 } as const;
const FISHER_POSITION = { col: 35, row: 62 } as const;
const FISHER_APPROACH_RADIUS = PACK_TILE * 4;
const CHILD_TAP_TARGET = 60;

const AVATAR_FRAMES = [
  ['av-down-0', 0],
  ['av-down-1', 1],
  ['av-side-0', 2],
  ['av-side-1', 3],
  ['av-up-0', 4],
  ['av-up-1', 5],
] as const;

const PACK_PALETTE = {
  hairLight: '#704643',
  hairDark: '#5d2c28',
  clothLight: '#33984b',
  clothBase: '#1e6f50',
  clothDark: '#134c4c',
  trousersLight: '#0098dc',
  trousersDark: '#0069aa',
} as const;

type Rgb = readonly [red: number, green: number, blue: number];

function hexToRgb(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbKey(red: number, green: number, blue: number): string {
  return `${red},${green},${blue}`;
}

function avatarPalette(bodyId: BodyColorId | null): ReadonlyMap<string, Rgb> {
  const body = BODY_COLORS.find(({ id }) => id === bodyId) ?? BODY_COLORS.find(({ id }) => id === 'mint')!;
  const light = hexToRgb(body.light);
  const base = hexToRgb(body.base);
  const dark = hexToRgb(body.dark);

  // 팩의 머리·상의·하의 원색만 kindy:world 3단 몸색으로 일대일 치환한다.
  const swaps: readonly (readonly [string, Rgb])[] = [
    [PACK_PALETTE.hairLight, light],
    [PACK_PALETTE.hairDark, base],
    [PACK_PALETTE.clothLight, light],
    [PACK_PALETTE.clothBase, base],
    [PACK_PALETTE.clothDark, dark],
    [PACK_PALETTE.trousersLight, base],
    [PACK_PALETTE.trousersDark, dark],
  ];
  return new Map(swaps.map(([source, target]) => [rgbKey(...hexToRgb(source)), target] as const));
}

function copySheetFrame(
  scene: Phaser.Scene,
  targetKey: string,
  sourceRect: { x: number; y: number; width: number; height: number },
  palette?: ReadonlyMap<string, Rgb>,
): void {
  if (scene.textures.exists(targetKey)) scene.textures.remove(targetKey);
  const texture = scene.textures.createCanvas(targetKey, sourceRect.width, sourceRect.height);
  if (!texture) return;

  const context = texture.getContext();
  const source = scene.textures.get(CHARACTER_SHEET_KEY).getSourceImage() as CanvasImageSource;
  context.clearRect(0, 0, sourceRect.width, sourceRect.height);
  context.drawImage(
    source,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    sourceRect.width,
    sourceRect.height,
  );

  if (palette) {
    const pixels = context.getImageData(0, 0, sourceRect.width, sourceRect.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      if (pixels.data[index + 3] === 0) continue;
      const replacement = palette.get(rgbKey(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]));
      if (!replacement) continue;
      [pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]] = replacement;
    }
    context.putImageData(pixels, 0, 0);
  }
  texture.refresh();
}

function registerCharacterTextures(scene: Phaser.Scene, bodyId: BodyColorId | null): boolean {
  if (!scene.textures.exists(CHARACTER_SHEET_KEY)) return false;
  const palette = avatarPalette(bodyId);
  AVATAR_FRAMES.forEach(([key, column]) => {
    copySheetFrame(scene, key, {
      x: column * AVATAR_FRAME_WIDTH,
      y: 0,
      width: AVATAR_FRAME_WIDTH,
      height: AVATAR_FRAME_HEIGHT,
    }, palette);
  });
  copySheetFrame(scene, 'npc-fisher-0', { x: 192, y: 0, ...FISHER_FRAME_SIZE });
  copySheetFrame(scene, 'npc-fisher-1', { x: 240, y: 0, ...FISHER_FRAME_SIZE });
  copySheetFrame(scene, 'npc-speech', { x: 288, y: 0, width: PACK_TILE, height: PACK_TILE });
  return true;
}

export function preloadCharacters(scene: Phaser.Scene): void {
  scene.load.image(CHARACTER_SHEET_KEY, CHARACTER_SHEET_URL);
}

function findAvatar(scene: Phaser.Scene): Phaser.GameObjects.Sprite | undefined {
  return scene.children.list.find(
    (child): child is Phaser.GameObjects.Sprite =>
      child instanceof Phaser.GameObjects.Sprite && child.texture.key.startsWith('av-'),
  );
}

export function renderNpcs(
  scene: Phaser.Scene,
  avatarBody: BodyColorId | null,
  reducedMotion: boolean,
  onBottleTap: (bottleId: string) => void,
): void {
  if (!registerCharacterTextures(scene, avatarBody)) return;

  const x = FISHER_POSITION.col * PACK_TILE;
  const y = FISHER_POSITION.row * PACK_TILE;
  if (!scene.anims.exists('npc-fisher-idle')) {
    scene.anims.create({
      key: 'npc-fisher-idle',
      frames: [{ key: 'npc-fisher-0' }, { key: 'npc-fisher-1' }],
      frameRate: 2,
      repeat: -1,
    });
  }

  const fisher = scene.add.sprite(x, y, 'npc-fisher-0').setOrigin(0.5, 1).setDepth(y);
  if (!reducedMotion) fisher.play('npc-fisher-idle');

  const speech = scene.add.image(x, y - FISHER_FRAME_SIZE.height, 'npc-speech')
    .setOrigin(0.5, 1)
    .setDepth(y + 2)
    .setVisible(false);
  const hit = scene.add.zone(x, y - FISHER_FRAME_SIZE.height / 2, CHILD_TAP_TARGET, CHILD_TAP_TARGET)
    .setDepth(y + 3)
    .setInteractive({ useHandCursor: true });
  if (hit.input) hit.input.enabled = false;

  const setPressed = (pressed: boolean) => speech.setY(y - FISHER_FRAME_SIZE.height + (pressed ? 1 : 0));
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
    const nextNearby = Boolean(avatar && Phaser.Math.Distance.Between(avatar.x, avatar.y, x, y) <= FISHER_APPROACH_RADIUS);
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
