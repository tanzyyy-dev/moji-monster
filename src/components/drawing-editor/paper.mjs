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

// Map original paper coordinates to the visible canvas, including any added space.
export function paperTransform(area, width, height) {
  const viewport = paperViewport(area, width, height);
  const scale = viewport.width / area.width;
  return {
    x: viewport.x - area.x * scale,
    y: viewport.y - area.y * scale,
    scale,
  };
}

// Include the visible margins when someone draws into them. With this area the
// current scale and position stay the same, even though the paper now has room.
export function extendPaper(area, point, view, width, height) {
  if (
    point.x >= area.x && point.x <= area.x + area.width &&
    point.y >= area.y && point.y <= area.y + area.height
  ) return area;
  return {
    x: (0 - view.x) / view.scale,
    y: (0 - view.y) / view.scale,
    width: width / view.scale,
    height: height / view.scale,
  };
}
