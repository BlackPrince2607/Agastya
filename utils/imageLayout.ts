/** Map normalized image coords (0–1) to on-screen pixels for cover/contain layouts. */

export type ImageLayout = {
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
};

export function computeImageLayout(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
  resizeMode: 'cover' | 'contain' = 'cover',
): ImageLayout {
  if (containerW <= 0 || containerH <= 0 || imageW <= 0 || imageH <= 0) {
    return { offsetX: 0, offsetY: 0, displayWidth: containerW, displayHeight: containerH };
  }

  const scale =
    resizeMode === 'cover'
      ? Math.max(containerW / imageW, containerH / imageH)
      : Math.min(containerW / imageW, containerH / imageH);

  const displayWidth = imageW * scale;
  const displayHeight = imageH * scale;

  return {
    offsetX: (containerW - displayWidth) / 2,
    offsetY: (containerH - displayHeight) / 2,
    displayWidth,
    displayHeight,
  };
}

export function normalizedToScreen(
  nx: number,
  ny: number,
  layout: ImageLayout,
): { x: number; y: number } {
  return {
    x: layout.offsetX + nx * layout.displayWidth,
    y: layout.offsetY + ny * layout.displayHeight,
  };
}
