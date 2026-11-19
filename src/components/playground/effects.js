export const fireworkShapes = ["ring", "heart", "smile", "star"];
export function fireworksBurst(m, shape, particles) {
  const palettes = [
      ["#ffef8a", "#ff8d7e", "#95def4", "#d8a5ff", "#fff7e8"],
      ["#ff9ec7", "#ff6f91", "#ffd1e3", "#fff7e8"],
      ["#ffe066", "#ffc93c", "#fff4b8", "#ffffff"],
      ["#9be7ff", "#8affc1", "#c9b6ff", "#ffffff"],
    ],
    colors = palettes[fireworkShapes.indexOf(shape) % palettes.length] || palettes[0],
    push = (vx, vy, i, life = 1.15, r = 2.6) =>
      particles.push({
        x: m.x,
        y: m.y,
        vx,
        vy,
        life: life + Math.random() * 0.15,
        max: 1,
        color: colors[i % colors.length],
        r: r + Math.random() * 1.6,
        glow: true,
      });
  if (shape === "heart") {
    for (let i = 0; i < 64; i++) {
      const t = (Math.PI * 2 * i) / 64;
      push(
        16 * Math.sin(t) ** 3 * 8.5,
        -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 8.5,
        i,
      );
    }
  } else if (shape === "smile") {
    // A smiling face: outline, two eyes and a big grin.
    for (let i = 0; i < 44; i++) {
      const a = (Math.PI * 2 * i) / 44;
      push(Math.cos(a) * 140, Math.sin(a) * 140, i);
    }
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6;
        push(side * 48 + Math.cos(a) * 9, -42 + Math.sin(a) * 9, i, 1.15, 3.2);
      }
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * (0.18 + (0.64 * i) / 14);
      push(Math.cos(a) * 82, 8 + Math.sin(a) * 62, i, 1.15, 3);
    }
  } else if (shape === "star") {
    for (let i = 0; i < 70; i++) {
      const t = i / 70,
        k = (t * 10) | 0,
        f = t * 10 - k,
        a1 = -Math.PI / 2 + (Math.PI * k) / 5,
        a2 = -Math.PI / 2 + (Math.PI * (k + 1)) / 5,
        r1 = k % 2 ? 60 : 150,
        r2 = k % 2 ? 150 : 60,
        r = r1 + (r2 - r1) * f,
        a = a1 + (a2 - a1) * f;
      push(Math.cos(a) * r, Math.sin(a) * r, i);
    }
  } else {
    for (let i = 0; i < 52; i++) {
      const angle = (Math.PI * 2 * i) / 52 + (Math.random() - 0.5) * 0.12,
        speed = 55 + Math.random() * 125;
      push(Math.cos(angle) * speed, Math.sin(angle) * speed, i, 0.7 + Math.random() * 0.6, 2 + Math.random() * 2);
    }
  }
  return colors[0];
}
const fireworkCallWords = ["た〜まや〜！", "か〜ぎや〜！", "どっか〜ん！", "ぱちぱち〜", "きれい〜！", "わ〜い！"];
export function fireworkCall(fireworkCalls, w, h, text, variant = 0) {
  // Always just above the drawing area so it stays visible on phones.
  for (const old of fireworkCalls.children) old.classList.add("leaving");
  const el = document.createElement("div"),
    jitter = Math.min(24, w * 0.05);
  el.className = "firework-call v" + (variant % 4);
  el.style.left = w / 2 + (Math.random() * 2 - 1) * jitter + "px";
  el.style.top = Math.max(h * 0.45, h - Math.min(84, h * 0.16)) + "px";
  el.style.setProperty("--tilt", (Math.random() * 8 - 4).toFixed(1) + "deg");
  [...text].forEach((ch, i) => {
    const span = document.createElement("span");
    span.textContent = ch === " " ? "\u00a0" : ch;
    span.style.setProperty("--i", i);
    el.append(span);
  });
  fireworkCalls.append(el);
  el.addEventListener("animationend", (e) => {
    if (e.target === el) el.remove();
  });
  setTimeout(() => el.remove(), 2600);
}
export function fireworkCallText(index) {
  if (index < 2) return fireworkCallWords[index];
  return fireworkCallWords[Math.floor(Math.random() * fireworkCallWords.length)];
}
export function drawBombCountdown(ctx, m, radius, remaining, now) {
  // Frameless badge: a little bomb with a sparking fuse plus the number.
  const danger = remaining <= 3,
    pulse = 1.2 * (1 + Math.sin(now / (danger ? 70 : 150)) * (danger ? 0.12 : 0.04)),
    shake = danger ? Math.sin(now / 28) * 1.6 : 0,
    badgeY = Math.max(26, m.y - radius - 24),
    label = String(remaining),
    textW = label.length * 14;
  ctx.save();
  ctx.translate(m.x + shake, badgeY);
  ctx.scale(pulse, pulse);
  const bx = -textW / 2 - 6,
    by = 2,
    br = 11;
  ctx.translate(bx, by);
  ctx.rotate(Math.sin(now / 160) * 0.12);
  // Body with a soft white rim so it reads on day and night skies.
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, br + 2.5, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(-4, -4, 1, 0, 0, br);
  body.addColorStop(0, danger ? "#7a4a52" : "#5a5f7a");
  body.addColorStop(1, danger ? "#3a1f26" : "#262a3e");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffffb0";
  ctx.beginPath();
  ctx.ellipse(-4, -4.5, 3.2, 2, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a8fa8";
  ctx.save();
  ctx.translate(6, -8);
  ctx.rotate(0.75);
  ctx.fillRect(-3.5, -2.5, 7, 5);
  ctx.restore();
  ctx.strokeStyle = "#a07a4f";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(8, -10);
  ctx.quadraticCurveTo(12, -17, 16, -14);
  ctx.stroke();
  const flicker = 0.75 + Math.random() * 0.5;
  ctx.fillStyle = "#ffd34d";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * i) / 4 + now / 90,
      r = (i % 2 ? 2 : 5.5) * flicker;
    ctx.lineTo(16 + Math.cos(a) * r, -14 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ff7a3d";
  ctx.beginPath();
  ctx.arc(16, -14, 1.8 * flicker, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(m.x + shake + 11, badgeY + 1);
  ctx.scale(pulse * (danger ? 1.12 : 1), pulse * (danger ? 1.12 : 1));
  ctx.font = '900 26px "Hiragino Maru Gothic ProN", ui-rounded, system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = danger ? "#e3443f" : "#4a3a33";
  ctx.strokeText(label, 0, 1);
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

export function updateParticles(ctx, particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    if (p.glow) {
      // Uniform drag keeps heart/smile shapes intact while they slow down.
      const drag = Math.exp(-0.6 * dt);
      p.vx *= drag;
      p.vy *= drag;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.glow ? 55 : 90) * dt;
    const fade = Math.min(1, p.life * 2),
      flicker = p.glow && p.life < 0.45 && Math.random() < 0.35 ? 0.35 : 1;
    if (p.glow) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = fade * 0.22 * flicker;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = fade * flicker;
    ctx.fillStyle = p.glow && p.life > 0.9 ? "#fffdf4" : p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * fade, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.globalAlpha = 1;
}
