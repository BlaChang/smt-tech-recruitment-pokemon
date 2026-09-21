import type { Input } from './input';
import type { Renderer } from './renderer';

export interface Scene {
  onEnter?(): void;
  onExit?(): void;
  update(input: Input): void;
  render(r: Renderer): void;
}

/**
 * Scenes stack rather than replace: the battle sits on top of the overworld,
 * and popping it restores the map exactly as it was left.
 */
export class SceneStack {
  private scenes: Scene[] = [];

  get top(): Scene | undefined {
    return this.scenes[this.scenes.length - 1];
  }

  push(scene: Scene): void {
    this.scenes.push(scene);
    scene.onEnter?.();
  }

  pop(): void {
    const scene = this.scenes.pop();
    scene?.onExit?.();
  }

  /** Only the top scene updates; everything below is frozen. */
  update(input: Input): void {
    this.top?.update(input);
  }

  /** All scenes render, bottom-up, so partial overlays can show the map behind them. */
  render(r: Renderer): void {
    for (const scene of this.scenes) scene.render(r);
  }
}
