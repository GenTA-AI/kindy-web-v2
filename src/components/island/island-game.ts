import Phaser from 'phaser';
import {
  GRID_COLS,
  GRID_ROWS,
  SEURAT_BOTTLE_ID,
  type FurnitureId,
  type PlacedItem,
} from '@/lib/island/island-state';
import { FURNITURE } from '@/lib/island/island-state';

/**
 * 등대섬 Phaser 씬 (docs/plan/11 I1) — 런타임 생성 타일 격자(모래·풀·바다) + 4방향 아바타.
 * 표류병 탭·꾸미기 격자 배치는 이벤트로 React(IslandClient)에 위임하고, 연출(등대 점등·
 * 아바타 이동)은 씬이 담당한다. Tiled 없이 코드로 지형을 깐다.
 * 이 모듈은 클라이언트 전용(dynamic ssr:false 경계 안에서만 import).
 */

const TILE = 60;
const COLS = 12;
const ROWS = 18;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;
const WALK_SPEED = 190; // px/s

// 지형 기준 타원 + 지물 좌표(타일 단위).
const ISLE = { cx: 5.5, cy: 8.6, rx: 5.2, ry: 8.1 };
const LIGHTHOUSE = { col: 8.2, row: 3 };
const CABIN = { col: 3.4, row: 6.8 };
const BOTTLE = { col: 5.6, row: 15 };
const AVATAR_START = { col: 5.6, row: 11 };
const GRID_ORIGIN = { col: 5, row: 8 }; // 오두막 옆 꾸미기 격자 좌상단(타일)

type TileType = 'sea' | 'sand' | 'grass';

function tileAt(col: number, row: number): TileType {
  const d = ((col - ISLE.cx) / ISLE.rx) ** 2 + ((row - ISLE.cy) / ISLE.ry) ** 2;
  if (d > 1) return 'sea';
  return row >= 13 ? 'sand' : 'grass';
}

function cellToWorld(gx: number, gy: number): { x: number; y: number } {
  return { x: (GRID_ORIGIN.col + gx + 0.5) * TILE, y: (GRID_ORIGIN.row + gy + 0.5) * TILE };
}

const EMOJI_BY_ID: Record<FurnitureId, string> = FURNITURE.reduce(
  (acc, f) => ({ ...acc, [f.id]: f.emoji }),
  {} as Record<FurnitureId, string>,
);

export interface IslandGameOptions {
  /** /world 아바타 몸색(light hex) 틴트 — null 이면 스프라이트 원색. */
  avatarTint: number | null;
  initialPlaced: PlacedItem[];
  initialLevel: number;
  reducedMotion: boolean;
  onBottleTap: (bottleId: string) => void;
  onCellTap: (gx: number, gy: number) => void;
  onReady: () => void;
}

export interface IslandGameHandle {
  destroy(): void;
  setMode(mode: 'explore' | 'decorate'): void;
  renderPlaced(items: PlacedItem[]): void;
  celebrate(): void;
  setLighthouse(level: number): void;
}

class IslandScene extends Phaser.Scene {
  private opts: IslandGameOptions;
  private avatar!: Phaser.GameObjects.Sprite;
  private moveTween?: Phaser.Tweens.Tween;
  private facing: 'down' | 'left' | 'right' | 'up' = 'down';
  private lampGlow!: Phaser.GameObjects.Arc;
  private beam!: Phaser.GameObjects.Triangle;
  private gridOutline!: Phaser.GameObjects.Container;
  private placedLayer!: Phaser.GameObjects.Container;

  constructor(opts: IslandGameOptions) {
    super('island');
    this.opts = opts;
  }

