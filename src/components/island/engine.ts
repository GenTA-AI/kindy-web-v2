import Phaser from 'phaser';
import { PAL } from '@/components/island/pixel-art';
import type { PlacedItem } from '@/lib/island/island-state';
import type { AvatarConfig } from '@/lib/world/world-state';
import {
  AVATAR_START,
  TILE,
  WORLD_BACKGROUND,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  createTerrain,
  findWalkableDestination,
  registerMapTextures,
  resolveTapFeedback,
  type TerrainLayer,
} from '@/components/island/map';
import { IslandProps, registerPropTextures, type IslandGuidanceTarget } from '@/components/island/props';
import { preloadCharacters, registerAvatarTextures, renderNpcs } from '@/components/island/npc';

export const CAMERA_ZOOM = 2;

const CAMERA_LERP = 0.12;
const WALK_SPEED = 46;
const FEEDBACK_DEPTH_OFFSET = 1;
const FEEDBACK_LIFETIME_MS = 680;
const FEEDBACK_TWEEN_MS = 220;
const MARKER_RADIUS = TILE * 0.38;
const MARKER_STROKE = TILE * 0.12;
const FOOTPRINT_RADIUS = TILE * 0.1;

function paletteNumber(key: keyof typeof PAL): number {
  return Number.parseInt(PAL[key].slice(1), 16);
}

export interface IslandEngineOptions {
  /** /world 선택을 유료 팩 셔츠·모자 파츠로 매핑한다. */
  avatar: AvatarConfig | null;
  initialPlaced: PlacedItem[];
  initialLevel: number;
  initialGuidanceTarget: IslandGuidanceTarget;
  reducedMotion: boolean;
  onBottleTap: (bottleId: string) => void;
  onCellTap: (gx: number, gy: number) => void;
  onReady: () => void;
}

export class IslandScene extends Phaser.Scene {
  private readonly opts: IslandEngineOptions;
  private avatar?: Phaser.GameObjects.Sprite;
  private moveTween?: Phaser.Tweens.Tween;
  private facing: 'down' | 'left' | 'right' | 'up' = 'down';
  private terrain?: TerrainLayer;
  private propsLayer?: IslandProps;
  private tapFeedback?: Phaser.GameObjects.Container;
  private tapFeedbackTimer?: Phaser.Time.TimerEvent;
  private seaFrame: 0 | 1 = 0;
  private avatarConfig: AvatarConfig | null;

  constructor(opts: IslandEngineOptions) {
    super('island');
    this.opts = opts;
    this.avatarConfig = opts.avatar;
  }

  preload(): void { preloadCharacters(this); } // 팩 아바타 텍스처 로더만 NPC 모듈에 위임한다.
  create(): void {
    this.cameras.main.setBackgroundColor(WORLD_BACKGROUND);
    this.buildTextures();
    this.terrain = createTerrain(this);

    this.propsLayer = new IslandProps(this, {
      reducedMotion: this.opts.reducedMotion,
      guidanceTarget: this.opts.initialGuidanceTarget,
      getGuidanceOrigin: () => this.avatar
        ? { x: this.avatar.x, y: this.avatar.y }
        : { x: AVATAR_START.col * TILE, y: AVATAR_START.row * TILE },
      onBottleTap: this.opts.onBottleTap,
      onCellTap: this.opts.onCellTap,
    });
    this.propsLayer.create(this.opts.initialPlaced, this.opts.initialLevel);
    renderNpcs(this, this.opts.reducedMotion, this.opts.onBottleTap);
    this.createAvatar();
    this.configureCamera();
    this.configureInput();
    this.configureSeaAnimation();
    this.opts.onReady();
  }

