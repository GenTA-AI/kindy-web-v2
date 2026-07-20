import Phaser from 'phaser';
import {
  IslandScene,
  type IslandEngineOptions,
} from '@/components/island/engine';
import { WORLD_BACKGROUND } from '@/components/island/map';
import type { PlacedItem } from '@/lib/island/island-state';
import type { AvatarConfig } from '@/lib/world/world-state';

/**
 * 등대섬의 클라이언트 전용 조립 엔트리. 씬 구현은 책임별 모듈에 두고
 * React 쪽에는 기존의 작은 명령형 핸들만 노출한다.
 */
export type IslandGameOptions = IslandEngineOptions;

export interface IslandGameHandle {
  destroy(): void;
  setMode(mode: 'explore' | 'decorate'): void;
  renderPlaced(items: PlacedItem[]): void;
  celebrate(): void;
  setAvatar(avatar: AvatarConfig): void;
  setLighthouse(level: number): void;
}

export function createIslandGame(parent: HTMLElement, opts: IslandGameOptions): IslandGameHandle {
  const scene = new IslandScene(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: Math.max(1, Math.floor(parent.clientWidth)),
    height: Math.max(1, Math.floor(parent.clientHeight)),
    pixelArt: true,
    roundPixels: true,
    backgroundColor: WORLD_BACKGROUND,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene,
  });

  return {
    destroy: () => game.destroy(true),
    setMode: (mode) => scene.setMode(mode),
    renderPlaced: (items) => scene.renderPlaced(items),
    celebrate: () => scene.celebrate(),
    setAvatar: (avatar) => scene.setAvatar(avatar),
    setLighthouse: (level) => scene.setLighthouse(level),
  };
}
