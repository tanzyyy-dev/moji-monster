import { hexRgb } from "../../colors.js";

export function floodFillCanvas(
  canvas,
  x,
  y,
  fillColor,
  { templateOnly = false, allowedColors = [], paintLayer = canvas } = {},
) {
  const width = canvas.width,
    height = canvas.height;
  x = Math.max(0, Math.min(width - 1, Math.floor(x)));
  y = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const ctx = canvas.getContext("2d", { willReadFrequently: true }),
    imageData = ctx.getImageData(0, 0, width, height),
    pixels = imageData.data,
    start = y * width + x,
    startOffset = start * 4,
    target = [
      pixels[startOffset],
      pixels[startOffset + 1],
      pixels[startOffset + 2],
      pixels[startOffset + 3],
    ],
    whiteRegion =
      target[3] > 220 &&
      target[0] > 235 &&
      target[1] > 235 &&
      target[2] > 235,
    allowedRegion = allowedColors.some((hex) => {
      const rgb = hexRgb(hex);
      return (
        target[3] > 220 &&
        Math.abs(target[0] - rgb[0]) <= 6 &&
        Math.abs(target[1] - rgb[1]) <= 6 &&
        Math.abs(target[2] - rgb[2]) <= 6
      );
    });
  if (templateOnly && !whiteRegion && !allowedRegion) return false;
  const fill = hexRgb(fillColor),
    transparentTarget = target[3] < 16,
    tolerance = templateOnly ? (whiteRegion ? 26 : 6) : 24,
    queue = new Int32Array(width * height),
    queued = new Uint8Array(width * height);
  if (
    !transparentTarget &&
    Math.abs(target[0] - fill[0]) <= 1 &&
    Math.abs(target[1] - fill[1]) <= 1 &&
    Math.abs(target[2] - fill[2]) <= 1
  ) {
    return false;
  }
  const matches = (index) => {
    const offset = index * 4;
    if (transparentTarget) return pixels[offset + 3] < 16;
    return (
      pixels[offset + 3] > (templateOnly ? 210 : 16) &&
      Math.abs(pixels[offset] - target[0]) <= tolerance &&
      Math.abs(pixels[offset + 1] - target[1]) <= tolerance &&
      Math.abs(pixels[offset + 2] - target[2]) <= tolerance
    );
  };
  // Match against the visible composite, but write only to the editable layer.
  const separateLayer = paintLayer !== canvas;
  const paintCtx = separateLayer ? paintLayer.getContext("2d", { willReadFrequently: true }) : ctx;
  const paintData = separateLayer ? paintCtx.getImageData(0, 0, width, height) : imageData;
  const paint = paintData.data;
  let head = 0,
    tail = 0,
    changed = 0;
  const enqueue = (index) => {
    if (index >= 0 && !queued[index]) {
      queued[index] = 1;
      queue[tail++] = index;
    }
  };
  queue[tail++] = start;
  queued[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    if (!matches(index)) continue;
    const offset = index * 4;
    paint[offset] = fill[0];
    paint[offset + 1] = fill[1];
    paint[offset + 2] = fill[2];
    if (separateLayer || transparentTarget) paint[offset + 3] = 255;
    changed++;
    const px = index % width;
    if (px > 0) enqueue(index - 1);
    if (px < width - 1) enqueue(index + 1);
    if (index >= width) enqueue(index - width);
    if (index < width * (height - 1)) enqueue(index + width);
  }
  if (!changed) return false;
  paintCtx.putImageData(paintData, 0, 0);
  return true;
}
