import type Phaser from 'phaser';
import {
  FURNITURE,
  GRID_COLS,
  GRID_ROWS,
  SEURAT_BOTTLE_ID,
  type IslandSave,
  type PlacedItem,
} from '@/lib/island/island-state';
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
const GUIDANCE_IDLE_DELAY_MS = 7_000;
const GUIDANCE_STEP_GAP = TILE * 1.35;
const GUIDANCE_MAX_DISTANCE = TILE * 7;
const GUIDANCE_REBUILD_DISTANCE = TILE * 1.5;
const REWARD_BURST_SPARKS = 8;
const REWARD_BURST_DURATION_MS = 620;
const PLACED_POP_DURATION_MS = 460;
const HUD_COUNTER_DURATION_MS = 520;

const LIGHTHOUSE = { col: 36, row: 23 } as const;
const CABIN = { col: 26, row: 37 } as const;
const BOTTLE = { col: 30, row: 61 } as const;
const DOCK = { col: 30, row: 79 } as const;
const GRID_ORIGIN = { col: 28, row: 39 } as const;

const WHITE = Number.parseInt(PAL.W.slice(1), 16);
const LAMP_YELLOW = Number.parseInt(PAL.Y.slice(1), 16);
const LIGHT_GLOW = LAMP_YELLOW;
const CELEBRATION_FLASH = LAMP_YELLOW;
const GUIDANCE_GOLD = LAMP_YELLOW;
const GUIDANCE_CREAM = Number.parseInt(PAL.L.slice(1), 16);
const GUIDANCE_EDGE = Number.parseInt(PAL.q.slice(1), 16);

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

export type IslandGuidanceTarget = 'bottle' | 'cabin' | null;

/** 저장 스키마를 늘리지 않고 지금 바로 할 수 있는 다음 행동만 고른다. */
export function guidanceTargetForSave(save: IslandSave): IslandGuidanceTarget {
  if (!save.bottlesOpened.includes(SEURAT_BOTTLE_ID)) return 'bottle';
  if (save.pieces > 0) return 'cabin';
  return null;
}

export interface IslandPropsOptions {
  reducedMotion: boolean;
  guidanceTarget: IslandGuidanceTarget;
  getGuidanceOrigin: () => { x: number; y: number } | null;
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
  private placedItemKeys = new Set<string>();
  private hasRenderedPlaced = false;
  private pendingPlaced: PlacedItem[] = [];
  private pendingLevel = 0;
  private pendingCelebration = false;
  private guidanceTarget: IslandGuidanceTarget;
  private guidancePath?: Phaser.GameObjects.Container;
  private guidanceBeacon?: Phaser.GameObjects.Container;
  private guidanceIdleTimer?: Phaser.Time.TimerEvent;
  private guidancePulseShown = false;
  private guidanceOrigin?: { x: number; y: number };
  private mode: 'explore' | 'decorate' = 'explore';
  private built = false;

