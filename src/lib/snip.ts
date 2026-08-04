// "Snip from PDF" support: crop a rectangle out of a rendered PDF page and
// compress it to a small JPEG for attaching to a matrix row. The pixel-mapping
// math is a pure function (unit-tested); the canvas draw is a thin DOM wrapper.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Map a selection rectangle drawn in DISPLAY pixels (on a scaled page image) to
 * SOURCE pixel coordinates of the underlying full-resolution image, clamped to
 * the image bounds. Pure + testable.
 */
export function displayRectToSource(
  sel: Rect,
  display: { w: number; h: number },
  natural: { w: number; h: number },
): Rect {
  const sx = display.w > 0 ? natural.w / display.w : 1;
  const sy = display.h > 0 ? natural.h / display.h : 1;
  const x = Math.max(0, Math.min(natural.w, Math.round(sel.x * sx)));
  const y = Math.max(0, Math.min(natural.h, Math.round(sel.y * sy)));
  const w = Math.max(0, Math.min(natural.w - x, Math.round(sel.w * sx)));
  const h = Math.max(0, Math.min(natural.h - y, Math.round(sel.h * sy)));
  return { x, y, w, h };
}

/** Normalize a drag (which can go any direction) into a positive-size rect. */
export function normalizeDrag(x0: number, y0: number, x1: number, y1: number): Rect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

/**
 * Crop `rect` (source pixels) out of an image data URL and return a compressed
 * JPEG data URL, downscaled so the longest side is at most `maxDim`.
 */
export async function cropToJpeg(
  srcDataUrl: string,
  rect: Rect,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<string> {
  const { maxDim = 1100, quality = 0.72 } = opts;
  const img = await loadImage(srcDataUrl);
  const longest = Math.max(rect.w, rect.h) || 1;
  const scale = longest > maxDim ? maxDim / longest : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.w * scale));
  canvas.height = Math.max(1, Math.round(rect.h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    img,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL("image/jpeg", quality);
}
