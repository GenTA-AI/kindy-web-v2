import type Phaser from 'phaser';
import { FURNITURE, GRID_COLS, GRID_ROWS, SEURAT_BOTTLE_ID, type PlacedItem } from '@/lib/island/island-state';
import { PAL } from '@/components/island/pixel-art';
import { atlasFrameName, atlasFrameStyle } from '@/components/island/atlas-frames';
import { TILE, WORLD_HEIGHT, WORLD_WIDTH } from '@/components/island/map';

const PROP_ATLAS = 'island-props-pack';
const WATER_ATLAS = 'island-water-props';
const PROP_ATLAS_URL = '/island/tiles/props.png';
const PROP_ATLAS_JSON_URL = '/island/tiles/props.json';
const WATER_ATLAS_URL = '/island/tiles/water.png';
const WATER_ATLAS_JSON_URL = '/island/tiles/water.json';
const CATALOG_ICON_SCALE = 2;

const LIGHTHOUSE = { col: 36, row: 23 } as const;
const CABIN = { col: 26, row: 37 } as const;
const BOTTLE = { col: 30, row: 61 } as const;
const DOCK = { col: 30, row: 79 } as const;
const GRID_ORIGIN = { col: 28, row: 39 } as const;

const WHITE = Number.parseInt(PAL.W.slice(1), 16);
const LAMP_YELLOW = Number.parseInt(PAL.Y.slice(1), 16);
const LIGHT_GLOW = LAMP_YELLOW;
const CELEBRATION_FLASH = LAMP_YELLOW;

const TREE_POSITIONS = [
  { col: 17, row: 31, small: false },
  { col: 43, row: 33, small: false },
  { col: 18, row: 48, small: true },
  { col: 42, row: 50, small: true },
] as const;

const BUSH_POSITIONS = [
  { col: 22, row: 36, frame: 'flowers__r006_c000' },
  { col: 34, row: 40, frame: 'flowers__r006_c001' },
  { col: 24, row: 51, frame: 'flowers__r007_c002' },
  { col: 37, row: 54, frame: 'flowers__r007_c003' },
] as const;

const FOAM_POSITIONS = [
  { col: 13, row: 69, delay: 0 },
  { col: 20, row: 74, delay: 240 },
  { col: 39, row: 74, delay: 480 },
  { col: 46, row: 69, delay: 720 },
] as const;

const BOTTLE_FRAME = 'placeable-decoration__r000_c001';
const SPARKLE_FRAME = 'placeable-decoration__r000_c005';
const LIGHTHOUSE_LAMP_FRAME = 'lantern__r000_c000';
const BUTTERFLY_FRAMES = [0, 1, 2, 3].map((row) => atlasFrameName('butterfly', row, 0));

export interface IslandPropsOptions {
  reducedMotion: boolean;
  onBottleTap: (bottleId: string) => void;
  onCellTap: (gx: number, gy: number) => void;
}

/** Phaser 씬이 만들어진 뒤에도 안전하게 시작할 수 있는 보조 로더. */
export function registerPropTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PROP_ATLAS)) {
    scene.load.atlas(PROP_ATLAS, PROP_ATLAS_URL, PROP_ATLAS_JSON_URL);
  }
  if (!scene.textures.exists(WATER_ATLAS)) {
    scene.load.atlas(WATER_ATLAS, WATER_ATLAS_URL, WATER_ATLAS_JSON_URL);
  }
  if (!scene.load.isLoading()) scene.load.start();
}

/** DOM 카탈로그도 게임과 같은 팩 프레임을 정수 배율로 잘라 쓴다. */
export function propCatalogIconStyle(frame: string) {
  return atlasFrameStyle('props', frame, CATALOG_ICON_SCALE);
}

export function cellToWorld(gx: number, gy: number): { x: number; y: number } {
  return {
    x: (GRID_ORIGIN.col + gx + 0.5) * TILE,
    y: (GRID_ORIGIN.row + gy + 0.5) * TILE,
  };
}

function frameName(prefix: string, row: number, col: number): string {
  return atlasFrameName(prefix, row, col);
}

