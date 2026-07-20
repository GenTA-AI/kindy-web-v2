import type Phaser from 'phaser';
import { GRID_COLS, GRID_ROWS, SEURAT_BOTTLE_ID, type FurnitureId, type PlacedItem } from '@/lib/island/island-state';
import {
  PAL,
  TILE,
  spriteBottle,
  spriteCabin,
  spriteFurniture,
  spriteLighthouse,
} from '@/components/island/pixel-art';
import { WORLD_HEIGHT, WORLD_WIDTH, type PixelTextureFactory } from '@/components/island/map';

const LIGHTHOUSE = { col: 36, row: 23 } as const;
const CABIN = { col: 26, row: 37 } as const;
const BOTTLE = { col: 30, row: 61 } as const;
const GRID_ORIGIN = { col: 28, row: 39 } as const;

const WHITE = Number.parseInt(PAL.W.slice(1), 16);
const LAMP_YELLOW = Number.parseInt(PAL.Y.slice(1), 16);
// 기존 점등 연출 색. 이번 분할에서는 아트 값을 바꾸지 않는다.
const LIGHT_GLOW = 0xffe9a8;
const CELEBRATION_FLASH = 0xfff4d0;

export interface IslandPropsOptions {
  reducedMotion: boolean;
  onBottleTap: (bottleId: string) => void;
  onCellTap: (gx: number, gy: number) => void;
}

export function registerPropTextures(scene: Phaser.Scene, makeTexture: PixelTextureFactory): void {
  makeTexture(scene, 'obj-lighthouse', spriteLighthouse(), PAL);
  makeTexture(scene, 'obj-cabin', spriteCabin(), PAL);
  makeTexture(scene, 'obj-bottle', spriteBottle(), PAL);
  (['sofa', 'plant', 'chair', 'books', 'flowers', 'lamp'] as FurnitureId[]).forEach((id) =>
    makeTexture(scene, `furn-${id}`, spriteFurniture(id), PAL),
  );
}

export function cellToWorld(gx: number, gy: number): { x: number; y: number } {
  return {
    x: (GRID_ORIGIN.col + gx + 0.5) * TILE,
    y: (GRID_ORIGIN.row + gy + 0.5) * TILE,
  };
}

