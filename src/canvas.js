export function fitCanvas(c) {
  const r = c.getBoundingClientRect(),
    d = Math.min(devicePixelRatio || 1, 2);
  c.width = Math.round(r.width * d);
  c.height = Math.round(r.height * d);
  const ctx = c.getContext("2d");
  ctx.setTransform(d, 0, 0, d, 0, 0);
  return [r.width, r.height];
}

export function ink(ctx, paths, c, scale = 1) {
  ctx.strokeStyle = c;
  ctx.lineWidth = 13 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const path of paths) {
    if (!path.length) continue;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    if (path.length === 1) {
      ctx.lineTo(path[0].x + 0.01, path[0].y + 0.01);
    } else
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
  }
}
