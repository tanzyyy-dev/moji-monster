// Fit the original drawing surface inside the current canvas without stretching it.
export function paperViewport(paper, width, height) {
  if (!paper) return { x: 0, y: 0, width, height };
  const scale = Math.min(width / paper.width, height / paper.height);
  const fittedWidth = paper.width * scale, fittedHeight = paper.height * scale;
  return {
    x: (width - fittedWidth) / 2,
    y: (height - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}
