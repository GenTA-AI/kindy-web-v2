import Phaser from 'phaser';
import type { PlacedItem } from '@/lib/island/island-state';
import type { BodyColorId } from '@/lib/world/world-state';
import {
  TILE,
  bodyPalette,
  drawAvatarDown,
  drawAvatarSide,
  drawAvatarUp,
  type Pal,
  type Pix,
} from '@/components/island/pixel-art';
import {
  AVATAR_START,
  WORLD_BACKGROUND,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  clampWorldPoint,
  createTerrain,
  isWalkableWorld,
  registerMapTextures,
  type TerrainLayer,
  type WorldPoint,
} from '@/components/island/map';
import { IslandProps, registerPropTextures } from '@/components/island/props';
import { renderNpcs } from '@/components/island/npc';

export const CAMERA_ZOOM = 2;

const CAMERA_LERP = 0.12;
const WALK_SPEED = 46;
const COLLISION_SAMPLE_PX = 1;

export interface IslandEngineOptions {
  /** /world 아바타 몸색 id — 도트 팔레트 스왑에 사용. null 이면 기본(민트). */
  avatarBody: BodyColorId | null;
  initialPlaced: PlacedItem[];
  initialLevel: number;
  reducedMotion: boolean;
  onBottleTap: (bottleId: string) => void;
  onCellTap: (gx: number, gy: number) => void;
  onReady: () => void;
}

function makePixelTexture(scene: Phaser.Scene, key: string, pix: Pix, pal: Pal): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let y = 0; y < pix.h; y += 1) {
    for (let x = 0; x < pix.w; x += 1) {
      const color = pal[pix.g[y][x]];
      if (!color) continue;
      graphics.fillStyle(Number.parseInt(color.slice(1), 16), 1);
      graphics.fillRect(x, y, 1, 1);
    }
  }
  graphics.generateTexture(key, pix.w, pix.h);
  graphics.destroy();
}

function walkableInteger(point: WorldPoint, fallback: WorldPoint): WorldPoint {
  const rounded = { x: Math.round(point.x), y: Math.round(point.y) };
  if (isWalkableWorld(rounded.x, rounded.y)) return rounded;

  const floored = { x: Math.floor(point.x), y: Math.floor(point.y) };
  return isWalkableWorld(floored.x, floored.y) ? floored : fallback;
}

/** 물 타일을 건너뛰지 않도록 이동 선분을 1px 간격으로 검사한다. */
function findWalkableDestination(from: WorldPoint, desired: WorldPoint): WorldPoint {
  const target = clampWorldPoint(desired);
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return walkableInteger(from, from);

  const steps = Math.max(1, Math.ceil(distance / COLLISION_SAMPLE_PX));
  let lastWalkable = from;
  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    const point = { x: from.x + dx * ratio, y: from.y + dy * ratio };
    if (!isWalkableWorld(point.x, point.y)) break;
    lastWalkable = point;
  }

  return walkableInteger(lastWalkable, from);
}

export class IslandScene extends Phaser.Scene {
  private readonly opts: IslandEngineOptions;
  private avatar?: Phaser.GameObjects.Sprite;
  private moveTween?: Phaser.Tweens.Tween;
  private facing: 'down' | 'left' | 'right' | 'up' = 'down';
  private terrain?: TerrainLayer;
  private propsLayer?: IslandProps;
  private seaFrame: 0 | 1 = 0;

  constructor(opts: IslandEngineOptions) {
    super('island');
    this.opts = opts;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(WORLD_BACKGROUND);
    this.buildTextures();
    this.terrain = createTerrain(this);

    this.propsLayer = new IslandProps(this, {
      reducedMotion: this.opts.reducedMotion,
      onBottleTap: this.opts.onBottleTap,
      onCellTap: this.opts.onCellTap,
    });
    this.propsLayer.create(this.opts.initialPlaced, this.opts.initialLevel);
    renderNpcs(this);
    this.createAvatar();
    this.configureCamera();
    this.configureInput();
    this.configureSeaAnimation();
    this.opts.onReady();
  }

