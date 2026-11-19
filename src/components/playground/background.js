import { hexRgb } from "../../colors.js";

function blendHex(dayColor, nightColor, amount) {
  const day = hexRgb(dayColor),
    night = hexRgb(nightColor);
  return (
    "#" +
    day
      .map((channel, index) =>
        Math.round(channel + (night[index] - channel) * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function drawBackground(ctx, width, height, { nightProgress, skyFlash, skyFlashColor, tick }, topOffset = 0, totalHeight = height) {
  const dayColors = ["#bfeaf4", "#f2f8e9", "#c5e6a0", "#a9d67f"],
    nightColors = ["#0b1234", "#3a2f6e", "#1f2350", "#161b38"],
    stops = [0, 0.69, 0.7, 1],
    gradient = ctx.createLinearGradient(0, -topOffset, 0, totalHeight - topOffset);
  stops.forEach((stop, index) =>
    gradient.addColorStop(
      stop,
      blendHex(dayColors[index], nightColors[index], nightProgress),
    ),
  );
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = `rgba(255,255,255,${0.44 * (1 - nightProgress)})`;
  for (let i = 0; i < 8; i++) {
    const x = (i * 157 + 43) % Math.max(width, 1),
      y = 45 + ((i * 73) % Math.max(height * 0.45, 1));
    ctx.beginPath();
    ctx.arc(x, y, 4 + (i % 3) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - nightProgress)})`;
  for (const [x, y, s] of [
    [0.18, 0.17, 1],
    [0.75, 0.27, 0.8],
  ]) {
    ctx.beginPath();
    ctx.ellipse(width * x, height * y, 37 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(
      width * x - 20 * s,
      height * y - 7 * s,
      22 * s,
      15 * s,
      0,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(
      width * x + 16 * s,
      height * y - 8 * s,
      25 * s,
      17 * s,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  if (nightProgress > 0)
    drawNightSky(ctx, width, height, totalHeight * 0.7 - topOffset, nightProgress, skyFlash, skyFlashColor, tick);
}
function drawNightSky(ctx, width, height, horizonY, nightProgress, skyFlash, skyFlashColor, tick) {
  const n = nightProgress,
    seeded = (i, k) => {
      const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
  ctx.save();
  // Soft nebula clouds and a warm glow above the horizon.
  for (const [fx, fy, r, color] of [
    [0.25, 0.22, 0.55, "120,90,200"],
    [0.78, 0.4, 0.5, "70,120,210"],
    [0.5, 0.08, 0.4, "180,90,170"],
  ]) {
    const g = ctx.createRadialGradient(
      width * fx, horizonY * fy, 0,
      width * fx, horizonY * fy, Math.max(width, horizonY) * r,
    );
    g.addColorStop(0, `rgba(${color},${0.2 * n})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  const glow = ctx.createLinearGradient(0, horizonY - horizonY * 0.4, 0, horizonY);
  glow.addColorStop(0, "rgba(255,150,190,0)");
  glow.addColorStop(1, `rgba(255,160,180,${0.3 * n})`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, horizonY);
  if (skyFlash > 0) {
    ctx.globalAlpha = skyFlash * 0.16 * n;
    ctx.fillStyle = skyFlashColor;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  // Twinkling stars, a few with sparkle crosses.
  for (let i = 0; i < 90; i++) {
    const x = seeded(i, 1) * width,
      y = seeded(i, 2) * horizonY * 0.92,
      size = 0.7 + seeded(i, 3) ** 3 * 2.2,
      twinkle = 0.45 + (Math.sin(tick * (1.5 + seeded(i, 4) * 2.5) + i) + 1) * 0.27;
    ctx.globalAlpha = n * twinkle;
    ctx.fillStyle = i % 7 === 0 ? "#ffe2a0" : i % 5 === 0 ? "#cfe2ff" : "#fffbea";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    if (size > 2.3) {
      const len = size * 3.2 * twinkle;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - len, y);
      ctx.lineTo(x + len, y);
      ctx.moveTo(x, y - len);
      ctx.lineTo(x, y + len);
      ctx.stroke();
    }
  }
  // An occasional shooting star.
  const shoot = (tick % 9) / 1.1;
  if (shoot < 1) {
    const lane = Math.floor(tick / 9),
      sx = width * (0.15 + seeded(lane, 5) * 0.5) + shoot * width * 0.3,
      sy = horizonY * (0.08 + seeded(lane, 6) * 0.2) + shoot * horizonY * 0.18,
      tail = ctx.createLinearGradient(sx, sy, sx - 70, sy - 42);
    tail.addColorStop(0, "rgba(255,255,240,0.95)");
    tail.addColorStop(1, "rgba(255,255,240,0)");
    ctx.globalAlpha = n * Math.sin(shoot * Math.PI);
    ctx.strokeStyle = tail;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - 70, sy - 42);
    ctx.stroke();
  }
  // A sleepy smiling moon.
  const mr = Math.max(16, Math.min(30, width * 0.055)),
    mx = width - mr * 2.4,
    my = Math.max(mr * 1.8, horizonY * 0.14);
  ctx.globalAlpha = n;
  const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.4);
  halo.addColorStop(0, "rgba(255,240,190,0.38)");
  halo.addColorStop(1, "rgba(255,240,190,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(mx, my, mr * 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff3c4";
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3dc9a";
  for (const [cx, cy, cr] of [[0.42, -0.4, 0.16], [-0.5, 0.42, 0.12], [0.5, 0.5, 0.09]]) {
    ctx.beginPath();
    ctx.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#8a6a4a";
  ctx.lineWidth = Math.max(1.5, mr * 0.08);
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(mx + side * mr * 0.34, my - mr * 0.08, mr * 0.15, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(mx, my + mr * 0.18, mr * 0.2, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,150,150,0.45)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(mx + side * mr * 0.58, my + mr * 0.2, mr * 0.14, mr * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rolling hill silhouettes with little warm lights on the horizon.
  for (const [color, amp, base, freq, offset] of [
    ["#2d2c63", 22, 26, 0.009, 1.3],
    ["#1f2350", 14, 8, 0.014, 4.1],
  ]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 2);
    for (let x = 0; x <= width + 12; x += 12)
      ctx.lineTo(
        x,
        horizonY - base - Math.sin(x * freq + offset) * amp - Math.sin(x * freq * 2.3 + offset) * amp * 0.35,
      );
    ctx.lineTo(width, horizonY + 2);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 9; i++) {
    const x = (seeded(i, 7) * 0.9 + 0.05) * width,
      y = horizonY - 6 - seeded(i, 8) * 10,
      pulse = 0.65 + Math.sin(tick * 2 + i * 2.1) * 0.25,
      light = ctx.createRadialGradient(x, y, 0, x, y, 9);
    light.addColorStop(0, `rgba(255,214,130,${0.9 * pulse})`);
    light.addColorStop(1, "rgba(255,214,130,0)");
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawRain(ctx, w, h, tick) {
  ctx.save();
  ctx.fillStyle = "rgba(70,80,100,0.22)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(210,230,255,0.7)";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  const count = Math.max(60, Math.floor(w / 6));
  for (let i = 0; i < count; i++) {
    const base = (i * 97 + 13) % Math.max(1, w + 80);
    const x = (base + tick * 260) % (w + 80) - 40;
    const yBase = (i * 61 + 7) % Math.max(1, h);
    const y = (yBase + tick * 520) % (h + 40) - 20;
    const len = 12 + (i % 5) * 4;
    ctx.globalAlpha = 0.45 + (i % 3) * 0.18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
export function drawWind(ctx, w, h, tick) {
  ctx.save();
  const count = Math.max(18, Math.floor(w / 30));
  for (let i = 0; i < count; i++) {
    const baseY = (i * 53 + 11) % Math.max(1, h);
    const y = baseY;
    const progress = (tick * 1.6 + i * 0.37) % 1;
    const x = progress * (w + 120) - 60;
    const len = 40 + (i % 4) * 22;
    ctx.globalAlpha = 0.25 + (1 - Math.abs(progress - 0.5) * 2) * 0.45;
    ctx.strokeStyle = "rgba(255,250,240,0.85)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y - (i % 3) * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