  preload() {
    this.load.spritesheet('avatar', '/island/avatar-sheet.png', {
      frameWidth: 128,
      frameHeight: 128,
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#5aa9cc');
    this.makeTileTextures();
    this.drawTerrain();
    this.drawLighthouse();
    this.drawCabin();
    this.drawDecorateGrid();

    this.placedLayer = this.add.container(0, 0);
    this.renderPlaced(this.opts.initialPlaced);

    this.drawBottle();
    this.createAvatar();

    this.setLighthouse(this.opts.initialLevel);

    // 지물이 아닌 빈 땅 탭 → 이동. 지물(병·격자칸) 탭은 각자 핸들러가 처리.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      this.moveAvatarTo(pointer.worldX, pointer.worldY);
    });

    this.opts.onReady();
  }

  private makeTileTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const speck = (color: number, points: Array<[number, number, number]>) => {
      g.fillStyle(color, 0.5);
      points.forEach(([x, y, r]) => g.fillCircle(x, y, r));
    };

    // 바다 — 단색(그라디언트는 generateTexture/WebGL 에서 검게 나와 쓰지 않음) + 물결.
    g.clear();
    g.fillStyle(0x5aa9cc, 1);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x74bcda, 1);
    g.fillRoundedRect(8, 14, 24, 5, 2);
    g.fillRoundedRect(30, 40, 20, 5, 2);
    g.generateTexture('tile-sea', TILE, TILE);

    // 모래.
    g.clear();
    g.fillStyle(0xe9d7ba, 1);
    g.fillRect(0, 0, TILE, TILE);
    speck(0xd8c09a, [
      [14, 20, 2],
      [42, 14, 1.5],
      [30, 44, 2],
      [50, 38, 1.5],
    ]);
    g.generateTexture('tile-sand', TILE, TILE);

    // 풀.
    g.clear();
    g.fillStyle(0x9ec982, 1);
    g.fillRect(0, 0, TILE, TILE);
    speck(0x86b56a, [
      [16, 18, 2.5],
      [40, 26, 2],
      [26, 46, 2.5],
      [50, 48, 2],
    ]);
    g.generateTexture('tile-grass', TILE, TILE);
    g.destroy();
  }

  private drawTerrain() {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const type = tileAt(c, r);
        this.add.image(c * TILE, r * TILE, `tile-${type}`).setOrigin(0, 0).setDepth(0);
      }
    }
  }

  private drawLighthouse() {
    const x = LIGHTHOUSE.col * TILE;
    const y = LIGHTHOUSE.row * TILE;
    const c = this.add.container(x, y).setDepth(y);

    const body = this.add.graphics();
    body.fillStyle(0xf4f1ea, 1);
    body.fillRoundedRect(-22, -30, 44, 120, 8); // 탑
    body.fillStyle(0xc9573f, 1);
    body.fillRect(-22, -6, 44, 16); // 붉은 띠
    body.fillRect(-22, 34, 44, 16);
    body.fillStyle(0x3f5140, 1);
    body.fillRoundedRect(-26, 84, 52, 12, 4); // 받침
    body.fillStyle(0x233126, 1);
    body.fillRoundedRect(-16, -44, 32, 16, 4); // 등실 지붕
    c.add(body);

    // 램프 글로우(점등 시 밝아짐) + 빛 기둥.
    this.beam = this.add.triangle(0, -36, 0, 0, 190, -70, 190, 70, 0xffe9a8, 0.0).setDepth(y - 1);
    this.lampGlow = this.add.circle(x, y - 36, 12, 0xffe4a0, 0.35).setDepth(y + 1);
    this.beam.x = x;
    this.beam.y = y - 36;
  }

  private drawCabin() {
    const x = CABIN.col * TILE;
    const y = CABIN.row * TILE;
    const g = this.add.graphics({ x, y }).setDepth(y);
    g.fillStyle(0xb98b5e, 1);
    g.fillRoundedRect(-34, -6, 68, 46, 6); // 벽
    g.fillStyle(0x8a5a34, 1);
    g.fillTriangle(-42, -6, 42, -6, 0, -40); // 지붕
    g.fillStyle(0x5b3f27, 1);
    g.fillRoundedRect(-10, 12, 20, 28, 3); // 문
    g.fillStyle(0xd9c7a3, 1);
    g.fillCircle(6, 26, 2);
  }

  private drawDecorateGrid() {
    this.gridOutline = this.add.container(0, 0).setDepth(1).setVisible(false);
    for (let gy = 0; gy < GRID_ROWS; gy += 1) {
      for (let gx = 0; gx < GRID_COLS; gx += 1) {
        const { x, y } = cellToWorld(gx, gy);
        const outline = this.add.graphics();
        outline.lineStyle(3, 0xffffff, 0.85);
        outline.strokeRoundedRect(x - TILE / 2 + 4, y - TILE / 2 + 4, TILE - 8, TILE - 8, 8);
        outline.fillStyle(0xffffff, 0.12);
        outline.fillRoundedRect(x - TILE / 2 + 4, y - TILE / 2 + 4, TILE - 8, TILE - 8, 8);
        this.gridOutline.add(outline);

        const zone = this.add.zone(x, y, TILE, TILE).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.opts.onCellTap(gx, gy));
      }
    }
  }

  private drawBottle() {
    const x = BOTTLE.col * TILE;
    const y = BOTTLE.row * TILE;

    const glow = this.add.circle(x, y, 26, 0xffe9a8, 0.5).setDepth(y - 1);
    if (!this.opts.reducedMotion) {
      this.tweens.add({
        targets: glow,
        scale: { from: 0.8, to: 1.35 },
        alpha: { from: 0.5, to: 0.15 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }

    const g = this.add.graphics({ x, y }).setDepth(y);
    g.fillStyle(0xbfe6d6, 0.95);
    g.fillRoundedRect(-9, -18, 18, 34, 8); // 병
    g.fillStyle(0xffffff, 0.4);
    g.fillRoundedRect(-6, -14, 4, 24, 2); // 하이라이트
    g.fillStyle(0xf6ecd2, 1);
    g.fillRoundedRect(-6, -2, 12, 12, 2); // 편지
    g.fillStyle(0x9a6b3f, 1);
    g.fillRoundedRect(-5, -24, 10, 8, 2); // 코르크

    const hit = this.add.zone(x, y - 4, 46, 60).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.opts.onBottleTap(SEURAT_BOTTLE_ID));
  }

  private createAvatar() {
    const dirs: Array<{ key: IslandScene['facing']; start: number }> = [
      { key: 'down', start: 0 },
      { key: 'left', start: 4 },
      { key: 'right', start: 8 },
      { key: 'up', start: 12 },
    ];
    dirs.forEach(({ key, start }) => {
      this.anims.create({
        key: `walk-${key}`,
        frames: this.anims.generateFrameNumbers('avatar', { start, end: start + 3 }),
        frameRate: 8,
        repeat: -1,
      });
    });

    const { x, y } = { x: AVATAR_START.col * TILE, y: AVATAR_START.row * TILE };
    this.avatar = this.add
      .sprite(x, y, 'avatar', 0)
      .setOrigin(0.5, 0.82)
      .setScale(0.52)
      .setDepth(y);
    if (this.opts.avatarTint !== null) this.avatar.setTint(this.opts.avatarTint);
  }

  private idleFrame(): number {
    return { down: 0, left: 4, right: 8, up: 12 }[this.facing];
  }

  private moveAvatarTo(tx: number, ty: number) {
    const x = Phaser.Math.Clamp(tx, TILE * 0.5, WORLD_W - TILE * 0.5);
    const y = Phaser.Math.Clamp(ty, TILE, WORLD_H - TILE * 0.5);
    this.moveTween?.stop();

    const dx = x - this.avatar.x;
    const dy = y - this.avatar.y;
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';

    if (this.opts.reducedMotion) {
      this.avatar.setPosition(x, y).setDepth(y);
      this.avatar.setFrame(this.idleFrame());
      return;
    }

    const dist = Math.hypot(dx, dy);
    this.avatar.play(`walk-${this.facing}`, true);
    this.moveTween = this.tweens.add({
      targets: this.avatar,
      x,
      y,
      duration: Math.max(120, (dist / WALK_SPEED) * 1000),
      ease: 'Linear',
      onUpdate: () => this.avatar.setDepth(this.avatar.y),
      onComplete: () => {
        this.avatar.anims.stop();
        this.avatar.setFrame(this.idleFrame());
      },
    });
  }

  // ── React 제어 ──────────────────────────────────────────────
  // create() 완료 전에 React effect 가 먼저 부를 수 있어 객체 존재를 가드한다
  // (내부 create-time 호출은 해당 객체 생성 뒤에 오므로 영향 없음).
  setMode(mode: 'explore' | 'decorate') {
    if (!this.gridOutline) return;
    this.gridOutline.setVisible(mode === 'decorate');
  }

  renderPlaced(items: PlacedItem[]) {
    if (!this.placedLayer) return;
    this.placedLayer.removeAll(true);
    items.forEach(({ item, x: gx, y: gy }) => {
      const { x, y } = cellToWorld(gx, gy);
      const base = this.add.graphics();
      base.fillStyle(0xffffff, 0.5);
      base.fillRoundedRect(x - 22, y - 14, 44, 34, 8);
      const label = this.add
        .text(x, y, EMOJI_BY_ID[item], { fontSize: '34px' })
        .setOrigin(0.5, 0.5);
      base.setDepth(y);
      label.setDepth(y + 0.1);
      this.placedLayer.add(base);
      this.placedLayer.add(label);
    });
  }

  setLighthouse(level: number) {
    if (!this.beam || !this.lampGlow) return;
    const lit = level > 0;
    this.lampGlow.setFillStyle(0xffe4a0, lit ? 0.95 : 0.3);
    this.lampGlow.setRadius(lit ? 15 : 12);
    this.beam.setFillStyle(0xffe9a8, lit ? 0.28 : 0);
    this.tweens.killTweensOf(this.beam);
    this.beam.setAngle(0);
    if (lit && !this.opts.reducedMotion) {
      this.tweens.add({
        targets: this.beam,
        angle: { from: -32, to: 32 },
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  celebrate() {
    if (!this.beam) return;
    this.setLighthouse(1);
    const flash = this.add
      .rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0xfff4d0, 0)
      .setDepth(1000);
    this.tweens.add({ targets: flash, alpha: { from: 0.55, to: 0 }, duration: 700, onComplete: () => flash.destroy() });

    const lx = LIGHTHOUSE.col * TILE;
    const ly = LIGHTHOUSE.row * TILE - 36;
    for (let i = 0; i < 12; i += 1) {
      const star = this.add.text(lx, ly, '✨', { fontSize: '24px' }).setOrigin(0.5).setDepth(1001);
      const ang = (i / 12) * Math.PI * 2;
      this.tweens.add({
        targets: star,
        x: lx + Math.cos(ang) * 120,
        y: ly + Math.sin(ang) * 120,
        alpha: { from: 1, to: 0 },
        duration: 900,
        ease: 'Cubic.out',
        onComplete: () => star.destroy(),
      });
    }
  }
}

export function createIslandGame(parent: HTMLElement, opts: IslandGameOptions): IslandGameHandle {
  const scene = new IslandScene(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WORLD_W,
    height: WORLD_H,
    transparent: false,
    backgroundColor: '#5aa9cc',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
  });

  return {
    destroy: () => game.destroy(true),
    setMode: (mode) => scene.setMode(mode),
    renderPlaced: (items) => scene.renderPlaced(items),
    celebrate: () => scene.celebrate(),
    setLighthouse: (level) => scene.setLighthouse(level),
  };
}
