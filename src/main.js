(() => {
  const $ = (id) => document.getElementById(id),
    world = $("world"),
    wc = world.getContext("2d"),
    draw = $("draw"),
    dc = draw.getContext("2d");
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => {
    if (!e.target.closest("input")) e.preventDefault();
  });
  const magicCursor = $("magic-cursor"),
    pointerFx = $("pointer-fx");
  const finePointer = matchMedia("(hover:hover) and (pointer:fine)");
  let lastSpark = 0;
  function sparkle(x, y, burst = false) {
    if (document.hidden) return;
    const count = burst ? 9 : 1;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span"),
        star = burst || Math.random() > 0.55;
      el.className = "fx-dot" + (star ? " star" : "");
      if (star) el.textContent = ["✦", "✧", "★"][Math.floor(Math.random() * 3)];
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.setProperty(
        "--fx-color",
        ["#ff8ca6", "#ffd36d", "#7ac9e8", "#a4dfab"][
          Math.floor(Math.random() * 4)
        ],
      );
      if (star)
        el.style.color = ["#ff8ca6", "#ffc14c", "#7ac9e8", "#94cfa1"][
          Math.floor(Math.random() * 4)
        ];
      el.style.setProperty(
        "--dx",
        (burst ? (Math.random() - 0.5) * 85 : (Math.random() - 0.5) * 23) +
          "px",
      );
      el.style.setProperty(
        "--dy",
        (burst ? (Math.random() - 0.5) * 85 : -18 - Math.random() * 16) + "px",
      );
      pointerFx.append(el);
      el.addEventListener("animationend", () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 900);
    }
  }
  document.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "mouse" && finePointer.matches) {
        magicCursor.style.left = e.clientX + "px";
        magicCursor.style.top = e.clientY + "px";
        magicCursor.style.display = "block";
      }
      const now = performance.now();
      if (now - lastSpark > 65 && (e.pointerType === "mouse" || e.buttons)) {
        lastSpark = now;
        sparkle(e.clientX, e.clientY);
      }
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return;
      sparkle(e.clientX, e.clientY, true);
      if (finePointer.matches) {
        magicCursor.style.transform =
          "translate(-50%,-50%) rotate(15deg) scale(.8)";
        setTimeout(
          () =>
            (magicCursor.style.transform =
              "translate(-50%,-50%) rotate(-15deg)"),
          140,
        );
      }
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerleave",
    () => (magicCursor.style.display = "none"),
  );

  const paletteColors = [
    ["あか", "#ed5057"],
    ["オレンジ", "#ff8a35"],
    ["きいろ", "#f5cd34"],
    ["きみどり", "#a4ce4a"],
    ["みどり", "#39a86b"],
    ["みずいろ", "#50c7e8"],
    ["あお", "#3979dc"],
    ["むらさき", "#8959c8"],
    ["ピンク", "#f48cba"],
    ["ちゃいろ", "#925e3b"],
    ["くろ", "#33333b"],
    ["はいいろ", "#91939b"],
    ["しろ", "#ffffff"],
    ["はだいろ", "#f5c6a3"],
    ["こんいろ", "#273d79"],
    ["こげちゃ", "#5b3b2e"],
  ];
  const colors = paletteColors.map((x) => x[1]);
  let color = colors[0],
    strokes = [],
    current = null,
    monsters = [],
    drawing = false,
    pendingImage = null,
    floatTimer = null,
    w = 0,
    h = 0,
    last = performance.now(),
    tick = 0,
    bombMode = false,
    particles = [];
  let grabbedMonster = null,
    grabbedPointerId = null,
    grabOffsetX = 0,
    grabOffsetY = 0,
    lastGrabX = 0,
    lastGrabY = 0,
    lastGrabAt = 0;
  let audioCtx = null,
    lastDrawSound = 0;
  function audio() {
    try {
      audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch {
      return null;
    }
  }
  function tone(
    freq,
    duration = 0.1,
    type = "sine",
    volume = 0.055,
    delay = 0,
    endFreq = null,
  ) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + delay,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (endFreq)
      o.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFreq),
        t + duration,
      );
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  function soundDraw() {
    const n = performance.now();
    if (n - lastDrawSound < 75) return;
    lastDrawSound = n;
    tone(330 + Math.random() * 130, 0.055, "sine", 0.014);
  }
  function soundFloat() {
    tone(440, 0.13, "sine", 0.06);
    tone(660, 0.17, "sine", 0.06, 0.11);
    tone(880, 0.23, "sine", 0.05, 0.24);
  }
  function soundTick(n) {
    tone(n <= 3 ? 780 : 560, 0.095, "square", 0.022);
  }
  function soundExplosion() {
    tone(165, 0.42, "sawtooth", 0.095, 0, 38);
    tone(80, 0.35, "triangle", 0.08, 0.06, 25);
    for (let i = 0; i < 5; i++)
      tone(100 + Math.random() * 270, 0.13, "sawtooth", 0.018, i * 0.038, 35);
  }
  const bgm = new Audio("./assets/audio/Through_the_Garden_Gate.mp3");
  bgm.loop = true;
  bgm.volume = 0.28;
  bgm.preload = "auto";
  let bgmUnlocked = false;
  function startBgm() {
    if (document.hidden) return;
    bgmUnlocked = true;
    bgm.play().catch(() => {});
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      bgm.pause();
      if (audioCtx && audioCtx.state === "running") audioCtx.suspend();
    } else {
      if (bgmUnlocked) bgm.play().catch(() => {});
      if (audioCtx && audioCtx.state === "suspended")
        audioCtx.resume().catch(() => {});
    }
  });
  document.addEventListener("pointerdown", startBgm, { once: true });
  function fit(c) {
    const r = c.getBoundingClientRect(),
      d = Math.min(devicePixelRatio || 1, 2);
    c.width = Math.round(r.width * d);
    c.height = Math.round(r.height * d);
    const ctx = c.getContext("2d");
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return [r.width, r.height];
  }
  function resize() {
    [w, h] = fit(world);
    fit(draw);
    renderDrawing();
  }
  addEventListener("resize", resize);
  const cycle = $("color-cycle"),
    palette = $("color-palette");
  let holdTimer = null,
    holdFired = false,
    holdStart = null,
    suppressClick = false;
  function updateCycle() {
    cycle.style.background = color;
    cycle.style.borderColor = color === "#ffffff" ? "#aaa" : "#fff";
    cycle.setAttribute(
      "aria-label",
      "現在の色：" +
        (paletteColors.find((p) => p[1] === color)?.[0] || "色") +
        "。タップで次の色、長押しで全色",
    );
  }
  function closePalette() {
    palette.hidden = true;
    cycle.setAttribute("aria-expanded", "false");
  }
  function openPalette() {
    palette.hidden = false;
    cycle.setAttribute("aria-expanded", "true");
    for (const b of palette.children)
      b.setAttribute("aria-pressed", String(b.dataset.color === color));
  }
  paletteColors.forEach(([name, hex]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "palette-swatch";
    b.dataset.color = hex;
    b.style.background = hex;
    b.setAttribute("aria-label", name);
    b.title = name;
    b.onclick = () => {
      color = hex;
      updateCycle();
      closePalette();
      renderDrawing();
    };
    palette.append(b);
  });
  updateCycle();
  cycle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    holdFired = false;
    holdStart = { x: e.clientX, y: e.clientY };
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      holdFired = true;
      suppressClick = true;
      openPalette();
      if (navigator.vibrate) navigator.vibrate(20);
    }, 480);
  });
  cycle.addEventListener("pointermove", (e) => {
    if (
      holdStart &&
      Math.hypot(e.clientX - holdStart.x, e.clientY - holdStart.y) > 12
    )
      clearTimeout(holdTimer);
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"])
    cycle.addEventListener(ev, () => {
      clearTimeout(holdTimer);
      holdStart = null;
    });
  cycle.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    clearTimeout(holdTimer);
    holdFired = true;
    suppressClick = true;
    openPalette();
  });
  cycle.onclick = () => {
    if (suppressClick || holdFired) {
      suppressClick = false;
      holdFired = false;
      return;
    }
    if (!palette.hidden) {
      closePalette();
      return;
    }
    color = colors[(colors.indexOf(color) + 1) % colors.length];
    updateCycle();
    renderDrawing();
  };
  document.addEventListener("pointerdown", (e) => {
    if (!palette.hidden && !e.target.closest(".color-picker")) closePalette();
  });

  const templateDefs = [
    ["なし", "❌", ""],
    [
      "ねこ",
      "🐱",
      '<path d="M27 43 22 15 42 28Q60 22 78 28L98 15 93 43Q107 62 94 84Q80 104 60 101Q40 104 26 84Q13 62 27 43Z"/><path d="M42 62h3m30 0h3M55 77q5 7 10 0M29 75l-13 -4m13 12-13 4m75-12 13-4m-13 12 13 4"/>',
    ],
    [
      "いぬ",
      "🐶",
      '<path d="M34 31Q60 20 86 31Q99 46 94 76Q83 101 60 100Q37 101 26 76Q21 46 34 31Z"/><path d="M34 31Q13 22 12 47Q12 64 29 61M86 31Q107 22 108 47Q108 64 91 61M44 62h2m28 0h2M54 78q6 7 12 0"/>',
    ],
    [
      "うさぎ",
      "🐰",
      '<path d="M39 40Q25 5 36 5Q48 4 52 37M68 37Q72 4 84 5Q95 5 81 40M60 33Q99 32 99 68Q99 100 60 101Q21 100 21 68Q21 32 60 33Z"/><path d="M43 67h2m30 0h2M56 80q4 5 8 0"/>',
    ],
    [
      "くるま",
      "🚗",
      '<path d="M18 52 31 30H89L102 52V83H18Z"/><path d="M25 52h70M42 30 36 52M78 30 84 52"/><circle cx="37" cy="84" r="11"/><circle cx="83" cy="84" r="11"/>',
    ],
    [
      "おはな",
      "🌸",
      '<circle cx="60" cy="52" r="12"/><path d="M48 46Q18 12 43 8Q60 5 60 34Q60 5 77 8Q102 12 72 46Q105 24 111 49Q113 70 75 61Q102 83 82 99Q63 111 60 69Q57 111 38 99Q18 83 45 61Q7 70 9 49Q15 24 48 46Z"/><circle cx="60" cy="52" r="12"/>',
    ],
    [
      "おさかな",
      "🐟",
      '<path d="M21 55Q51 15 94 55Q51 95 21 55Z"/><path d="M93 55 113 30V80Z M54 35 65 16 78 37 M54 75 65 94 78 73"/><circle cx="39" cy="50" r="3"/>',
    ],
    [
      "ほし",
      "⭐",
      '<path d="M60 9 74 40 108 44 82 67 89 102 60 84 31 102 38 67 12 44 46 40Z"/>',
    ],
    [
      "きょうりゅう",
      "🦕",
      '<path d="M26 89Q14 74 19 55L10 37 31 45 42 28 54 38 67 19Q91 8 101 26Q111 43 90 47L82 60Q95 75 91 88L75 88 70 74 54 76 49 89Z"/><circle cx="86" cy="30" r="2.5"/>',
    ],
  ];
  const templateImages = templateDefs.map(([name, emoji, paths]) => {
    if (!paths) return null;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 110"><g fill="white" stroke="#564b47" stroke-width="3.8" stroke-linejoin="round" stroke-linecap="round">' +
      paths +
      "</g></svg>";
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    img.onload = () => renderDrawing();
    return img;
  });
  let templateIndex = 0,
    templateHold = null,
    templateHoldFired = false,
    templateSuppress = false;
  const templateCycle = $("template-cycle"),
    templateList = $("template-list");
  function updateTemplate() {
    templateCycle.textContent = templateDefs[templateIndex][1];
    templateCycle.setAttribute(
      "aria-label",
      "塗り絵：" +
        templateDefs[templateIndex][0] +
        "。タップで切替、長押しで一覧",
    );
    for (const b of templateList.children)
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.index) === templateIndex),
      );
    renderDrawing();
  }
  function closeTemplates() {
    templateList.hidden = true;
    templateCycle.setAttribute("aria-expanded", "false");
  }
  function openTemplates() {
    closePalette();
    templateList.hidden = false;
    templateCycle.setAttribute("aria-expanded", "true");
  }
  templateDefs.forEach(([name, emoji], i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "template-option";
    b.dataset.index = i;
    b.setAttribute("aria-label", name);
    b.innerHTML = templateImages[i]
      ? '<img alt="" src="' +
        templateImages[i].src +
        '"><span>' +
        name +
        "</span>"
      : '<span style="font-size:28px">❌</span><span>なし</span>';
    b.onclick = () => {
      cancelFloat();
      templateIndex = i;
      strokes = [];
      pendingImage = null;
      updateTemplate();
      closeTemplates();
    };
    templateList.append(b);
  });
  templateCycle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    templateHoldFired = false;
    clearTimeout(templateHold);
    templateHold = setTimeout(() => {
      templateHoldFired = true;
      templateSuppress = true;
      openTemplates();
      if (navigator.vibrate) navigator.vibrate(20);
    }, 480);
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"])
    templateCycle.addEventListener(ev, () => clearTimeout(templateHold));
  templateCycle.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    clearTimeout(templateHold);
    templateHoldFired = true;
    templateSuppress = true;
    openTemplates();
  });
  templateCycle.onclick = () => {
    if (templateSuppress || templateHoldFired) {
      templateSuppress = false;
      templateHoldFired = false;
      return;
    }
    cancelFloat();
    templateIndex = (templateIndex + 1) % templateDefs.length;
    strokes = [];
    pendingImage = null;
    updateTemplate();
  };
  document.addEventListener("pointerdown", (e) => {
    if (!templateList.hidden && !e.target.closest(".template-picker"))
      closeTemplates();
  });

  function templateArt() {
    const img = templateImages[templateIndex];
    if (!img || !img.complete || !img.naturalWidth) return null;
    const c = document.createElement("canvas");
    c.width = 360;
    c.height = 330;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    ctx.save();
    ctx.scale(c.width, c.height);
    for (const p of strokes) {
      ink(ctx, [p], p.inkColor || color, 0.0014);
    }
    ctx.restore();
    return c;
  }
  let countdownTimer = null,
    countdownInterval = null,
    countdownEnd = 0;
  function cancelFloat() {
    clearTimeout(countdownTimer);
    clearInterval(countdownInterval);
    countdownTimer = null;
    countdownInterval = null;
    draw.parentElement.classList.remove("waiting");
    $("finish").disabled = false;
  }
  function scheduleFloat() {
    cancelFloat();
    if (!strokes.length && !pendingImage && !templateIndex)
      return toast("えを かいてね");
    countdownEnd = performance.now() + 5000;
    draw.parentElement.classList.add("waiting");
    $("finish").disabled = true;
    const hint = draw.parentElement.querySelector(".swipe-hint");
    const update = () => {
      const n = Math.max(
        0,
        Math.ceil((countdownEnd - performance.now()) / 1000),
      );
      $("countdown-number").textContent = String(n);
      if (n > 0) tone(440 + n * 55, 0.07, "sine", 0.022);
    };
    update();
    countdownInterval = setInterval(update, 1000);
    countdownTimer = setTimeout(() => {
      cancelFloat();
      if (!drawing) floatEditor();
    }, 5000);
  }
  $("finish").onclick = () => {
    startBgm();
    scheduleFloat();
  };
  function show(v) {
    if (!v) {
      cancelFloat();
      strokes = [];
      templateIndex = 0;
      updateTemplate();
      current = null;
      pendingImage = null;
      renderDrawing();
    }
  }
  $("clear").onclick = () => {
    cancelFloat();
    strokes = [];
    current = null;
    pendingImage = null;
    templateIndex = 0;
    updateTemplate();
  };
  function pt(e) {
    const r = draw.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  }
  function templatePoint(e) {
    const r = draw.getBoundingClientRect(),
      size = Math.min(r.width - 16, r.height - 10),
      tw = size,
      th = (size * 110) / 120;
    return {
      x: (e.clientX - r.left - (r.width - tw) / 2) / tw,
      y: (e.clientY - r.top - (r.height - th) / 2) / th,
    };
  }
  draw.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    startBgm();
    cancelFloat();
    draw.setPointerCapture(e.pointerId);
    drawing = true;
    if (pendingImage) {
      pendingImage = null;
      strokes = [];
    }
    current = [templateIndex ? templatePoint(e) : pt(e)];
    current.inkColor = color;
    strokes.push(current);
    soundDraw();
    renderDrawing();
  });
  draw.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    e.preventDefault();
    current.push(templateIndex ? templatePoint(e) : pt(e));
    soundDraw();
    renderDrawing();
  });
  function end() {
    if (!drawing) return;
    drawing = false;
    current = null;
  }
  draw.addEventListener("pointerup", end);
  draw.addEventListener("pointercancel", end);
  function ink(ctx, paths, c, scale = 1) {
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
  function renderDrawing() {
    const r = draw.getBoundingClientRect(),
      dw = r.width,
      dh = r.height;
    dc.clearRect(0, 0, dw, dh);
    if (templateIndex && templateImages[templateIndex]) {
      const art = templateArt();
      if (art) {
        const size = Math.min(dw - 16, dh - 10),
          tw = (size * 120) / 120,
          th = (size * 110) / 120,
          x = (dw - tw) / 2,
          y = (dh - th) / 2;
        dc.drawImage(art, x, y, tw, th);
      }
      return;
    }
    if (pendingImage) {
      const iw = pendingImage.width,
        ih = pendingImage.height,
        scale = Math.min((dw - 25) / iw, (dh - 18) / ih);
      dc.drawImage(
        pendingImage,
        (dw - iw * scale) / 2,
        (dh - ih * scale) / 2,
        iw * scale,
        ih * scale,
      );
      return;
    }
    dc.save();
    dc.scale(dw, dh);
    for (const path of strokes) ink(dc, [path], path.inkColor || color, 0.0014);
    dc.restore();
  }
  function bounds(paths) {
    let minX = 1,
      minY = 1,
      maxX = 0,
      maxY = 0;
    for (const p of paths)
      for (const q of p) {
        minX = Math.min(minX, q.x);
        minY = Math.min(minY, q.y);
        maxX = Math.max(maxX, q.x);
        maxY = Math.max(maxY, q.y);
      }
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(0.05, maxX - minX),
      height: Math.max(0.05, maxY - minY),
    };
  }
  function toast(t) {
    /* Playground stays text-free; no unsolicited overlays. */
  }
  function setCharacterAction(m, action, duration) {
    m.action = action;
    m.actionStart = tick;
    m.actionUntil = tick + duration;
  }
  function characterRadius(m) {
    if (m.image) {
      const scale = Math.min(
        Math.min(160, w * 0.4) / m.image.width,
        Math.min(170, h * 0.34) / m.image.height,
      );
      return Math.max(
        28,
        Math.min(72, Math.max(m.image.width, m.image.height) * scale * 0.45),
      );
    }
    return Math.max(28, (m.size || 75) * 0.54);
  }
  function worldPoint(e) {
    const r = world.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function characterAt(x, y) {
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i],
        bob = Math.sin(tick * 3 + m.phase) * 5,
        hitRadius = characterRadius(m) * (m.image ? 1.12 : 1.3);
      if (Math.hypot(x - m.x, y - (m.y + bob)) <= hitRadius) return m;
    }
    return null;
  }
  function placeCharacter(m, x, y) {
    const radius = Math.min(
      characterRadius(m),
      Math.max(18, Math.min(w, h) * 0.42),
    );
    m.x = Math.max(radius, Math.min(Math.max(radius, w - radius), x));
    m.y = Math.max(radius, Math.min(Math.max(radius, h - radius), y));
  }
  function moveGrabbedCharacter(e) {
    if (!grabbedMonster || e.pointerId !== grabbedPointerId) return;
    e.preventDefault();
    const point = worldPoint(e),
      now = performance.now(),
      dt = Math.max(0.016, (now - lastGrabAt) / 1000),
      vx = (point.x - lastGrabX) / dt,
      vy = (point.y - lastGrabY) / dt;
    placeCharacter(
      grabbedMonster,
      point.x + grabOffsetX,
      point.y + grabOffsetY,
    );
    grabbedMonster.dragVX = Math.max(
      -150,
      Math.min(150, grabbedMonster.dragVX * 0.45 + vx * 0.55),
    );
    grabbedMonster.dragVY = Math.max(
      -150,
      Math.min(150, grabbedMonster.dragVY * 0.45 + vy * 0.55),
    );
    grabbedMonster.vx = 0;
    grabbedMonster.vy = 0;
    lastGrabX = point.x;
    lastGrabY = point.y;
    lastGrabAt = now;
  }
  function releaseGrab(e, keepMomentum = true) {
    if (!grabbedMonster || (e && e.pointerId !== grabbedPointerId)) return;
    const m = grabbedMonster;
    grabbedMonster = null;
    grabbedPointerId = null;
    m.vx = keepMomentum ? m.dragVX * 0.45 : 0;
    m.vy = keepMomentum ? m.dragVY * 0.45 : 0;
    m.turnIn = 1.2;
    m.nextActionAt = Math.max(m.nextActionAt, tick + 2.5);
    m.sweatUntil = tick + 0.35;
    setCharacterAction(m, "relieved", 0.8);
    world.style.cursor = bombMode ? "crosshair" : "default";
  }
  function avoidNearCollisions() {
    for (let i = 0; i < monsters.length; i++) {
      const a = monsters[i];
      if (a === grabbedMonster || a.bombEnd) continue;
      for (let j = i + 1; j < monsters.length; j++) {
        const b = monsters[j];
        if (b === grabbedMonster || b.bombEnd) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          rawDistance = Math.hypot(dx, dy),
          distance = Math.max(1, rawDistance),
          radiusSum = characterRadius(a) + characterRadius(b),
          closing = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy < 0;
        if (
          distance > radiusSum + 18 ||
          (!closing && distance > radiusSum * 0.88) ||
          tick < a.reactionCooldown ||
          tick < b.reactionCooldown
        ) {
          continue;
        }
        const nx = rawDistance ? dx / distance : Math.cos(a.phase - b.phase),
          ny = rawDistance ? dy / distance : Math.sin(a.phase - b.phase),
          kick = 70 + Math.random() * 35,
          mood = Math.random() < 0.5 ? "panic" : "angry";
        a.vx = -nx * kick - ny * 18;
        a.vy = -ny * kick + nx * 18;
        b.vx = nx * kick + ny * 18;
        b.vy = ny * kick - nx * 18;
        a.turnIn = 1.2;
        b.turnIn = 1.2;
        a.reactionCooldown = tick + 1.15;
        b.reactionCooldown = tick + 1.15;
        a.nextActionAt = tick + 3 + Math.random() * 3;
        b.nextActionAt = a.nextActionAt;
        setCharacterAction(a, mood, 0.85);
        setCharacterAction(b, mood === "panic" ? "angry" : "panic", 0.85);
      }
    }
  }
  function floatEditor() {
    if (!pendingImage && !strokes.length && !templateIndex) return;
    let m;
    if (templateIndex) {
      m = { image: templateArt() };
      if (!m.image) return;
    } else if (pendingImage) {
      m = { image: pendingImage };
    } else {
      const b = bounds(strokes),
        size = Math.min(90, Math.max(55, w * 0.16)),
        unit = size / Math.max(b.width, b.height),
        cx = (b.minX + b.maxX) / 2,
        cy = (b.minY + b.maxY) / 2;
      const paths = strokes.map((p) => {
        const path = p.map((q) => ({
          x: (q.x - cx) * unit,
          y: (q.y - cy) * unit,
        }));
        path.inkColor = p.inkColor || color;
        return path;
      });
      m = {
        paths,
        color,
        size,
        faceY: -Math.min(12, b.height * unit * 0.18),
        eyeOffset: Math.min(14, b.width * unit * 0.17),
      };
    }
    Object.assign(m, {
      x: Math.max(50, Math.random() * Math.max(1, w - 100) + 50),
      y: Math.max(50, Math.random() * Math.max(1, h - 100) + 50),
      vx: (Math.random() - 0.5) * 50,
      vy: (Math.random() - 0.5) * 30,
      turnIn: 1,
      phase: Math.random() * 6.28,
      age: 0,
      action: "",
      actionStart: 0,
      actionUntil: 0,
      nextActionAt: tick + 2.5 + Math.random() * 3.5,
      reactionCooldown: 0,
      sweatUntil: 0,
      dragVX: 0,
      dragVY: 0,
    });
    monsters.push(m);
    if (monsters.length > 12) monsters.shift();
    show(false);
    soundFloat();
    toast("うかべたよ！");
  }
  $("bomb").onclick = () => {
    bombMode = !bombMode;
    $("bomb").classList.toggle("active", bombMode);
    $("bomb").setAttribute("aria-pressed", String(bombMode));
    $("bomb").setAttribute(
      "aria-label",
      bombMode ? "爆弾モードをオフ" : "爆弾モードをオン",
    );
    world.style.cursor = bombMode ? "crosshair" : "default";
    toast(bombMode ? "キャラクターをタップしてね" : "爆弾モードを終了");
  };
  world.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const point = worldPoint(e),
      m = characterAt(point.x, point.y);
    if (bombMode) {
      if (!m) return;
      if (!m.bombEnd) {
        m.bombEnd = performance.now() + 10000;
        m.lastBombSecond = 11;
        soundTick(10);
        toast("10秒後に爆発！");
      } else toast("カウントダウン中！");
      return;
    }
    if (!m) return;
    e.preventDefault();
    grabbedMonster = m;
    grabbedPointerId = e.pointerId;
    grabOffsetX = m.x - point.x;
    grabOffsetY = m.y - point.y;
    lastGrabX = point.x;
    lastGrabY = point.y;
    lastGrabAt = performance.now();
    m.dragVX = 0;
    m.dragVY = 0;
    m.vx = 0;
    m.vy = 0;
    m.sweatUntil = tick + 0.45;
    setCharacterAction(m, "sweat", 0.5);
    world.setPointerCapture(e.pointerId);
    world.style.cursor = "grabbing";
  });
  world.addEventListener("pointermove", (e) => {
    if (grabbedMonster && e.pointerId === grabbedPointerId) {
      moveGrabbedCharacter(e);
      return;
    }
    if (!bombMode) {
      const point = worldPoint(e);
      world.style.cursor = characterAt(point.x, point.y) ? "grab" : "default";
    }
  });
  world.addEventListener("pointerup", (e) => releaseGrab(e));
  world.addEventListener("pointercancel", (e) => releaseGrab(e, false));
  world.addEventListener("lostpointercapture", (e) => releaseGrab(e, false));
  function explode(m) {
    soundExplosion();
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2,
        sp = 35 + Math.random() * 110;
      particles.push({
        x: m.x,
        y: m.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.55 + Math.random() * 0.45,
        max: 1,
        color: ["#ffdc6c", "#ff8c6c", "#ffffff", "#e66d62"][i % 4],
        r: 3 + Math.random() * 7,
      });
    }
  }
  function bg(ctx) {
    ctx.fillStyle = "#ffffff70";
    for (let i = 0; i < 8; i++) {
      const x = (i * 157 + 43) % Math.max(w, 1),
        y = 45 + ((i * 73) % Math.max(h * 0.45, 1));
      ctx.beginPath();
      ctx.arc(x, y, 4 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff9a";
    for (const [x, y, s] of [
      [0.18, 0.17, 1],
      [0.75, 0.27, 0.8],
    ]) {
      ctx.beginPath();
      ctx.ellipse(w * x, h * y, 37 * s, 13 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(
        w * x - 20 * s,
        h * y - 7 * s,
        22 * s,
        15 * s,
        0,
        0,
        Math.PI * 2,
      );
      ctx.ellipse(
        w * x + 16 * s,
        h * y - 8 * s,
        25 * s,
        17 * s,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
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
  function drawActionEffects(ctx, m, t, action) {
    const size = characterRadius(m) * 1.6;
    if (m === grabbedMonster || action === "sweat" || t < m.sweatUntil) {
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
    }
  }
  function monster(ctx, m, t) {
    const action =
        m === grabbedMonster ? "sweat" : t < m.actionUntil ? m.action : "",
      actionProgress = action
        ? Math.min(1, (t - m.actionStart) / (m.actionUntil - m.actionStart))
        : 0,
      jumpHeight =
        action === "jump" ? Math.sin(actionProgress * Math.PI) * 20 : 0,
      bob = Math.sin(t * 3 + m.phase) * 5 - jumpHeight,
      dancing = action === "dance",
      grabbed = m === grabbedMonster,
      bounce = dancing
        ? 1 + Math.sin(t * 12 + m.phase) * 0.1
        : 1 + Math.sin(t * 3 + m.phase) * 0.035,
      twist = dancing ? Math.sin(t * 10 + m.phase) * 0.16 : 0;
    ctx.save();
    ctx.translate(m.x, m.y + bob);
    ctx.scale((grabbed ? 1.06 : 1) / bounce, bounce / (grabbed ? 1.04 : 1));
    ctx.rotate(Math.sin(t * 1.7 + m.phase) * 0.055 + twist);
    ctx.globalAlpha = Math.min(1, m.age * 3);
    if (m.image) {
      const iw = m.image.width,
        ih = m.image.height,
        scale = Math.min(
          Math.min(160, w * 0.4) / iw,
          Math.min(170, h * 0.34) / ih,
        );
      ctx.drawImage(
        m.image,
        (-iw * scale) / 2,
        (-ih * scale) / 2,
        iw * scale,
        ih * scale,
      );
      drawActionEffects(ctx, m, t, action);
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
    for (const path of m.paths) ink(ctx, [path], path.inkColor || m.color, 1);
    const fy = m.faceY;
    if (action === "relieved" || dancing) {
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
    } else {
      ctx.arc(0, fy + 15, 5, 0, Math.PI);
      ctx.stroke();
    }
    drawActionEffects(ctx, m, t, action);
    ctx.restore();
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick += dt;
    wc.clearRect(0, 0, w, h);
    bg(wc);
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (m.bombEnd && now >= m.bombEnd) {
        explode(m);
        monsters.splice(i, 1);
        continue;
      }
      m.age += dt;
      if (m === grabbedMonster) {
        m.vx = 0;
        m.vy = 0;
        continue;
      }
      m.turnIn -= dt;
      if (m.turnIn <= 0) {
        m.turnIn = 0.4 + Math.random() * 2.8;
        const a = Math.random() * Math.PI * 2,
          speed = 10 + Math.random() * 40;
        m.vx = Math.cos(a) * speed;
        m.vy = Math.sin(a) * speed;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < 40) {
        m.x = 40;
        m.vx = Math.abs(m.vx);
      }
      if (m.x > w - 40) {
        m.x = w - 40;
        m.vx = -Math.abs(m.vx);
      }
      if (m.y < 45) {
        m.y = 45;
        m.vy = Math.abs(m.vy);
      }
      if (m.y > h - 40) {
        m.y = h - 40;
        m.vy = -Math.abs(m.vy);
      }
      if (!m.bombEnd && tick >= m.nextActionAt && tick >= m.actionUntil) {
        const action = Math.random() < 0.5 ? "jump" : "dance";
        setCharacterAction(m, action, action === "jump" ? 0.85 : 1.35);
        m.nextActionAt = tick + 4 + Math.random() * 5;
      }
    }
    avoidNearCollisions();
    for (const m of monsters) {
      monster(wc, m, tick);
      if (m.bombEnd) {
        const remaining = Math.max(0, Math.ceil((m.bombEnd - now) / 1000));
        if (remaining !== m.lastBombSecond) {
          m.lastBombSecond = remaining;
          soundTick(remaining);
        }
        wc.save();
        wc.font = "900 22px system-ui";
        wc.textAlign = "center";
        wc.lineWidth = 4;
        wc.strokeStyle = "#513b37";
        wc.fillStyle = "#fff";
        wc.restore();
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      wc.globalAlpha = Math.min(1, p.life * 2);
      wc.fillStyle = p.color;
      wc.beginPath();
      wc.arc(p.x, p.y, p.r * Math.min(1, p.life * 2), 0, Math.PI * 2);
      wc.fill();
    }
    wc.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  $("upload").onclick = () => $("image-input").click();
  $("image-input").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("画像を選んでね");
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        cancelFloat();
        pendingImage = img;
        strokes = [];
        renderDrawing();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast("画像を読み込めませんでした");
      };
      img.src = url;
    } catch (err) {
      toast("画像を読み込めませんでした");
    }
    e.target.value = "";
  });
  $("photo").onclick = () => {
    const out = document.createElement("canvas");
    out.width = 1200;
    out.height = 1200;
    const c = out.getContext("2d");
    c.fillStyle = "#ccecf0";
    c.fillRect(0, 0, 1200, 1200);
    c.fillStyle = "#b7dd94";
    c.fillRect(0, 880, 1200, 320);
    const s = Math.min(1200 / Math.max(w, 1), 1000 / Math.max(h, 1));
    c.save();
    c.translate((1200 - w * s) / 2, (1000 - h * s) / 2 + 90);
    c.scale(s, s);
    for (const m of monsters) monster(c, m, tick);
    c.restore();
    c.fillStyle = "#5b4c42";
    c.font = "bold 42px sans-serif";
    c.fillText("うかべてあそぼ", 38, 68);
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "ukabete-asobo.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };
  $("reset").onclick = () => {
    monsters = [];
    particles = [];
  };
  resize();
  requestAnimationFrame(frame);
})();