function addFrameGrid(
  scene: Phaser.Scene,
  x: number,
  baseY: number,
  prefix: string,
  startRow: number,
  startCol: number,
  rows: number,
  cols: number,
): Phaser.GameObjects.Container {
  const top = -rows * TILE;
  const left = -(cols * TILE) / 2;
  const children: Phaser.GameObjects.Image[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      children.push(
        scene.add
          .image(left + col * TILE, top + row * TILE, PROP_ATLAS, frameName(prefix, startRow + row, startCol + col))
          .setOrigin(0),
      );
    }
  }
  return scene.add.container(x, baseY, children).setDepth(baseY);
}

export class IslandProps {
  private readonly scene: Phaser.Scene;
  private readonly opts: IslandPropsOptions;
  private lamp?: Phaser.GameObjects.Image;
  private beam?: Phaser.GameObjects.Triangle;
  private gridOutline?: Phaser.GameObjects.Container;
  private gridZone?: Phaser.GameObjects.Zone;
  private placedItems: Phaser.GameObjects.Container[] = [];
  private pendingPlaced: PlacedItem[] = [];
  private pendingLevel = 0;
  private pendingCelebration = false;
  private mode: 'explore' | 'decorate' = 'explore';
  private built = false;

  constructor(scene: Phaser.Scene, opts: IslandPropsOptions) {
    this.scene = scene;
    this.opts = opts;
  }

  create(initialPlaced: PlacedItem[], initialLevel: number): void {
    this.pendingPlaced = initialPlaced;
    this.pendingLevel = initialLevel;
    if (this.atlasesReady()) {
      this.build();
      return;
    }
    this.scene.load.once('complete', () => {
      if (this.atlasesReady()) this.build();
    });
  }

  private atlasesReady(): boolean {
    return this.scene.textures.exists(PROP_ATLAS) && this.scene.textures.exists(WATER_ATLAS);
  }

  private build(): void {
    if (this.built) return;
    this.built = true;
    this.drawWaveFoam();
    this.drawLighthouse();
    this.drawCabin();
    this.drawDock();
    this.drawLandscape();
    this.drawDecorateGrid();
    this.renderPlaced(this.pendingPlaced);
    this.drawBottle();
    this.drawButterflies();
    this.setMode(this.mode);
    this.setLighthouse(this.pendingLevel);
    if (this.pendingCelebration) {
      this.pendingCelebration = false;
      this.celebrate();
    }
  }

  private drawLighthouse(): void {
    const x = LIGHTHOUSE.col * TILE;
    const y = LIGHTHOUSE.row * TILE;
    addFrameGrid(this.scene, x, y, 'lighthouse-tower', 0, 0, 5, 3);
    this.beam = this.scene.add
      .triangle(x + 3, y - 82, 0, 0, 48, -13, 48, 13, LIGHT_GLOW, 0)
      .setOrigin(0, 0.5)
      .setDepth(y - 1);
    this.lamp = this.scene.add
      .image(x, y - 80, PROP_ATLAS, LIGHTHOUSE_LAMP_FRAME)
      .setDepth(y + 1);
  }

  private drawCabin(): void {
    addFrameGrid(this.scene, CABIN.col * TILE, CABIN.row * TILE, 'house-1-wood-base-blue', 0, 0, 8, 6);
  }

  private drawDock(): void {
    addFrameGrid(this.scene, DOCK.col * TILE, DOCK.row * TILE, 'bridge-wood', 0, 0, 4, 3);
  }

  private drawLandscape(): void {
    TREE_POSITIONS.forEach(({ col, row, small }) => {
      if (small) {
        addFrameGrid(this.scene, col * TILE, row * TILE, 'oak-tree-small', 0, 2, 3, 2);
      } else {
        addFrameGrid(this.scene, col * TILE, row * TILE, 'oak-tree', 0, 4, 5, 4);
      }
    });
    BUSH_POSITIONS.forEach(({ col, row, frame }) => {
      const y = row * TILE;
      this.scene.add.image(col * TILE, y, PROP_ATLAS, frame).setOrigin(0.5, 1).setDepth(y);
    });
  }

  private drawWaveFoam(): void {
    const frames = [0, 1, 2].map((col) => ({
      key: WATER_ATLAS,
      frame: `water-decoration__r000_c00${col}`,
    }));
    if (!this.opts.reducedMotion && !this.scene.anims.exists('island-shore-foam')) {
      this.scene.anims.create({ key: 'island-shore-foam', frames, frameRate: 3, repeat: -1, yoyo: true });
    }
    FOAM_POSITIONS.forEach(({ col, row, delay }) => {
      const foam = this.scene.add
        .sprite(col * TILE, row * TILE, WATER_ATLAS, 'water-decoration__r000_c001')
        .setDepth(0.5);
      if (!this.opts.reducedMotion) foam.playAfterDelay('island-shore-foam', delay);
    });
  }

