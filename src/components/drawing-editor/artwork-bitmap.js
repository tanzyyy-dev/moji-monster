// Trim the transparent paper around a rasterized hand drawing before it floats.
export function cropDrawing(canvas) {
  const { width, height } = canvas;
  const { data } = canvas.getContext("2d").getImageData(0, 0, width, height);
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = y;
    }
  }
  if (right < 0) return null;
  if (left === 0 && top === 0 && right === width - 1 && bottom === height - 1) return canvas;
  const cropped = document.createElement("canvas");
  cropped.width = right - left + 1;
  cropped.height = bottom - top + 1;
  cropped.getContext("2d").drawImage(
    canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height,
  );
  return cropped;
}
