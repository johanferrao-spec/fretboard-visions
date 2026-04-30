/**
 * Auto-trim transparent + uniform-background borders from an image blob.
 *
 * Strategy:
 *  1. Decode the image into a canvas.
 *  2. Sample the four corners to determine the dominant background color.
 *     If most corners are transparent, treat alpha=0 as background.
 *     Otherwise treat pixels within `tolerance` of the corner color as bg.
 *  3. Scan rows/columns from each edge inward; the first row/col containing
 *     ANY non-background pixel becomes the new bound.
 *  4. Optionally pad by a few px so the subject doesn't touch the frame.
 *  5. Re-encode to PNG (preserves transparency for the cleaned edges).
 *
 * Returns the original blob unchanged if trimming would remove everything
 * or fails for any reason — drops should never be lost.
 */
export async function autoTrimImageBlob(
  blob: Blob,
  opts: { tolerance?: number; pad?: number } = {},
): Promise<{ blob: Blob; mime: string }> {
  const tolerance = opts.tolerance ?? 18;
  const pad = opts.pad ?? 2;
  try {
    const bmp = await createImageBitmap(blob);
    const w = bmp.width, h = bmp.height;
    if (!w || !h) return { blob, mime: blob.type || 'image/png' };

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { blob, mime: blob.type || 'image/png' };
    ctx.drawImage(bmp, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;

    // Pick background reference from corners.
    const corners = [
      [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
    ] as const;
    const cornerPixels = corners.map(([x, y]) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]] as [number, number, number, number];
    });
    const transparentCount = cornerPixels.filter(p => p[3] < 8).length;
    const useAlpha = transparentCount >= 2;
    // Average opaque corners for color reference.
    const opaque = cornerPixels.filter(p => p[3] >= 8);
    const ref = opaque.length
      ? [
          opaque.reduce((s, p) => s + p[0], 0) / opaque.length,
          opaque.reduce((s, p) => s + p[1], 0) / opaque.length,
          opaque.reduce((s, p) => s + p[2], 0) / opaque.length,
        ]
      : [255, 255, 255];

    const isBg = (i: number) => {
      const a = data[i + 3];
      if (useAlpha && a < 8) return true;
      if (a < 8) return true;
      return (
        Math.abs(data[i] - ref[0]) <= tolerance &&
        Math.abs(data[i + 1] - ref[1]) <= tolerance &&
        Math.abs(data[i + 2] - ref[2]) <= tolerance
      );
    };

    let top = 0, bottom = h - 1, left = 0, right = w - 1;
    // top
    outerTop: for (; top < h; top++) {
      for (let x = 0; x < w; x++) if (!isBg((top * w + x) * 4)) break outerTop;
    }
    // bottom
    outerBottom: for (; bottom > top; bottom--) {
      for (let x = 0; x < w; x++) if (!isBg((bottom * w + x) * 4)) break outerBottom;
    }
    // left
    outerLeft: for (; left < w; left++) {
      for (let y = top; y <= bottom; y++) if (!isBg((y * w + left) * 4)) break outerLeft;
    }
    // right
    outerRight: for (; right > left; right--) {
      for (let y = top; y <= bottom; y++) if (!isBg((y * w + right) * 4)) break outerRight;
    }

    if (right <= left || bottom <= top) return { blob, mime: blob.type || 'image/png' };

    // Apply padding, clamped.
    top = Math.max(0, top - pad);
    left = Math.max(0, left - pad);
    bottom = Math.min(h - 1, bottom + pad);
    right = Math.min(w - 1, right + pad);

    const cw = right - left + 1;
    const ch = bottom - top + 1;
    // If trim removed less than 2% on every side, skip re-encoding.
    if (top < h * 0.02 && left < w * 0.02 && (h - 1 - bottom) < h * 0.02 && (w - 1 - right) < w * 0.02) {
      return { blob, mime: blob.type || 'image/png' };
    }

    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const octx = out.getContext('2d');
    if (!octx) return { blob, mime: blob.type || 'image/png' };
    octx.drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch);

    const trimmed = await new Promise<Blob | null>(resolve =>
      out.toBlob(b => resolve(b), 'image/png'),
    );
    if (!trimmed) return { blob, mime: blob.type || 'image/png' };
    return { blob: trimmed, mime: 'image/png' };
  } catch {
    return { blob, mime: blob.type || 'image/png' };
  }
}
