import { MS_PER_FRAME } from './config';

/**
 * Fixed-step update with a free-running render, so movement tweens stay frame-exact
 * regardless of monitor refresh rate.
 */
export function startLoop(update: () => void, render: () => void): () => void {
  let previous = performance.now();
  let accumulator = 0;
  let raf = 0;

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    // A backgrounded tab can hand back a multi-second delta; cap it so we
    // don't burn through hundreds of catch-up steps on return.
    accumulator += Math.min(now - previous, 250);
    previous = now;
    while (accumulator >= MS_PER_FRAME) {
      update();
      accumulator -= MS_PER_FRAME;
    }
    render();
  };

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