  private buildTextures(): void {
    registerMapTextures(this, makePixelTexture);
    registerPropTextures(this, makePixelTexture);

    const avatarPalette = bodyPalette(this.opts.avatarBody);
    makePixelTexture(this, 'av-down-0', drawAvatarDown(0), avatarPalette);
    makePixelTexture(this, 'av-down-1', drawAvatarDown(1), avatarPalette);
    makePixelTexture(this, 'av-side-0', drawAvatarSide(0), avatarPalette);
    makePixelTexture(this, 'av-side-1', drawAvatarSide(1), avatarPalette);
    makePixelTexture(this, 'av-up-0', drawAvatarUp(0), avatarPalette);
    makePixelTexture(this, 'av-up-1', drawAvatarUp(1), avatarPalette);
  }

  private createAvatar(): void {
    const createAnimation = (key: string, direction: 'down' | 'side' | 'up') =>
      this.anims.create({
        key,
        frames: [{ key: `av-${direction}-0` }, { key: `av-${direction}-1` }],
        frameRate: 5,
        repeat: -1,
      });
    createAnimation('walk-down', 'down');
    createAnimation('walk-up', 'up');
    createAnimation('walk-side', 'side');

    const x = AVATAR_START.col * TILE;
    const y = AVATAR_START.row * TILE;
    this.avatar = this.add.sprite(x, y, 'av-down-0').setOrigin(0.5, 0.9).setDepth(y);
  }

  private configureCamera(): void {
    if (!this.avatar) return;
    this.cameras.main
      .setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      .setRoundPixels(true)
      .setZoom(CAMERA_ZOOM)
      .centerOn(this.avatar.x, this.avatar.y)
      .startFollow(this.avatar, true, CAMERA_LERP, CAMERA_LERP);
  }

  private configureInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      this.moveAvatarTo(pointer.worldX, pointer.worldY);
    });
  }

  private configureSeaAnimation(): void {
    if (this.opts.reducedMotion || !this.terrain) return;
    this.time.addEvent({
      delay: 720,
      loop: true,
      callback: () => {
        this.seaFrame = this.seaFrame === 0 ? 1 : 0;
        this.terrain?.setSeaFrame(this.seaFrame);
      },
    });
  }

  private idleTexture(): string {
    return this.facing === 'up' ? 'av-up-0' : this.facing === 'down' ? 'av-down-0' : 'av-side-0';
  }

  private moveAvatarTo(targetX: number, targetY: number): void {
    if (!this.avatar) return;
    this.moveTween?.stop();

    const destination = findWalkableDestination(
      { x: this.avatar.x, y: this.avatar.y },
      { x: targetX, y: targetY },
    );
    const dx = destination.x - this.avatar.x;
    const dy = destination.y - this.avatar.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) {
      this.avatar.anims.stop();
      this.avatar.setTexture(this.idleTexture());
      return;
    }

    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (this.opts.reducedMotion) {
      this.avatar.setPosition(destination.x, destination.y).setDepth(destination.y);
      this.avatar.setTexture(this.idleTexture());
      this.avatar.setFlipX(this.facing === 'left');
      return;
    }

    if (this.facing === 'left' || this.facing === 'right') {
      this.avatar.play('walk-side', true);
      this.avatar.setFlipX(this.facing === 'left');
    } else {
      this.avatar.play(`walk-${this.facing}`, true);
      this.avatar.setFlipX(false);
    }

    this.moveTween = this.tweens.add({
      targets: this.avatar,
      x: destination.x,
      y: destination.y,
      duration: Math.max(120, (distance / WALK_SPEED) * 1000),
      ease: 'Linear',
      onUpdate: () => this.avatar?.setDepth(this.avatar.y),
      onComplete: () => {
        if (!this.avatar) return;
        this.avatar.anims.stop();
        this.avatar.setTexture(this.idleTexture());
      },
    });
  }

  setMode(mode: 'explore' | 'decorate'): void {
    this.propsLayer?.setMode(mode);
  }

  renderPlaced(items: PlacedItem[]): void {
    this.propsLayer?.renderPlaced(items);
  }

  setLighthouse(level: number): void {
    this.propsLayer?.setLighthouse(level);
  }

  celebrate(): void {
    this.propsLayer?.celebrate();
  }
}
