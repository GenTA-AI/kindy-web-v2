import Phaser from 'phaser';
import {
  GRID_COLS,
  GRID_ROWS,
  SEURAT_BOTTLE_ID,
  type FurnitureId,
  type PlacedItem,
} from '@/lib/island/island-state';
import { type BodyColorId } from '@/lib/world/world-state';
import {
  PAL,
  Pix,
  TILE,
  bodyPalette,
  drawAvatarDown,
  drawAvatarSide,
  drawAvatarUp,
  spriteBottle,
  spriteCabin,
  spriteFurniture,
  spriteLighthouse,
  tileGrass,
  tilePath,
  tileSand,
  tileSea,
  type Pal,
} from '@/components/island/pixel-art';

/**
 * 등대섬 Phaser 씬 (docs/plan/11 I1, 2026-07-18 도트 전환) — 2000년대 피처폰 RPG 감성의
 * 프로그래매틱 픽셀아트. 스프라이트 정의는 pixel-art.ts(Phaser 비의존) 공유,
 * 이 파일은 텍스처 등록·타일 배치·아바타 이동·연출 담당. pixelArt:true 정수 스케일.
 * 루프·상태 로직은 불변 — 표류병 탭·격자 배치는 이벤트로 React(IslandClient)에 위임.
 * 이 모듈은 클라이언트 전용(dynamic ssr:false 경계 안에서만 import).
 */

const COLS = 12;
const ROWS = 18;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;
const WALK_SPEED = 46; // px/s (도트 저해상도 기준)

const ISLE = { cx: 5.5, cy: 8.6, rx: 5.2, ry: 8.1 };
const LIGHTHOUSE = { col: 8.4, row: 3.2 };
const CABIN = { col: 3.2, row: 6.8 };
const BOTTLE = { col: 5.6, row: 15 };
const AVATAR_START = { col: 5.6, row: 11 };
const GRID_ORIGIN = { col: 5, row: 8 };

type TileType = 'sea' | 'sand' | 'grass';

function tileAt(col: number, row: number): TileType {
  const d = ((col - ISLE.cx) / ISLE.rx) ** 2 + ((row - ISLE.cy) / ISLE.ry) ** 2;
  if (d > 1) return 'sea';
  return row >= 13 ? 'sand' : 'grass';
}

// 오두막→해변으로 이어지는 길(격자 아래 세로줄).
function isPathTile(col: number, row: number): boolean {
  return Math.round(col) === 6 && row >= 10 && row <= 14 && tileAt(col, row) !== 'sea';
}

function cellToWorld(gx: number, gy: number): { x: number; y: number } {
  return { x: (GRID_ORIGIN.col + gx + 0.5) * TILE, y: (GRID_ORIGIN.row + gy + 0.5) * TILE };
}

function makePixelTexture(scene: Phaser.Scene, key: string, pix: Pix, pal: Pal) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let y = 0; y < pix.h; y += 1)
    for (let x = 0; x < pix.w; x += 1) {
      const col = pal[pix.g[y][x]];
      if (!col) continue;
      g.fillStyle(parseInt(col.slice(1), 16), 1);
      g.fillRect(x, y, 1, 1);
    }
  g.generateTexture(key, pix.w, pix.h);
  g.destroy();
}

export interface IslandGameOptions {
  /** /world 아바타 몸색 id — 도트 팔레트 스왑에 사용. null 이면 기본(민트). */
  avatarBody: BodyColorId | null;
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
  private lamp!: Phaser.GameObjects.Rectangle;
  private beam!: Phaser.GameObjects.Triangle;
  private gridOutline!: Phaser.GameObjects.Container;
  private placedLayer!: Phaser.GameObjects.Container;
  private seaTiles: Phaser.GameObjects.Image[] = [];
  private seaFrame = 0;

  constructor(opts: IslandGameOptions) {
    super('island');
    this.opts = opts;
  }