  private buildTextures(): void {
    registerMapTextures(this);
    registerPropTextures(this);
    registerAvatarTextures(this, this.avatarConfig);
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

  private clearTapFeedback(): void {
    this.tapFeedbackTimer?.remove(false);
    this.tapFeedbackTimer = undefined;
    if (!this.tapFeedback) return;
    this.tweens.killTweensOf(this.tapFeedback);
    this.tapFeedback.destroy(true);
    this.tapFeedback = undefined;
  }

  private showTapFeedback(
    kind: 'blocked' | 'destination',
    point: { x: number; y: number },
  ): void {
    this.clearTapFeedback();

    const graphics = this.add.graphics();
    const color = paletteNumber(kind === 'destination' ? 'Y' : 'q');
    graphics.lineStyle(MARKER_STROKE, color, 0.95);
    graphics.strokeCircle(0, 0, MARKER_RADIUS);

    if (kind === 'destination') {
      graphics.fillStyle(paletteNumber('L'), 0.92);
      graphics.fillCircle(-MARKER_RADIUS * 0.3, MARKER_RADIUS * 0.08, FOOTPRINT_RADIUS);
      graphics.fillCircle(MARKER_RADIUS * 0.28, -MARKER_RADIUS * 0.12, FOOTPRINT_RADIUS);
    } else {
      graphics.lineStyle(MARKER_STROKE, paletteNumber('W'), 0.78);
      graphics.beginPath();
      graphics.arc(0, MARKER_RADIUS * 0.22, MARKER_RADIUS * 0.48, Math.PI, Math.PI * 2);
      graphics.strokePath();
    }

    const marker = this.add
      .container(point.x, point.y, graphics)
      .setDepth(point.y - FEEDBACK_DEPTH_OFFSET);
    this.tapFeedback = marker;

    if (this.opts.reducedMotion) {
      this.tapFeedbackTimer = this.time.delayedCall(FEEDBACK_LIFETIME_MS, () => this.clearTapFeedback());
      return;
    }

    marker.setScale(kind === 'destination' ? 0.68 : 0.9);
    this.tweens.add({
      targets: marker,
      scale: kind === 'destination' ? 1.12 : 1,
      y: kind === 'blocked' ? point.y - TILE * 0.18 : point.y,
      duration: FEEDBACK_TWEEN_MS,
      ease: kind === 'destination' ? 'Back.Out' : 'Sine.Out',
      yoyo: kind === 'blocked',
      onComplete: () => {
        if (this.tapFeedback !== marker) return;
        this.tweens.add({
          targets: marker,
          alpha: 0,
          duration: FEEDBACK_TWEEN_MS,
          delay: FEEDBACK_TWEEN_MS,
          ease: 'Sine.In',
          onComplete: () => {
            if (this.tapFeedback === marker) this.clearTapFeedback();
          },
        });
      },
    });
  }

  private moveAvatarTo(targetX: number, targetY: number): void {
    if (!this.avatar) return;
    this.moveTween?.stop();

    const destination = findWalkableDestination(
      { x: this.avatar.x, y: this.avatar.y },
      { x: targetX, y: targetY },
    );
    const feedback = resolveTapFeedback({ x: targetX, y: targetY }, destination);
    this.showTapFeedback(feedback.kind, feedback.point);
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
      this.propsLayer?.updateGuidanceOrigin(this.avatar.x, this.avatar.y);
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
      onUpdate: () => {
        if (!this.avatar) return;
        this.avatar.setDepth(this.avatar.y);
        this.propsLayer?.updateGuidanceOrigin(this.avatar.x, this.avatar.y);
      },
      onComplete: () => {
        if (!this.avatar) return;
        this.avatar.anims.stop();
        this.avatar.setTexture(this.idleTexture());
        this.propsLayer?.updateGuidanceOrigin(this.avatar.x, this.avatar.y);
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

  setGuidanceTarget(target: IslandGuidanceTarget): void {
    this.propsLayer?.setGuidanceTarget(target);
  }

  setAvatar(avatar: AvatarConfig): void {
    this.avatarConfig = avatar;
    if (!registerAvatarTextures(this, avatar) || !this.avatar) return;
    this.avatar.anims.stop();
    this.avatar.setTexture(this.idleTexture());
  }

  celebrate(): void {
    this.propsLayer?.celebrate();
  }
}
