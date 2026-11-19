import { ink } from "../../canvas.js";

export function characterDisplayScale(w, h) {
  return w <= 600 && h > w ? 0.68 : 1;
}

export function baseCharacterRadius(m, w, h) {
  if (m.image) {
    const scale = Math.min(
      Math.min(160, w * 0.4) / m.image.width,
      Math.min(170, h * 0.34) / m.image.height,
    ) * characterDisplayScale(w, h);
    return Math.max(
      28,
      Math.min(72, Math.max(m.image.width, m.image.height) * scale * 0.45),
    );
  }
  return Math.max(28, (m.size || 75) * 0.54);
}

function drawSweatDrop(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.bezierCurveTo(x + size * 0.9, y, x + size * 0.7, y + size, x, y + size);
  ctx.bezierCurveTo(x - size * 0.7, y + size, x - size * 0.9, y, x, y - size);
  ctx.fillStyle = "#76cfe3";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#fffaf0";
  ctx.stroke();
}
function drawActionStar(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.32, y - size * 0.32);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size * 0.32, y + size * 0.32);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.32, y + size * 0.32);
  ctx.lineTo(x - size, y);
  ctx.lineTo(x - size * 0.32, y - size * 0.32);
  ctx.closePath();
  ctx.fill();
}
function drawActionEffects(ctx, m, t, action, w, h) {
  const size = baseCharacterRadius(m, w, h) * 1.6;
  if (action === "sweat" || t < m.sweatUntil) {
    const flutter = Math.sin(t * 15 + m.phase) * 2;
    drawSweatDrop(ctx, -size * 0.52, -size * 0.45 + flutter, 4.5);
    drawSweatDrop(ctx, size * 0.5, -size * 0.56 - flutter, 3.5);
  }
  if (action === "panic") {
    ctx.font = `900 ${Math.max(15, size * 0.38)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fffaf0";
    ctx.strokeText("!", size * 0.48, -size * 0.38);
    ctx.fillStyle = "#ff7c7b";
    ctx.fillText("!", size * 0.48, -size * 0.38);
  } else if (action === "angry") {
    ctx.save();
    ctx.translate(size * 0.43, -size * 0.43);
    ctx.rotate(-0.2);
    ctx.strokeStyle = "#ef6d62";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-5, -8);
    ctx.lineTo(0, -3);
    ctx.lineTo(6, -8);
    ctx.moveTo(0, -3);
    ctx.lineTo(0, 4);
    ctx.moveTo(-7, 2);
    ctx.lineTo(-3, 6);
    ctx.moveTo(7, 2);
    ctx.lineTo(3, 6);
    ctx.stroke();
    ctx.restore();
  } else if (action === "dance") {
    const twinkle = 0.6 + Math.sin(t * 13 + m.phase) * 0.4;
    ctx.fillStyle = `rgba(255, 201, 78, ${twinkle})`;
    drawActionStar(ctx, -size * 0.64, -size * 0.28, 4);
    drawActionStar(ctx, size * 0.64, -size * 0.12, 3.5);
   } else if (action === "sleep") {
     ctx.save();
     ctx.textAlign = "left";
     ctx.textBaseline = "middle";
     ctx.fillStyle = "#6b5a52";
     ctx.globalAlpha = 0.85;
     const bob = Math.sin(t * 2 + m.phase) * 2;
     ctx.font = `900 ${Math.max(11, size * 0.32)}px system-ui, sans-serif`;
     ctx.fillText("z", size * 0.5, -size * 0.55 + bob);
     ctx.font = `900 ${Math.max(14, size * 0.44)}px system-ui, sans-serif`;
     ctx.fillText("z", size * 0.85, -size * 0.8 + bob * 1.2);
     ctx.font = `900 ${Math.max(17, size * 0.56)}px system-ui, sans-serif`;
     ctx.fillText("Z", size * 1.15, -size * 1.05 + bob * 1.5);
     ctx.restore();
   }
 }
export function drawCharacter(ctx, m, t, grabbed, w, h) {
  const action =
      grabbed ? "sweat" : t < m.actionUntil ? m.action : "",
    actionProgress = action
      ? Math.min(1, (t - m.actionStart) / (m.actionUntil - m.actionStart))
      : 0,
    jumpHeight =
      action === "jump" ? Math.sin(actionProgress * Math.PI) * 20 : 0,
    bob = Math.sin(t * 3 + m.phase) * 5 - jumpHeight,
    dancing = action === "dance",
      bounce = dancing
      ? 1 + Math.sin(t * 12 + m.phase) * 0.1
      : 1 + Math.sin(t * 3 + m.phase) * 0.035,
    twist = dancing ? Math.sin(t * 10 + m.phase) * 0.16 : 0;
  ctx.save();
  ctx.translate(m.x, m.y + bob);
  const presentationScale = m.presentationScale || 1;
  ctx.scale(
    ((grabbed ? 1.06 : 1) / bounce) * presentationScale,
    (bounce / (grabbed ? 1.04 : 1)) * presentationScale,
  );
  ctx.rotate(Math.sin(t * 1.7 + m.phase) * 0.055 + twist);
  ctx.globalAlpha = Math.min(1, m.age * 3);
  if (m.image) {
    const iw = m.image.width,
      ih = m.image.height,
      scale = Math.min(
        Math.min(160, w * 0.4) / iw,
        Math.min(170, h * 0.34) / ih,
      ) * characterDisplayScale(w, h);
    if (action === "sleep") ctx.rotate(0.32);
    ctx.drawImage(
      m.image,
      (-iw * scale) / 2,
      (-ih * scale) / 2,
      iw * scale,
      ih * scale,
    );
    drawActionEffects(ctx, m, t, action, w, h);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = "#51443e";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  const foot = m.size * 0.28;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 19, foot - 7);
    ctx.quadraticCurveTo(
      s * 24,
      foot + 13 + Math.sin(t * 5 + m.phase + s) * 6,
      s * 33,
      foot + 18,
    );
    ctx.stroke();
  }
  for (const path of m.paths)
    ink(ctx, [path], path.inkColor || m.color, path.brushScale || 1);
  const fy = m.faceY;
  if (action === "sleep") {
    ctx.strokeStyle = "#55453f";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * m.eyeOffset - 6, fy);
      ctx.lineTo(s * m.eyeOffset + 6, fy);
      ctx.stroke();
    }
  } else if (action === "relieved" || dancing) {
    ctx.strokeStyle = "#55453f";
    ctx.lineWidth = 2.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * m.eyeOffset - 4, fy);
      ctx.quadraticCurveTo(s * m.eyeOffset, fy + 4, s * m.eyeOffset + 4, fy);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#55453f";
    ctx.lineWidth = 2.5;
    const eyeScale = action === "panic" || action === "sweat" ? 1.12 : 1;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(
        s * m.eyeOffset,
        fy,
        9 * eyeScale,
        11 * eyeScale,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#322c32";
      ctx.beginPath();
      ctx.arc(
        s * m.eyeOffset + Math.sin(t * 0.8 + m.phase) * 2,
        fy + 1,
        action === "panic" ? 3.3 : 4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = "#fff";
    }
  }
  if (action === "angry") {
    ctx.strokeStyle = "#51443e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-m.eyeOffset - 5, fy - 14);
    ctx.lineTo(-m.eyeOffset + 3, fy - 10);
    ctx.moveTo(m.eyeOffset - 3, fy - 10);
    ctx.lineTo(m.eyeOffset + 5, fy - 14);
    ctx.stroke();
  }
  ctx.strokeStyle = "#493638";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  if (action === "panic") {
    ctx.arc(0, fy + 18, 3.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (action === "angry") {
    ctx.moveTo(-5, fy + 19);
    ctx.lineTo(0, fy + 16);
    ctx.lineTo(5, fy + 19);
    ctx.stroke();
  } else if (action === "sleep") {
    ctx.moveTo(-4, fy + 15);
    ctx.lineTo(4, fy + 15);
    ctx.stroke();
  } else {
    ctx.arc(0, fy + 15, 5, 0, Math.PI);
    ctx.stroke();
  }
  drawActionEffects(ctx, m, t, action, w, h);
  ctx.restore();
}