  create() {
    this.cameras.main.setBackgroundColor('#4ea6cc');
    this.buildTextures();
    this.drawTerrain();
    this.drawLighthouse();
    this.drawCabin();
    this.drawDecorateGrid();

    this.placedLayer = this.add.container(0, 0);
    this.renderPlaced(this.opts.initialPlaced);

    this.drawBottle();
    this.createAvatar();
    this.setLighthouse(this.opts.initialLevel);

    if (!this.opts.reducedMotion && this.seaTiles.length > 0) {
      this.time.addEvent({
        delay: 720,
        loop: true,
        callback: () => {
          this.seaFrame ^= 1;
          const key = `tile-sea-${this.seaFrame}`;
          this.seaTiles.forEach((t) => t.setTexture(key));
        },
      });
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      this.moveAvatarTo(pointer.worldX, pointer.worldY);
    });

    this.opts.onReady();
  }

  private buildTextures() {
    makePixelTexture(this, 'tile-grass', tileGrass(), PAL);
    makePixelTexture(this, 'tile-sand', tileSand(), PAL);
    makePixelTexture(this, 'tile-sea-0', tileSea(0), PAL);
    makePixelTexture(this, 'tile-sea-1', tileSea(1), PAL);
    makePixelTexture(this, 'tile-path', tilePath(), PAL);
    makePixelTexture(this, 'obj-lighthouse', spriteLighthouse(), PAL);
    makePixelTexture(this, 'obj-cabin', spriteCabin(), PAL);
    makePixelTexture(this, 'obj-bottle', spriteBottle(), PAL);
    (['sofa', 'plant', 'chair', 'books', 'flowers', 'lamp'] as FurnitureId[]).forEach((id) =>
      makePixelTexture(this, `furn-${id}`, spriteFurniture(id), PAL),
    );

    const pal = bodyPalette(this.opts.avatarBody);
    makePixelTexture(this, 'av-down-0', drawAvatarDown(0), pal);
    makePixelTexture(this, 'av-down-1', drawAvatarDown(1), pal);
    makePixelTexture(this, 'av-side-0', drawAvatarSide(0), pal);
    makePixelTexture(this, 'av-side-1', drawAvatarSide(1), pal);
    makePixelTexture(this, 'av-up-0', drawAvatarUp(0), pal);
    makePixelTexture(this, 'av-up-1', drawAvatarUp(1), pal);
  }

  private drawTerrain() {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const type = tileAt(c, r);
        const key = type === 'grass' && isPathTile(c, r) ? 'tile-path' : `tile-${type}`;
        const img = this.add
          .image(c * TILE, r * TILE, type === 'sea' ? 'tile-sea-0' : key)
          .setOrigin(0, 0)
          .setDepth(0);
        if (type === 'sea') this.seaTiles.push(img);
      }
    }
  }

  private drawLighthouse() {
    const x = LIGHTHOUSE.col * TILE;
    const y = LIGHTHOUSE.row * TILE;
    this.add.image(x, y, 'obj-lighthouse').setOrigin(0.5, 0.9).setDepth(y);
    this.beam = this.add.triangle(x, y - 24, 0, 0, 40, -16, 40, 16, 0xffe9a8, 0).setDepth(y - 1);
    this.lamp = this.add.rectangle(x, y - 24, 4, 3, 0xffe07a, 0.4).setDepth(y + 1);
  }

  private drawCabin() {
    const x = CABIN.col * TILE;
    const y = CABIN.row * TILE;
    this.add.image(x, y, 'obj-cabin').setOrigin(0.5, 0.85).setDepth(y);
  }

  private drawDecorateGrid() {
    this.gridOutline = this.add.container(0, 0).setDepth(1).setVisible(false);
    for (let gy = 0; gy < GRID_ROWS; gy += 1) {
      for (let gx = 0; gx < GRID_COLS; gx += 1) {
        const { x, y } = cellToWorld(gx, gy);
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.85);
        g.fillRect(x - 7, y - 7, 14, 1);
        g.fillRect(x - 7, y + 6, 14, 1);
        g.fillRect(x - 7, y - 7, 1, 14);
        g.fillRect(x + 6, y - 7, 1, 14);
        this.gridOutline.add(g);

        const zone = this.add.zone(x, y, TILE, TILE).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.opts.onCellTap(gx, gy));
      }
    }
  }

  private drawBottle() {
    const x = BOTTLE.col * TILE;
    const y = BOTTLE.row * TILE;
    const glow = this.add.rectangle(x, y - 2, 14, 14, 0xffe9a8, 0.5).setDepth(y - 1);
    if (!this.opts.reducedMotion) {
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.5, to: 0.12 },
        scale: { from: 0.8, to: 1.25 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
    this.add.image(x, y, 'obj-bottle').setOrigin(0.5, 0.8).setDepth(y);
    const hit = this.add.zone(x, y - 4, 18, 22).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.opts.onBottleTap(SEURAT_BOTTLE_ID));
  }

  private createAvatar() {
    const mk = (key: string, dir: 'down' | 'side' | 'up') =>
      this.anims.create({
        key,
        frames: [{ key: `av-${dir}-0` }, { key: `av-${dir}-1` }],
        frameRate: 5,
        repeat: -1,
      });
    mk('walk-down', 'down');
    mk('walk-up', 'up');
    mk('walk-side', 'side');

    const x = AVATAR_START.col * TILE;
    const y = AVATAR_START.row * TILE;
    this.avatar = this.add.sprite(x, y, 'av-down-0').setOrigin(0.5, 0.9).setDepth(y);
  }

  private idleTexture() {
    return this.facing === 'up' ? 'av-up-0' : this.facing === 'down' ? 'av-down-0' : 'av-side-0';
  }

  private moveAvatarTo(tx: number, ty: number) {
    const x = Phaser.Math.Clamp(tx, TILE * 0.5, WORLD_W - TILE * 0.5);
    const y = Phaser.Math.Clamp(ty, TILE, WORLD_H - TILE * 0.5);
    this.moveTween?.stop();

    const dx = x - this.avatar.x;
    const dy = y - this.avatar.y;
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';

    if (this.opts.reducedMotion) {
      this.avatar.setPosition(Math.round(x), Math.round(y)).setDepth(y);
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

    const dist = Math.hypot(dx, dy);
    this.moveTween = this.tweens.add({
      targets: this.avatar,
      x,
      y,
      duration: Math.max(120, (dist / WALK_SPEED) * 1000),
      ease: 'Linear',
      onUpdate: () => this.avatar.setDepth(this.avatar.y),
      onComplete: () => {
        this.avatar.anims.stop();
        this.avatar.setTexture(this.idleTexture());
      },
    });
  }

  // ── React 제어 (create 이전 호출 대비 객체 존재 가드) ─────────────────
  setMode(mode: 'explore' | 'decorate') {
    if (!this.gridOutline) return;
    this.gridOutline.setVisible(mode === 'decorate');
  }

  renderPlaced(items: PlacedItem[]) {
    if (!this.placedLayer) return;
    this.placedLayer.removeAll(true);
    items.forEach(({ item, x: gx, y: gy }) => {
      const { x, y } = cellToWorld(gx, gy);
      const img = this.add.image(x, y + 5, `furn-${item}`).setOrigin(0.5, 1).setDepth(y);
      this.placedLayer.add(img);
    });
  }

  setLighthouse(level: number) {
    if (!this.beam || !this.lamp) return;
    const lit = level > 0;
    this.lamp.setFillStyle(0xffe07a, lit ? 1 : 0.4);
    this.beam.setFillStyle(0xffe9a8, lit ? 0.3 : 0);
    this.tweens.killTweensOf(this.beam);
    this.beam.setAngle(0);
    if (lit && !this.opts.reducedMotion) {
      this.tweens.add({
        targets: this.beam,
        angle: { from: -28, to: 28 },
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
    const flash = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0xfff4d0, 0).setDepth(1000);
    this.tweens.add({ targets: flash, alpha: { from: 0.5, to: 0 }, duration: 650, onComplete: () => flash.destroy() });

    const lx = LIGHTHOUSE.col * TILE;
    const ly = LIGHTHOUSE.row * TILE - 24;
    for (let i = 0; i < 10; i += 1) {
      const spark = this.add.rectangle(lx, ly, 3, 3, i % 2 ? 0xffffff : 0xffe07a).setDepth(1001);
      const ang = (i / 10) * Math.PI * 2;
      this.tweens.add({
        targets: spark,
        x: lx + Math.cos(ang) * 46,
        y: ly + Math.sin(ang) * 46,
        alpha: { from: 1, to: 0 },
        duration: 850,
        ease: 'Cubic.out',
        onComplete: () => spark.destroy(),
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
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#4ea6cc',
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
