/**
 * Image loading with graceful degradation. A missing file is never fatal:
 * `get()` returns null and every draw site falls back to its placeholder
 * rectangle. That lets art arrive one file at a time instead of all at once.
 */

export interface SheetSpec {
  /** Path under public/, e.g. "assets/characters/player.png". */
  src: string;
  /** Size of one animation frame in the sheet. */
  frameW: number;
  frameH: number;
  /**
   * Many GBA rips ship only a left-facing row and mirror it for right.
   * When true, the right direction reuses the left row, flipped.
   */
  mirrorRight?: boolean;
}

export type Manifest = Record<string, SheetSpec>;

export class AssetStore {
  private images = new Map<string, HTMLImageElement>();
  private specs: Manifest = {};
  readonly missing: string[] = [];

  /** Resolves once every image has either loaded or failed. Never rejects. */
  async load(manifest: Manifest): Promise<void> {
    this.specs = manifest;
    await Promise.all(
      Object.entries(manifest).map(
        ([key, spec]) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => {
              this.images.set(key, image);
              resolve();
            };
            image.onerror = () => {
              this.missing.push(key);
              resolve();
            };
            image.src = spec.src;
          }),
      ),
    );

    if (this.missing.length && import.meta.env.DEV) {
      console.info(
        `[assets] ${this.missing.length}/${Object.keys(manifest).length} not found; ` +
          `drawing placeholders for: ${this.missing.join(', ')}`,
      );
    }
  }

  get(key: string): HTMLImageElement | null {
    return this.images.get(key) ?? null;
  }

  spec(key: string): SheetSpec | null {
    return this.specs[key] ?? null;
  }

  has(key: string): boolean {
    return this.images.has(key);
  }
}

/** Single shared store; scenes read from it during render. */
export const assets = new AssetStore();