  private drawButterflies(): void {
    if (!this.opts.reducedMotion && !this.scene.anims.exists('island-butterfly-fly')) {
      this.scene.anims.create({
        key: 'island-butterfly-fly',
        frames: BUTTERFLY_FRAMES.map((frame) => ({ key: PROP_ATLAS, frame })),
        frameRate: 4,
        repeat: -1,
      });
    }
    const butterflies = [
      { x: 13 * TILE, y: 17 * TILE, duration: 14_000 },
      { x: 39 * TILE, y: 13 * TILE, duration: 17_000 },
    ];
    butterflies.forEach(({ x, y, duration }, index) => {
      const butterfly = this.scene.add
        .sprite(x, y, PROP_ATLAS, BUTTERFLY_FRAMES[0])
        .setDepth(WORLD_HEIGHT + index);
      if (!this.opts.reducedMotion) butterfly.play('island-butterfly-fly');
      if (this.opts.reducedMotion) return;
      this.scene.tweens.add({
        targets: butterfly,
        x: { from: -TILE, to: WORLD_WIDTH + TILE },
        duration,
        delay: index * 1800,
        repeat: -1,
        ease: 'Linear',
      });
      this.scene.tweens.add({
        targets: butterfly,
        y: y + (index === 0 ? TILE : -TILE),
        duration: 1800 + index * 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    });
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
    const sparkle = this.scene.add.image(x + 6, y - 13, PROP_ATLAS, SPARKLE_FRAME).setDepth(y + 1);
    if (!this.opts.reducedMotion) {
      this.scene.tweens.add({
        targets: sparkle,
        alpha: { from: 1, to: 0.2 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
    this.scene.add.image(x, y, PROP_ATLAS, BOTTLE_FRAME).setOrigin(0.5, 0.8).setDepth(y);
    const hit = this.scene.add.zone(x, y - 4, 24, 24).setDepth(y + 2).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.opts.onBottleTap(SEURAT_BOTTLE_ID));
  }

  setMode(mode: 'explore' | 'decorate'): void {
    this.mode = mode;
    const decorating = mode === 'decorate';
    this.gridOutline?.setVisible(decorating);
    if (this.gridZone?.input) this.gridZone.input.enabled = decorating;
  }

  renderPlaced(items: PlacedItem[]): void {
    this.pendingPlaced = items;
    if (!this.built) return;
    this.placedItems.forEach((item) => item.destroy());
    this.placedItems = items.map(({ item, x: gx, y: gy }) => {
      const { x, y } = cellToWorld(gx, gy);
      const furniture = FURNITURE.find(({ id }) => id === item);
      if (!furniture) return this.scene.add.container(x, y + 5);
      const { stamp } = furniture;
      return addFrameGrid(
        this.scene,
        x,
        y + 5,
        stamp.prefix,
        stamp.startRow,
        stamp.startColumn,
        stamp.rows,
        stamp.columns,
      );
    });
  }

  setLighthouse(level: number): void {
    this.pendingLevel = level;
    if (!this.beam || !this.lamp) return;
    const lit = level > 0;
    this.lamp.setAlpha(lit ? 1 : 0.45);
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
    if (!this.built || !this.beam) {
      this.pendingLevel = Math.max(1, this.pendingLevel);
      this.pendingCelebration = true;
      return;
    }
    this.setLighthouse(1);
    if (this.opts.reducedMotion) return;
    const flash = this.scene.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, CELEBRATION_FLASH, 0)
      .setDepth(WORLD_HEIGHT + 20);
    this.scene.tweens.add({
      targets: flash,
      alpha: { from: 0.35, to: 0 },
      duration: 650,
      onComplete: () => flash.destroy(),
    });

    const x = LIGHTHOUSE.col * TILE;
    const y = LIGHTHOUSE.row * TILE - 82;
    for (let index = 0; index < 8; index += 1) {
      const spark = this.scene.add.image(x, y, PROP_ATLAS, SPARKLE_FRAME).setDepth(WORLD_HEIGHT + 21);
      const angle = (index / 8) * Math.PI * 2;
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
