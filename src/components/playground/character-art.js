import { ink } from "../../canvas.js";

export function characterDisplayScale(w, h) {
  return w <= 600 && h > w ? 0.68 : 1;
}

export function baseCharacterRadius(m, w, h) {
  if (m.image && !m.size) {
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
  if (action === "panic" || action === "startled") {
    ctx.strokeStyle = "#f68965";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(side * size * 0.54, -size * 0.46);
      ctx.lineTo(side * size * 0.64, -size * 0.62);
      ctx.moveTo(side * size * 0.64, -size * 0.33);
      ctx.lineTo(side * size * 0.78, -size * 0.37);
    }
    ctx.stroke();
  } else if (action === "shove") {
    ctx.save();
    ctx.rotate(m.shoveAngle);
    ctx.strokeStyle = "#f1a24e";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const offset of [-1, 0, 1]) {
      ctx.moveTo(size * 0.46, offset * 7);
      ctx.lineTo(size * 0.72, offset * 12);
    }
    ctx.stroke();
    ctx.restore();
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
    const drift = Math.sin(t * 2 + m.phase) * 2;
    ctx.fillStyle = "#fff5d680";
    ctx.strokeStyle = "#766555a0";
    ctx.lineWidth = 1.6;
    for (const [x, y, r] of [[0.52, -0.49, 2.5], [0.72, -0.68, 4], [0.94, -0.84, 5.8]]) {
      ctx.beginPath();
      ctx.arc(size * x, size * y + drift, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

export function characterBob(m, tick) {
  return Math.sin(tick * (m.napping ? 1.5 : 3) + m.phase) * (m.napping ? 1 : 5);
}

export function drawCharacter(ctx, m, t, grabbed, w, h) {
  const action =
      grabbed ? "sweat" : t < m.actionUntil ? m.action : m.napping ? "sleep" : "",
    actionProgress = action
      ? Math.min(1, (t - m.actionStart) / (m.actionUntil - m.actionStart))
      : 0,
    jumpHeight =
      action === "jump" ? Math.sin(actionProgress * Math.PI) * 20 : 0,
    bob = characterBob(m, t) - jumpHeight,
    dancing = action === "dance",
    bounce = dancing
      ? 1 + Math.sin(t * 12 + m.phase) * 0.1
      : 1 + Math.sin(t * 3 + m.phase) * (m.napping ? 0.012 : 0.035),
    twist = dancing ? Math.sin(t * 10 + m.phase) * 0.16 : 0,
    shoveTilt = action === "shove" ? Math.cos(m.shoveAngle) * Math.sin(actionProgress * Math.PI) * 0.22 : 0;
  ctx.save();
  ctx.translate(m.x, m.y + bob);
  const presentationScale = m.presentationScale || 1;
  ctx.scale(
    ((grabbed ? 1.06 : 1) / bounce) * presentationScale,
    (bounce / (grabbed ? 1.04 : 1)) * presentationScale,
  );
  ctx.rotate(Math.sin(t * 1.7 + m.phase) * (m.napping ? 0.012 : 0.055) + twist + shoveTilt);
  ctx.globalAlpha = Math.min(1, m.age * 3);
  if (m.image) {
    const iw = m.image.width,
      ih = m.image.height,
      scale = m.size
        ? m.size / Math.max(iw, ih)
        : Math.min(
          Math.min(160, w * 0.4) / iw,
          Math.min(170, h * 0.34) / ih,
        ) * characterDisplayScale(w, h);
    if (!m.size && action === "sleep") ctx.rotate(0.32);
    if (m.withFace === true) drawFeet(ctx, m, t);
    ctx.drawImage(
      m.image,
      (-iw * scale) / 2,
      (-ih * scale) / 2,
      iw * scale,
      ih * scale,
    );
    if (m.withFace === true) drawFace(ctx, m, t, action, dancing);
    drawActionEffects(ctx, m, t, action, w, h);
    ctx.restore();
    return;
  }
  if (m.withFace !== false) drawFeet(ctx, m, t);
  for (const path of m.paths)
    ink(ctx, [path], path.inkColor || m.color, path.brushScale || 1);
  if (m.withFace !== false) drawFace(ctx, m, t, action, dancing);
  drawActionEffects(ctx, m, t, action, w, h);
  ctx.restore();
}

function drawFeet(ctx, m, t) {
  ctx.strokeStyle = "#51443e";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  const foot = m.size * 0.28;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 19, foot - 7);
    ctx.quadraticCurveTo(
      s * 24,
      foot + 13 + Math.sin(t * 5 + m.phase + s) * (m.napping ? 0 : 6),
      s * 33,
      foot + 18,
    );
    ctx.stroke();
  }
}

function drawFace(ctx, m, t, action, dancing) {
  const fy = m.faceY;
  if (action === "shove") action = "angry";
  if (drawSpecialFace(ctx, m, t, action)) return;
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
    const eyeScale = action === "startled" ? 1.23 : action === "panic" || action === "sweat" ? 1.12 : 1;
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
        action === "panic" || action === "startled" ? 3.3 : 4,
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
  if (action === "panic" || action === "startled") {
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
}

function drawSpecialFace(ctx, m, tick, action) {
  if (action === "sleep" || action === "startled") return false;
  const tired = action === "tired";
  if (!tired && m.personality !== "mischief" && m.personality !== "timid") return false;

  const eye = Math.max(8, m.eyeOffset);
  const y = m.faceY;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (tired) {
    ctx.strokeStyle = "#55453f";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const x = eye * side;
      ctx.moveTo(x - 5, y - 1);
      ctx.quadraticCurveTo(x, y + 5, x + 5, y - 1);
    }
    ctx.stroke();
    ctx.strokeStyle = "#8d5a55";
    ctx.beginPath();
    ctx.moveTo(-6, y + 17);
    ctx.quadraticCurveTo(0, y + 13, 6, y + 17);
    ctx.stroke();
  } else if (m.personality === "mischief") {
    ctx.strokeStyle = "#352d3a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-eye, y - 1);
    ctx.lineTo(eye, y - 1);
    ctx.stroke();
    for (const side of [-1, 1]) {
      const x = eye * side;
      ctx.fillStyle = "#352d3a";
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 4);
      ctx.lineTo(x + 7, y - 4);
      ctx.quadraticCurveTo(x + 6, y + 6, x, y + 6);
      ctx.quadraticCurveTo(x - 6, y + 6, x - 7, y - 4);
      ctx.fill();
      ctx.strokeStyle = "#ab9dae";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - 3, y + 1);
      ctx.lineTo(x + 1, y - 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "#493638";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-7, y + 18);
    ctx.lineTo(-1, y + 13);
    ctx.lineTo(7, y + 18);
    ctx.stroke();
  } else {
    for (const side of [-1, 1]) {
      const x = eye * side;
      ctx.fillStyle = "#fffdf6";
      ctx.strokeStyle = "#55453f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, 7.5, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#352d3a";
      ctx.beginPath();
      ctx.arc(x + side, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      drawSweatDrop(ctx, x + side * 4, y + 10 + (Math.sin(tick * 5 + side) + 1) * 2, 3.5);
    }
    ctx.strokeStyle = "#493638";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-7, y + 16);
    ctx.bezierCurveTo(-4, y + 10, 3, y + 22, 7, y + 15);
    ctx.stroke();
  }
  ctx.restore();
  return true;
}