  constructor(scene: Phaser.Scene, opts: IslandPropsOptions) {
    this.scene = scene;
    this.opts = opts;
    this.guidanceTarget = opts.guidanceTarget;
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
    this.drawGuidance();
    this.scene.input.on('pointerdown', this.noteGuidanceActivity, this);
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
    const bottle = this.scene.add.image(x, y, PROP_ATLAS, BOTTLE_FRAME).setOrigin(0.5, 0.8).setDepth(y);
    const hit = this.scene.add.zone(x, y - 4, 24, 24).setDepth(y + 2).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      if (!this.opts.reducedMotion) {
        this.scene.tweens.killTweensOf(bottle);
        this.scene.tweens.add({
          targets: bottle,
          scaleX: { from: 0.76, to: 1 },
          scaleY: { from: 0.76, to: 1 },
          angle: { from: -8, to: 0 },
          duration: PLACED_POP_DURATION_MS,
          ease: 'Back.out',
        });
        this.burstSparkles(x, y - TILE * 0.45, TILE * 2.2, y + 3);
      }
      this.opts.onBottleTap(SEURAT_BOTTLE_ID);
    });
  }

  private burstSparkles(x: number, y: number, radius: number, depth: number): void {
    if (this.opts.reducedMotion) return;
    for (let index = 0; index < REWARD_BURST_SPARKS; index += 1) {
      const angle = (index / REWARD_BURST_SPARKS) * Math.PI * 2;
      const spark = this.scene.add
        .image(x, y, PROP_ATLAS, SPARKLE_FRAME)
        .setDepth(depth)
        .setScale(0.65);
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        scale: { from: 0.65, to: 1.15 },
        alpha: { from: 1, to: 0 },
        duration: REWARD_BURST_DURATION_MS,
        ease: 'Cubic.out',
        onComplete: () => spark.destroy(),
      });
    }
  }

  private animateHudCounter(direction: 'increase' | 'decrease'): void {
    if (this.opts.reducedMotion) return;
    const counter = this.scene.game.canvas.closest('.dot-shell')?.querySelector<HTMLElement>('.dot-counter');
    if (!counter) return;
    counter.getAnimations().forEach((animation) => animation.cancel());
    const middle = direction === 'increase'
      ? { transform: 'translateY(-12%) scale(1.24)' }
      : { transform: 'translateY(10%) scale(0.82)' };
    counter.animate(
      [
        { transform: 'translateY(0) scale(1)' },
        middle,
        { transform: 'translateY(0) scale(1)' },
      ],
      {
        duration: HUD_COUNTER_DURATION_MS,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    );
  }

  private guidanceDestination(): { x: number; y: number } | null {
    if (this.guidanceTarget === 'bottle') {
      return { x: BOTTLE.col * TILE, y: BOTTLE.row * TILE - TILE * 0.35 };
    }
    if (this.guidanceTarget === 'cabin') {
      return {
        x: (GRID_ORIGIN.col + GRID_COLS / 2) * TILE,
        y: (GRID_ORIGIN.row + GRID_ROWS / 2) * TILE,
      };
    }
    return null;
  }

  private clearGuidancePath(): void {
    if (!this.guidancePath) return;
    this.scene.tweens.killTweensOf([this.guidancePath, ...this.guidancePath.getAll()]);
    this.guidancePath.destroy(true);
    this.guidancePath = undefined;
  }

  private clearGuidance(): void {
    this.guidanceIdleTimer?.remove(false);
    this.guidanceIdleTimer = undefined;
    this.clearGuidancePath();
    if (this.guidanceBeacon) {
      this.scene.tweens.killTweensOf([this.guidanceBeacon, ...this.guidanceBeacon.getAll()]);
      this.guidanceBeacon.destroy(true);
      this.guidanceBeacon = undefined;
    }
    this.guidanceOrigin = undefined;
  }

  private makeFootprint(x: number, y: number, angle: number, index: number): Phaser.GameObjects.Graphics {
    const footprint = this.scene.add.graphics({ x, y });
    footprint.fillStyle(index % 2 === 0 ? GUIDANCE_GOLD : GUIDANCE_CREAM, 0.88);
    footprint.fillEllipse(-TILE * 0.12, 0, TILE * 0.2, TILE * 0.32);
    footprint.fillCircle(TILE * 0.04, -TILE * 0.14, TILE * 0.07);
    footprint.setRotation(angle + (index % 2 === 0 ? -0.08 : 0.08));
    return footprint;
  }

  private rebuildGuidancePath(origin: { x: number; y: number }, destination: { x: number; y: number }): void {
    this.clearGuidancePath();
    this.guidanceOrigin = origin;

    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance < TILE) return;

    const angle = Math.atan2(dy, dx);
    const visibleDistance = Math.min(distance - TILE * 0.45, GUIDANCE_MAX_DISTANCE);
    const stepCount = Math.max(2, Math.floor(visibleDistance / GUIDANCE_STEP_GAP));
    const children: Phaser.GameObjects.GameObject[] = [];

    for (let index = 0; index < stepCount; index += 1) {
      const along = Math.min(visibleDistance, TILE * 0.9 + index * GUIDANCE_STEP_GAP);
      const side = (index % 2 === 0 ? -1 : 1) * TILE * 0.13;
      const x = origin.x + Math.cos(angle) * along - Math.sin(angle) * side;
      const y = origin.y + Math.sin(angle) * along + Math.cos(angle) * side;
      const footprint = this.makeFootprint(x, y, angle, index);
      children.push(footprint);

      if (!this.opts.reducedMotion) {
        footprint.setAlpha(0.45);
        this.scene.tweens.add({
          targets: footprint,
          alpha: 1,
          duration: 620,
          delay: index * 150,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
      }
    }

    const arrowDistance = Math.min(distance - TILE * 0.25, visibleDistance + TILE * 0.5);
    const arrowX = origin.x + Math.cos(angle) * arrowDistance;
    const arrowY = origin.y + Math.sin(angle) * arrowDistance;
    const arrow = this.scene.add.graphics({ x: arrowX, y: arrowY });
    arrow.fillStyle(GUIDANCE_GOLD, 0.96);
    arrow.lineStyle(TILE * 0.08, GUIDANCE_EDGE, 0.9);
    arrow.fillTriangle(TILE * 0.48, 0, -TILE * 0.36, -TILE * 0.34, -TILE * 0.36, TILE * 0.34);
    arrow.strokeTriangle(TILE * 0.48, 0, -TILE * 0.36, -TILE * 0.34, -TILE * 0.36, TILE * 0.34);
    arrow.setRotation(angle);
    children.push(arrow);

    const path = this.scene.add.container(0, 0, children).setDepth(origin.y - 1);
    this.guidancePath = path;
    if (!this.opts.reducedMotion) {
      this.scene.tweens.add({
        targets: arrow,
        x: arrowX + Math.cos(angle) * TILE * 0.28,
        y: arrowY + Math.sin(angle) * TILE * 0.28,
        duration: 540,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  private drawGuidance(): void {
    this.clearGuidance();
    const destination = this.guidanceDestination();
    const origin = this.opts.getGuidanceOrigin();
    if (!destination || !origin) return;

    const ring = this.scene.add.graphics();
    ring.lineStyle(TILE * 0.14, GUIDANCE_GOLD, 0.9);
    ring.strokeCircle(0, 0, TILE * 0.9);
    ring.lineStyle(TILE * 0.07, GUIDANCE_CREAM, 0.82);
    ring.strokeCircle(0, 0, TILE * 1.18);
    const sparkle = this.scene.add.image(0, -TILE * 1.25, PROP_ATLAS, SPARKLE_FRAME);
    this.guidanceBeacon = this.scene.add
      .container(destination.x, destination.y, [ring, sparkle])
      .setDepth(destination.y + 2);

    if (!this.opts.reducedMotion) {
      this.scene.tweens.add({
        targets: sparkle,
        alpha: { from: 0.35, to: 1 },
        angle: { from: -12, to: 12 },
        duration: 760,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }

    this.rebuildGuidancePath(origin, destination);
    this.scheduleGuidancePulse();
  }

  private scheduleGuidancePulse(): void {
    this.guidanceIdleTimer?.remove(false);
    this.guidanceIdleTimer = undefined;
    if (this.opts.reducedMotion || this.guidancePulseShown || !this.guidanceBeacon) return;
    this.guidanceIdleTimer = this.scene.time.delayedCall(GUIDANCE_IDLE_DELAY_MS, () => {
      this.guidancePulseShown = true;
      const targets = [this.guidanceBeacon, this.guidancePath].filter(
        (target): target is Phaser.GameObjects.Container => Boolean(target?.active),
      );
      this.scene.tweens.add({
        targets,
        scale: 1.22,
        alpha: 1,
        duration: 360,
        yoyo: true,
        ease: 'Sine.inOut',
      });
    });
  }

  private noteGuidanceActivity(): void {
    if (!this.guidanceTarget || this.guidancePulseShown) return;
    this.scheduleGuidancePulse();
  }

  updateGuidanceOrigin(x: number, y: number): void {
    const destination = this.guidanceDestination();
    if (!this.built || !destination) return;
    if (this.guidanceOrigin && Math.hypot(x - this.guidanceOrigin.x, y - this.guidanceOrigin.y) < GUIDANCE_REBUILD_DISTANCE) {
      return;
    }
    this.rebuildGuidancePath({ x, y }, destination);
    this.scheduleGuidancePulse();
  }

  setGuidanceTarget(target: IslandGuidanceTarget): void {
    if (target === this.guidanceTarget) return;
    this.guidanceTarget = target;
    this.guidancePulseShown = false;
    if (this.built) this.drawGuidance();
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
    const nextKeys = new Set(items.map(({ item, x, y }) => `${item}:${x}:${y}`));
    const newKeys = this.hasRenderedPlaced
      ? new Set([...nextKeys].filter((key) => !this.placedItemKeys.has(key)))
      : new Set<string>();
    this.placedItems.forEach((item) => item.destroy());
    this.placedItems = items.map(({ item, x: gx, y: gy }) => {
      const { x, y } = cellToWorld(gx, gy);
      const furniture = FURNITURE.find(({ id }) => id === item);
      if (!furniture) return this.scene.add.container(x, y + 5);
      const { stamp } = furniture;
      const placed = addFrameGrid(
        this.scene,
        x,
        y + 5,
        stamp.prefix,
        stamp.startRow,
        stamp.startColumn,
        stamp.rows,
        stamp.columns,
      );
      if (newKeys.has(`${item}:${gx}:${gy}`) && !this.opts.reducedMotion) {
        placed.setScale(0.52).setAlpha(0.35);
        this.scene.tweens.add({
          targets: placed,
          scale: 1,
          alpha: 1,
          duration: PLACED_POP_DURATION_MS,
          ease: 'Back.out',
        });
        this.burstSparkles(
          x,
          y - (stamp.rows * TILE) / 2,
          Math.max(stamp.rows, stamp.columns) * TILE * 0.72,
          y + 6,
        );
      }
      return placed;
    });
    this.placedItemKeys = nextKeys;
    this.hasRenderedPlaced = true;
    if (newKeys.size > 0) this.animateHudCounter('decrease');
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
    this.scene.time.delayedCall(0, () => this.animateHudCounter('increase'));
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
