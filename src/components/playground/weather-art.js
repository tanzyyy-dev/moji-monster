export function drawLightning(ctx, width, height, strike, now) {
  const alpha = Math.max(0, (strike.until - now) / 260);
  if (alpha === 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const start = strike.x;
  ctx.beginPath();
  ctx.moveTo(start, -4);
  for (const [i, offset] of strike.offsets.entries()) {
    ctx.lineTo(start + offset, ((i + 1) / strike.offsets.length) * height * 0.96);
  }
  ctx.strokeStyle = "#96addd";
  ctx.lineWidth = Math.min(15, width * 0.033);
  ctx.stroke();
  ctx.strokeStyle = "#fffbe6";
  ctx.lineWidth = Math.min(5, width * 0.012);
  ctx.stroke();
  ctx.restore();
}

export function drawHeat(ctx, width, height, tick) {
  ctx.save();
  const x = width * 0.74;
  const y = height * 0.17;
  const radius = Math.max(22, Math.min(48, width * 0.075, height * 0.14));
  const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 4);
  glow.addColorStop(0, "#ffbd599c");
  glow.addColorStop(1, "#ffe89200");
  ctx.fillStyle = "#f6ac6226";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  const sun = ctx.createRadialGradient(x - radius * 0.32, y - radius * 0.3, 0, x, y, radius);
  sun.addColorStop(0, "#fff6ae");
  sun.addColorStop(1, "#ffb240");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f7a935";
  ctx.lineWidth = Math.max(2.5, radius * 0.10);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5;
    const ray = radius * (1.55 + 0.1 * Math.sin(tick * 3 + i));
    ctx.moveTo(x + Math.cos(angle) * radius * 1.16, y + Math.sin(angle) * radius * 1.16);
    ctx.lineTo(x + Math.cos(angle) * ray, y + Math.sin(angle) * ray);
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "#fff3c59c";
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 7; i++) {
    const px = width * (i + 0.5) / 7;
    const py = height * (0.63 + 0.22 * ((i * 3) % 7) / 7);
    const sway = Math.sin(tick * 2.5 + i) * 4;
    ctx.moveTo(px, py + 21);
    ctx.bezierCurveTo(px - 13 + sway, py + 11, px + 13 + sway, py - 7, px, py - 18);
  }
  ctx.stroke();
  ctx.restore();
}
