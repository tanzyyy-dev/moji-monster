export function fitCanvas(c) {
  const r = c.getBoundingClientRect(),
    d = Math.min(devicePixelRatio || 1, 2);
  c.width = Math.round(r.width * d);
  c.height = Math.round(r.height * d);
  const ctx = c.getContext("2d");
  ctx.setTransform(d, 0, 0, d, 0, 0);
  return [r.width, r.height];
}

export function strokeWidth(scale) {
  return 13 * scale;
}

export function ink(ctx, paths, c, scale = 1) {
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = strokeWidth(scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const path of paths) {
    if (!path.length) continue;
    ctx.beginPath();
    if (path.length === 1) {
      ctx.arc(path[0].x, path[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
  }
}