export class IslandProps {
  private readonly scene: Phaser.Scene;
  private readonly opts: IslandPropsOptions;
  private lamp?: Phaser.GameObjects.Rectangle;
  private beam?: Phaser.GameObjects.Triangle;
  private gridOutline?: Phaser.GameObjects.Container;
  private gridZone?: Phaser.GameObjects.Zone;
  private placedItems: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, opts: IslandPropsOptions) {
    this.scene = scene;
    this.opts = opts;
  }

  create(initialPlaced: PlacedItem[], initialLevel: number): void {
    this.drawLighthouse();
    this.drawCabin();
    this.drawDecorateGrid();
    this.renderPlaced(initialPlaced);
    this.drawBottle();
    this.setLighthouse(initialLevel);
  }

  private drawLighthouse(): void {
    const x = LIGHTHOUSE.col * TILE;
    const y = LIGHTHOUSE.row * TILE;
    this.scene.add.image(x, y, 'obj-lighthouse').setOrigin(0.5, 0.9).setDepth(y);
    this.beam = this.scene.add
      .triangle(x, y - 24, 0, 0, 40, -16, 40, 16, LIGHT_GLOW, 0)
      .setDepth(y - 1);
    this.lamp = this.scene.add.rectangle(x, y - 24, 4, 3, LAMP_YELLOW, 0.4).setDepth(y + 1);
  }

  private drawCabin(): void {
    const x = CABIN.col * TILE;
    const y = CABIN.row * TILE;
    this.scene.add.image(x, y, 'obj-cabin').setOrigin(0.5, 0.85).setDepth(y);
  }

  private drawDecorateGrid(): void {
    this.gridOutline = this.scene.add.container(0, 0).setDepth(1).setVisible(false);
    for (let gy = 0; gy < GRID_ROWS; gy += 1) {
      for (let gx = 0; gx < GRID_COLS; gx += 1) {
        const { x, y } = cellToWorld(gx, gy);
        const outline = this.scene.add.graphics();
        outline.fillStyle(WHITE, 0.85);
        outline.fillRect(x - 7, y - 7, 14, 1);
        outline.fillRect(x - 7, y + 6, 14, 1);
        outline.fillRect(x - 7, y - 7, 1, 14);
        outline.fillRect(x + 6, y - 7, 1, 14);
        this.gridOutline.add(outline);
      }
    }

    const left = GRID_ORIGIN.col * TILE;
    const top = GRID_ORIGIN.row * TILE;
    const width = GRID_COLS * TILE;
    const height = GRID_ROWS * TILE;
    this.gridZone = this.scene.add
      .zone(left + width / 2, top + height / 2, width, height)
      .setDepth(top + height)
      .setInteractive({ useHandCursor: true });
    this.gridZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const gx = Math.min(GRID_COLS - 1, Math.max(0, Math.floor((pointer.worldX - left) / TILE)));
      const gy = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor((pointer.worldY - top) / TILE)));
      this.opts.onCellTap(gx, gy);
    });
    if (this.gridZone.input) this.gridZone.input.enabled = false;
  }

  private drawBottle(): void {
    const x = BOTTLE.col * TILE;
    const y = BOTTLE.row * TILE;
    const glow = this.scene.add.rectangle(x, y - 2, 14, 14, LIGHT_GLOW, 0.5).setDepth(y - 1);
    if (!this.opts.reducedMotion) {
      this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.5, to: 0.12 },
        scale: { from: 0.8, to: 1.25 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
    this.scene.add.image(x, y, 'obj-bottle').setOrigin(0.5, 0.8).setDepth(y);
    const hit = this.scene.add.zone(x, y - 4, 24, 24).setDepth(y + 1).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.opts.onBottleTap(SEURAT_BOTTLE_ID));
  }

  setMode(mode: 'explore' | 'decorate'): void {
    const decorating = mode === 'decorate';
    this.gridOutline?.setVisible(decorating);
    if (this.gridZone?.input) this.gridZone.input.enabled = decorating;
  }

  renderPlaced(items: PlacedItem[]): void {
    this.placedItems.forEach((item) => item.destroy());
    this.placedItems = items.map(({ item, x: gx, y: gy }) => {
      const { x, y } = cellToWorld(gx, gy);
      return this.scene.add.image(x, y + 5, `furn-${item}`).setOrigin(0.5, 1).setDepth(y);
    });
  }

  setLighthouse(level: number): void {
    if (!this.beam || !this.lamp) return;
    const lit = level > 0;
    this.lamp.setFillStyle(LAMP_YELLOW, lit ? 1 : 0.4);
    this.beam.setFillStyle(LIGHT_GLOW, lit ? 0.3 : 0);
    this.scene.tweens.killTweensOf(this.beam);
    this.beam.setAngle(0);
    if (lit && !this.opts.reducedMotion) {
      this.scene.tweens.add({
        targets: this.beam,
        angle: { from: -28, to: 28 },
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  celebrate(): void {
    if (!this.beam) return;
    this.setLighthouse(1);
    const flash = this.scene.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, CELEBRATION_FLASH, 0)
      .setDepth(1000);
    this.scene.tweens.add({
      targets: flash,
      alpha: { from: 0.5, to: 0 },
      duration: 650,
      onComplete: () => flash.destroy(),
    });

    const x = LIGHTHOUSE.col * TILE;
    const y = LIGHTHOUSE.row * TILE - 24;
    for (let index = 0; index < 10; index += 1) {
      const spark = this.scene.add.rectangle(x, y, 3, 3, index % 2 ? WHITE : LAMP_YELLOW).setDepth(1001);
      const angle = (index / 10) * Math.PI * 2;
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * 46,
        y: y + Math.sin(angle) * 46,
        alpha: { from: 1, to: 0 },
        duration: 850,
        ease: 'Cubic.out',
        onComplete: () => spark.destroy(),
      });
    }
  }
}
