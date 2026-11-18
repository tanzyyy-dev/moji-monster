(() => {
  const $ = (id) => document.getElementById(id),
    app = document.querySelector(".app"),
    topbar = document.querySelector(".topbar"),
    world = $("world"),
    wc = world.getContext("2d"),
    draw = $("draw"),
    dc = draw.getContext("2d");
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => {
    if (!e.target.closest("input")) e.preventDefault();
  });
  // Pinch zoom would break the full-screen play area: block Safari's gesture
  // events, trackpad pinch (ctrl+wheel) and any two-finger touch zoom fallback.
  for (const type of ["gesturestart", "gesturechange", "gestureend"])
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  document.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
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
    pendingImageFullCanvas = false,
    floatTimer = null,
    w = 0,
    h = 0,
    last = performance.now(),
    tick = 0,
    bombMode = false,
    particles = [],
    nightProgress = 0,
    dayReturnAt = 0,
    skyFlash = 0,
    skyFlashColor = "#ffffff",
    photoInProgress = false,
    fireworksInProgress = false,
    fireworksStartedAt = 0,
    photoSessionId = 0;
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
  let masterBus = null;
  function output(c, pan = 0) {
    if (!masterBus) {
      // Gentle compressor so layered booms stay punchy without clipping.
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      comp.connect(c.destination);
      masterBus = comp;
    }
    if (!pan || !c.createStereoPanner) return masterBus;
    const panner = c.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(masterBus);
    return panner;
  }
  function tone(
    freq,
    duration = 0.1,
    type = "sine",
    volume = 0.055,
    delay = 0,
    endFreq = null,
    pan = 0,
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
    o.connect(g).connect(output(c, pan));
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  let noiseBuffer = null;
  function noise(
    duration = 0.2,
    volume = 0.05,
    delay = 0,
    filterFreq = 1200,
    filterType = "lowpass",
    endFilterFreq = null,
    pan = 0,
    attack = 0.006,
  ) {
    const c = audio();
    if (!c) return;
    if (!noiseBuffer) {
      noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + delay,
      src = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      g = c.createGain();
    src.buffer = noiseBuffer;
    src.loop = true;
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, t);
    if (endFilterFreq)
      filter.frequency.exponentialRampToValueAtTime(endFilterFreq, t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(g).connect(output(c, pan));
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration + 0.02);
  }
  function soundRocket(pan = 0) {
    // "Hyuuu~": a rising whistle with a little wobble plus airy hiss.
    tone(480, 0.9, "sine", 0.04, 0, 1650, pan);
    tone(492, 0.9, "triangle", 0.014, 0.015, 1700, pan);
    tone(960, 0.6, "sine", 0.008, 0.25, 2600, pan);
    noise(0.85, 0.02, 0, 1800, "bandpass", 6000, pan, 0.08);
    noise(0.12, 0.05, 0, 900, "lowpass", 200, pan);
  }
  function soundBurst(pan = 0) {
    // "Doon!": sharp crack, deep body, echo, then a long crackle tail.
    noise(0.07, 0.2, 0, 5000, "highpass", null, pan, 0.002);
    tone(150, 0.7, "sine", 0.2, 0, 34, pan);
    tone(75, 0.9, "sine", 0.16, 0.01, 28, pan);
    noise(1.1, 0.16, 0, 2400, "lowpass", 90, pan, 0.004);
    tone(120, 0.6, "sine", 0.05, 0.32, 30, -pan * 0.6);
    noise(0.8, 0.045, 0.32, 900, "lowpass", 80, -pan * 0.6);
    for (let i = 0; i < 26; i++) {
      const at = 0.25 + Math.random() * 1.3;
      noise(
        0.025 + Math.random() * 0.03,
        0.025 + Math.random() * 0.05 * (1.4 - at / 1.6),
        at,
        3000 + Math.random() * 5000,
        "highpass",
        null,
        pan + (Math.random() - 0.5) * 0.8,
        0.002,
      );
    }
  }
  function soundCheer() {
    tone(784, 0.12, "triangle", 0.035, 0.05);
    tone(1047, 0.12, "triangle", 0.035, 0.15);
    tone(1319, 0.22, "triangle", 0.03, 0.25);
  }
  function soundShutter() {
    noise(0.045, 0.16, 0, 2600, "highpass");
    tone(1900, 0.03, "square", 0.025, 0);
    noise(0.07, 0.12, 0.085, 1800, "bandpass");
    tone(1300, 0.04, "square", 0.02, 0.09);
  }
  function soundPhotoCue() {
    tone(660, 0.09, "sine", 0.035);
    tone(990, 0.12, "sine", 0.03, 0.08);
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
  function soundTick(n, pan = 0) {
    tone(n <= 3 ? 880 : 620, 0.09, "square", n <= 3 ? 0.035 : 0.024, 0, null, pan);
    if (n <= 3) tone(1320, 0.07, "square", 0.02, 0.12, null, pan);
    soundFuse(pan);
  }
  function soundExplosion(pan = 0) {
    // Cartoon "BOOM": crack, heavy thump, roaring noise, debris rattle.
    noise(0.09, 0.28, 0, 4200, "highpass", null, pan, 0.002);
    tone(180, 0.65, "sawtooth", 0.11, 0, 32, pan);
    tone(95, 1.0, "sine", 0.26, 0, 24, pan);
    tone(48, 1.2, "sine", 0.2, 0.02, 22, pan);
    noise(1.3, 0.26, 0, 3200, "lowpass", 70, pan, 0.003);
    noise(0.6, 0.08, 0.05, 700, "bandpass", 180, pan);
    for (let i = 0; i < 12; i++)
      noise(
        0.04 + Math.random() * 0.06,
        0.04 + Math.random() * 0.05,
        0.12 + Math.random() * 0.7,
        1500 + Math.random() * 3500,
        "bandpass",
        null,
        pan + (Math.random() - 0.5),
        0.003,
      );
    tone(1200, 0.5, "sine", 0.012, 0.15, 1150);
  }
  function soundFuse(pan = 0) {
    noise(0.16, 0.02, 0, 6000, "highpass", null, pan);
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
    positionOpenMenus();
  }
  addEventListener("resize", resize);
  const cycle = $("color-cycle"),
    palette = $("color-palette"),
    paletteColorList = $("palette-colors"),
    brushCycle = $("brush-cycle"),
    brushMenu = $("brush-menu");
  let brushMode = "pen";
  const brushModeNames = {
    pen: "ペン",
    thick: "太ペン",
    fill: "ペンキ",
  };
  const brushModeIcons = {
    pen: "pencil.svg",
    thick: "pencil-line.svg",
    fill: "paint-bucket.svg",
  };
  function lucideIcon(fileName) {
    const img = document.createElement("img");
    img.className = "lucide-icon";
    img.src = "./assets/icons/" + fileName;
    img.alt = "";
    return img;
  }
  function brushScale() {
    return brushMode === "thick" ? 0.0028 : 0.0014;
  }
  function positionMenu(menu, trigger) {
    if (menu.hidden) return;
    menu.style.left = "0px";
    menu.style.top = "0px";
    const menuRect = menu.getBoundingClientRect(),
      triggerRect = trigger.getBoundingClientRect(),
      viewportWidth = document.documentElement.clientWidth,
      viewportHeight = document.documentElement.clientHeight,
      left = Math.max(
        8,
        Math.min(triggerRect.left, viewportWidth - menuRect.width - 8),
      ),
      above = triggerRect.top - menuRect.height - 10,
      below = triggerRect.bottom + 10,
      top = Math.max(
        8,
        Math.min(above >= 8 ? above : below, viewportHeight - menuRect.height - 8),
      );
    menu.style.left = left + "px";
    menu.style.top = top + "px";
  }
  function positionOpenMenus() {
    positionMenu(palette, cycle);
    positionMenu(brushMenu, brushCycle);
    positionMenu(assetList, assetCycle);
  }
  function closePalette() {
    palette.hidden = true;
    cycle.setAttribute("aria-expanded", "false");
  }
  function closeBrushMenu() {
    brushMenu.hidden = true;
    brushCycle.setAttribute("aria-expanded", "false");
  }
  function closeAssets() {
    assetList.hidden = true;
    assetCycle.setAttribute("aria-expanded", "false");
  }
  function updateBrushMenu() {
    for (const button of brushMenu.children)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mode === brushMode),
      );
    brushCycle.replaceChildren(lucideIcon(brushModeIcons[brushMode]));
    brushCycle.setAttribute(
      "aria-label",
      "現在の描画方法：" + brushModeNames[brushMode] + "。タップで変更",
    );
  }
  function updateCycle() {
    cycle.style.background = color;
    cycle.style.borderColor = color === "#ffffff" ? "#aaa" : "#fff";
    cycle.setAttribute(
      "aria-label",
      "現在の色：" +
        (paletteColors.find((p) => p[1] === color)?.[0] || "色") +
        "。タップで色を変更",
    );
  }
  function openPalette() {
    closeBrushMenu();
    closeAssets();
    palette.hidden = false;
    cycle.setAttribute("aria-expanded", "true");
    positionMenu(palette, cycle);
  }
  function openBrushMenu() {
    closePalette();
    closeAssets();
    brushMenu.hidden = false;
    brushCycle.setAttribute("aria-expanded", "true");
    positionMenu(brushMenu, brushCycle);
  }
  function openAssets() {
    closePalette();
    closeBrushMenu();
    updateAssets();
    assetList.hidden = false;
    assetCycle.setAttribute("aria-expanded", "true");
    positionMenu(assetList, assetCycle);
  }
  function updatePalette() {
    for (const button of paletteColorList.children)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.color === color),
      );
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
      updatePalette();
      closePalette();
      renderDrawing();
    };
    paletteColorList.append(b);
  });
  updateCycle();
  Object.entries(brushModeNames).forEach(([mode, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "brush-option";
    button.dataset.mode = mode;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.setAttribute("aria-pressed", String(mode === brushMode));
    button.append(lucideIcon(brushModeIcons[mode]));
    button.onclick = () => {
      brushMode = mode;
      updateBrushMenu();
      closeBrushMenu();
    };
    brushMenu.append(button);
  });
  updateBrushMenu();
  updatePalette();
  cycle.onclick = () => {
    if (palette.hidden) openPalette();
    else closePalette();
  };
  brushCycle.onclick = () => {
    if (brushMenu.hidden) openBrushMenu();
    else closeBrushMenu();
  };
  document.addEventListener("pointerdown", (e) => {
    const target = e.target;
    if (!palette.hidden && !palette.contains(target) && !cycle.contains(target))
      closePalette();
    if (
      !brushMenu.hidden &&
      !brushMenu.contains(target) &&
      !brushCycle.contains(target)
    )
      closeBrushMenu();
    if (
      !assetList.hidden &&
      !assetList.contains(target) &&
      !assetCycle.contains(target)
    )
      closeAssets();
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
    templateFills = [];
  const assetCycle = $("asset-cycle"),
    assetList = $("asset-list"),
    imageInput = $("image-input");
  function updateAssets() {
    for (const button of assetList.querySelectorAll("[data-template-index]"))
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.templateIndex) === templateIndex),
      );
  }
  templateDefs.slice(1).forEach(([name], index) => {
    const i = index + 1;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "template-option";
    b.dataset.templateIndex = i;
    b.setAttribute("aria-label", name);
    b.setAttribute("aria-pressed", String(i === templateIndex));
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
      templateFills = [];
      strokes = [];
      pendingImage = null;
      pendingImageFullCanvas = false;
      updateAssets();
      renderDrawing();
      closeAssets();
    };
    assetList.append(b);
  });
  const uploadOption = document.createElement("button");
  uploadOption.type = "button";
  uploadOption.className = "asset-upload-option";
  uploadOption.setAttribute("aria-label", "写真を選ぶ");
  uploadOption.append(assetCycle.querySelector(".lucide-icon").cloneNode(true));
  uploadOption.onclick = () => {
    closeAssets();
    imageInput.click();
  };
  assetList.append(uploadOption);
  assetCycle.onclick = () => {
    if (assetList.hidden) openAssets();
    else closeAssets();
  };

  function hexRgb(hex) {
    const value = Number.parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  function floodFillCanvas(
    canvas,
    x,
    y,
    fillColor,
    { templateOnly = false, allowedColors = [] } = {},
  ) {
    const width = canvas.width,
      height = canvas.height;
    x = Math.max(0, Math.min(width - 1, Math.floor(x)));
    y = Math.max(0, Math.min(height - 1, Math.floor(y)));
    const ctx = canvas.getContext("2d", { willReadFrequently: true }),
      imageData = ctx.getImageData(0, 0, width, height),
      pixels = imageData.data,
      start = y * width + x,
      startOffset = start * 4,
      target = [
        pixels[startOffset],
        pixels[startOffset + 1],
        pixels[startOffset + 2],
        pixels[startOffset + 3],
      ],
      whiteRegion =
        target[3] > 220 &&
        target[0] > 235 &&
        target[1] > 235 &&
        target[2] > 235,
      allowedRegion = allowedColors.some((hex) => {
        const rgb = hexRgb(hex);
        return (
          target[3] > 220 &&
          Math.abs(target[0] - rgb[0]) <= 6 &&
          Math.abs(target[1] - rgb[1]) <= 6 &&
          Math.abs(target[2] - rgb[2]) <= 6
        );
      });
    if (templateOnly && !whiteRegion && !allowedRegion) return false;
    const fill = hexRgb(fillColor),
      transparentTarget = target[3] < 16,
      tolerance = templateOnly ? (whiteRegion ? 26 : 6) : 24,
      queue = new Int32Array(width * height),
      queued = new Uint8Array(width * height);
    if (
      !transparentTarget &&
      Math.abs(target[0] - fill[0]) <= 1 &&
      Math.abs(target[1] - fill[1]) <= 1 &&
      Math.abs(target[2] - fill[2]) <= 1
    ) {
      return false;
    }
    const matches = (index) => {
      const offset = index * 4;
      if (transparentTarget) return pixels[offset + 3] < 16;
      return (
        pixels[offset + 3] > (templateOnly ? 210 : 16) &&
        Math.abs(pixels[offset] - target[0]) <= tolerance &&
        Math.abs(pixels[offset + 1] - target[1]) <= tolerance &&
        Math.abs(pixels[offset + 2] - target[2]) <= tolerance
      );
    };
    let head = 0,
      tail = 0,
      changed = 0;
    const enqueue = (index) => {
      if (index >= 0 && !queued[index]) {
        queued[index] = 1;
        queue[tail++] = index;
      }
    };
    queue[tail++] = start;
    queued[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      if (!matches(index)) continue;
      const offset = index * 4;
      pixels[offset] = fill[0];
      pixels[offset + 1] = fill[1];
      pixels[offset + 2] = fill[2];
      if (transparentTarget) pixels[offset + 3] = 255;
      changed++;
      const px = index % width;
      if (px > 0) enqueue(index - 1);
      if (px < width - 1) enqueue(index + 1);
      if (index >= width) enqueue(index - width);
      if (index < width * (height - 1)) enqueue(index + width);
    }
    if (!changed) return false;
    ctx.putImageData(imageData, 0, 0);
    return true;
  }
  function applyTemplateFill(point) {
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
    const art = templateArt();
    if (!art) return;
    if (
      floodFillCanvas(
        art,
        point.x * art.width,
        point.y * art.height,
        color,
        {
          templateOnly: true,
          allowedColors: templateFills.map((fill) => fill.color),
        },
      )
    ) {
      templateFills.push({ x: point.x, y: point.y, color });
      renderDrawing();
    }
  }
  function fillCurrentArtwork(point) {
    const canvas = document.createElement("canvas");
    canvas.width = draw.width;
    canvas.height = draw.height;
    canvas
      .getContext("2d", { willReadFrequently: true })
      .drawImage(draw, 0, 0);
    if (
      floodFillCanvas(
        canvas,
        point.x * canvas.width,
        point.y * canvas.height,
        color,
      )
    ) {
      templateIndex = 0;
      templateFills = [];
      pendingImage = canvas;
      pendingImageFullCanvas = true;
      strokes = [];
      current = null;
      updateAssets();
      renderDrawing();
    }
  }
  function templateArt() {
    const img = templateImages[templateIndex];
    if (!img || !img.complete || !img.naturalWidth) return null;
    const c = document.createElement("canvas");
    c.width = 360;
    c.height = 330;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (let i = 0; i < templateFills.length; i++) {
      const fill = templateFills[i];
      floodFillCanvas(c, fill.x * c.width, fill.y * c.height, fill.color, {
        templateOnly: true,
        allowedColors: templateFills.slice(0, i).map((entry) => entry.color),
      });
    }
    ctx.save();
    ctx.scale(c.width, c.height);
    for (const p of strokes) {
      ink(ctx, [p], p.inkColor || color, p.brushScale || 0.0014);
    }
    ctx.restore();
    return c;
  }
  function composeDrawing() {
    const rect = draw.getBoundingClientRect(),
      canvas = document.createElement("canvas");
    canvas.width = draw.width;
    canvas.height = draw.height;
    const ctx = canvas.getContext("2d"),
      scaleX = canvas.width / Math.max(1, rect.width),
      scaleY = canvas.height / Math.max(1, rect.height);
    if (pendingImage) {
      if (pendingImageFullCanvas) {
        ctx.drawImage(pendingImage, 0, 0, canvas.width, canvas.height);
      } else {
        const scale = Math.min(
            (rect.width - 25) / pendingImage.width,
            (rect.height - 18) / pendingImage.height,
          ),
          imageWidth = pendingImage.width * scale,
          imageHeight = pendingImage.height * scale;
        ctx.drawImage(
          pendingImage,
          ((rect.width - imageWidth) / 2) * scaleX,
          ((rect.height - imageHeight) / 2) * scaleY,
          imageWidth * scaleX,
          imageHeight * scaleY,
        );
      }
    }
    ctx.save();
    ctx.scale(canvas.width, canvas.height);
    for (const path of strokes)
      ink(ctx, [path], path.inkColor || color, path.brushScale || 0.0014);
    ctx.restore();
    return canvas;
  }
  let countdownTimer = null,
    countdownInterval = null,
    countdownEnd = 0,
    floatGhost = null;
  const FLOAT_DELAY = 5000;
  function removeFloatGhost(landed = false) {
    if (!floatGhost) return;
    const ghost = floatGhost;
    floatGhost = null;
    cancelAnimationFrame(ghost.raf);
    ghost.el.classList.add(landed ? "landed" : "dropped");
    setTimeout(() => ghost.el.remove(), 320);
  }
  let boundsScratch = null;
  function drawContentBounds() {
    // Find the visible pixels so the ghost lifts from the picture itself.
    const cw = draw.width,
      ch = draw.height;
    if (!cw || !ch) return null;
    // Scan a CPU-backed copy so the drawing canvas itself stays GPU-friendly.
    boundsScratch ??= document.createElement("canvas");
    boundsScratch.width = cw;
    boundsScratch.height = ch;
    const sc = boundsScratch.getContext("2d", { willReadFrequently: true });
    let data;
    try {
      sc.clearRect(0, 0, cw, ch);
      sc.drawImage(draw, 0, 0);
      data = sc.getImageData(0, 0, cw, ch).data;
    } catch {
      return null;
    }
    let minX = cw,
      minY = ch,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < ch; y += 2)
      for (let x = 0; x < cw; x += 2)
        if (data[(y * cw + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
    if (maxX < 0) return null;
    return { minX, minY, maxX: maxX + 2, maxY: maxY + 2 };
  }
  function floatLandingSize() {
    const displayScale = characterDisplayScale();
    if (!templateIndex && !pendingImage)
      return Math.min(90, Math.max(55, w * 0.16)) * displayScale * 1.15;
    return (
      Math.min(Math.min(160, w * 0.4), Math.min(170, h * 0.34)) *
      displayScale *
      0.9
    );
  }
  function startFloatGhost() {
    removeFloatGhost();
    const box = draw.getBoundingClientRect(),
      b = drawContentBounds();
    if (!b || !box.width) return;
    const ratio = draw.width / box.width,
      el = document.createElement("canvas"),
      cropW = b.maxX - b.minX,
      cropH = b.maxY - b.minY;
    el.className = "float-ghost";
    el.width = cropW;
    el.height = cropH;
    el.getContext("2d").drawImage(draw, b.minX, b.minY, cropW, cropH, 0, 0, cropW, cropH);
    const startW = cropW / ratio,
      startH = cropH / ratio,
      startX = box.left + b.minX / ratio + startW / 2,
      startY = box.top + b.minY / ratio + startH / 2,
      margin = Math.min(80, w * 0.18),
      landing = {
        x: margin + Math.random() * Math.max(1, w - margin * 2),
        y: h * (0.3 + Math.random() * 0.28),
      },
      endScale = Math.min(1, floatLandingSize() / Math.max(startW, startH)),
      sway = (Math.random() < 0.5 ? -1 : 1) * Math.min(60, w * 0.12);
    el.style.width = startW + "px";
    el.style.height = startH + "px";
    document.body.append(el);
    const ghost = {
      el,
      landing,
      startedAt: performance.now(),
      raf: 0,
      nextSparkAt: 0,
    };
    floatGhost = ghost;
    const ease = (p) => 0.5 - Math.cos(Math.PI * p) / 2;
    const step = (now) => {
      if (floatGhost !== ghost) return;
      const t = (now - ghost.startedAt) / 1000,
        wr = world.getBoundingClientRect(),
        endX = wr.left + landing.x,
        endY = wr.top + landing.y;
      let x = startX,
        y = startY,
        scale = 1,
        rotate = 0,
        squash = 1;
      if (t < 0.55) {
        // Peel off the paper: a little hop with squash and stretch.
        const p = t / 0.55;
        y -= Math.sin(p * Math.PI * 0.5) * 18;
        squash = 1 + Math.sin(p * Math.PI) * 0.12;
        scale = 1 + p * 0.06;
        rotate = Math.sin(p * Math.PI * 2) * 4;
      } else {
        const p = Math.min(1, (t - 0.55) / 3.9),
          e = ease(p),
          fromY = startY - 18;
        x = startX + (endX - startX) * e + Math.sin(p * Math.PI * 2) * sway * (1 - e);
        y = fromY + (endY - fromY) * e + Math.sin(t * 4.2) * 6 * (1 - e * 0.6);
        scale = 1.06 + (endScale - 1.06) * e;
        rotate = Math.sin(t * 3.1) * (9 - e * 5);
        squash = 1 + Math.sin(t * 6.3) * 0.035;
      }
      el.style.transform =
        `translate(${x - startW / 2}px, ${y - startH / 2}px) ` +
        `rotate(${rotate}deg) scale(${scale / squash}, ${scale * squash})`;
      if (t > 0.3 && now >= ghost.nextSparkAt) {
        ghost.nextSparkAt = now + 110;
        sparkle(
          x + (Math.random() - 0.5) * startW * scale * 0.7,
          y + startH * scale * 0.4,
        );
      }
      ghost.raf = requestAnimationFrame(step);
    };
    ghost.raf = requestAnimationFrame(step);
  }
  function setDrawLocked(locked) {
    document.querySelector(".inline-draw").classList.toggle("locked", locked);
    for (const button of document.querySelectorAll("#color-cycle, #brush-cycle, #asset-cycle, #clear"))
      button.disabled = locked;
    if (locked) {
      closePalette();
      closeBrushMenu();
      closeAssets();
    }
  }
  function cancelFloat() {
    clearTimeout(countdownTimer);
    clearInterval(countdownInterval);
    countdownTimer = null;
    countdownInterval = null;
    removeFloatGhost();
    draw.parentElement.classList.remove("waiting");
    setDrawLocked(false);
    $("finish").disabled = false;
  }
  function scheduleFloat() {
    if (photoInProgress || fireworksInProgress) return;
    cancelFloat();
    if (!strokes.length && !pendingImage && !templateIndex)
      return toast("えを かいてね");
    countdownEnd = performance.now() + FLOAT_DELAY;
    draw.parentElement.classList.add("waiting");
    setDrawLocked(true);
    $("finish").disabled = true;
    startFloatGhost();
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
      const landing = floatGhost?.landing;
      removeFloatGhost(true);
      cancelFloat();
      if (!drawing) floatEditor(landing);
    }, FLOAT_DELAY);
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
      templateFills = [];
      updateAssets();
      current = null;
      pendingImage = null;
      pendingImageFullCanvas = false;
      renderDrawing();
    }
  }
  $("clear").onclick = () => {
    cancelFloat();
    strokes = [];
    current = null;
    pendingImage = null;
    pendingImageFullCanvas = false;
    templateIndex = 0;
    templateFills = [];
    updateAssets();
    renderDrawing();
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
  function floatPending() {
    return countdownTimer !== null;
  }
  draw.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    startBgm();
    if (floatPending()) return;
    if (brushMode === "fill") {
      if (templateIndex) applyTemplateFill(templatePoint(e));
      else fillCurrentArtwork(pt(e));
      return;
    }
    draw.setPointerCapture(e.pointerId);
    drawing = true;
    current = [templateIndex ? templatePoint(e) : pt(e)];
    current.inkColor = color;
    current.brushScale = brushScale();
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
      if (pendingImageFullCanvas) {
        dc.drawImage(pendingImage, 0, 0, dw, dh);
      } else {
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
      }
    }
    dc.save();
    dc.scale(dw, dh);
    for (const path of strokes)
      ink(dc, [path], path.inkColor || color, path.brushScale || 0.0014);
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
  function characterDisplayScale() {
    return w <= 600 && h > w ? 0.68 : 1;
  }
  function baseCharacterRadius(m) {
    if (m.image) {
      const scale = Math.min(
        Math.min(160, w * 0.4) / m.image.width,
        Math.min(170, h * 0.34) / m.image.height,
      ) * characterDisplayScale();
      return Math.max(
        28,
        Math.min(72, Math.max(m.image.width, m.image.height) * scale * 0.45),
      );
    }
    return Math.max(28, (m.size || 75) * 0.54);
  }
  function characterRadius(m) {
    return baseCharacterRadius(m) * (m.presentationScale || 1);
  }
  function panFor(x) {
    return w ? (x / w) * 1.4 - 0.7 : 0;
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
  function floatEditor(landing = null) {
    if (photoInProgress || fireworksInProgress) return;
    if (!pendingImage && !strokes.length && !templateIndex) return;
    let m;
    if (templateIndex) {
      m = { image: templateArt() };
      if (!m.image) return;
    } else if (pendingImage) {
      m = { image: strokes.length ? composeDrawing() : pendingImage };
    } else {
      const b = bounds(strokes),
        displayScale = characterDisplayScale(),
        size = Math.min(90, Math.max(55, w * 0.16)) * displayScale,
        unit = size / Math.max(b.width, b.height),
        cx = (b.minX + b.maxX) / 2,
        cy = (b.minY + b.maxY) / 2;
      const paths = strokes.map((p) => {
        const path = p.map((q) => ({
          x: (q.x - cx) * unit,
          y: (q.y - cy) * unit,
        }));
        path.inkColor = p.inkColor || color;
        path.brushScale = (p.brushScale || 0.0014) * unit;
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
      x: landing
        ? landing.x
        : Math.max(50, Math.random() * Math.max(1, w - 100) + 50),
      y: landing
        ? landing.y
        : Math.max(50, Math.random() * Math.max(1, h - 100) + 50),
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
    if (landing) {
      const r = world.getBoundingClientRect();
      sparkle(r.left + m.x, r.top + m.y, true);
    }
    toast("うかべたよ！");
  }
  function setBombMode(on) {
    bombMode = on;
    $("bomb").classList.toggle("active", bombMode);
    $("bomb").setAttribute("aria-pressed", String(bombMode));
    $("bomb").setAttribute(
      "aria-label",
      bombMode ? "爆弾モードをオフ" : "爆弾モードをオン",
    );
    world.style.cursor = bombMode ? "crosshair" : "default";
  }
  $("bomb").onclick = () => setBombMode(!bombMode);
  function updateTopButtons() {
    // Top tools only make sense while at least one character is floating.
    const empty = monsters.length === 0,
      busy = photoInProgress || fireworksInProgress;
    if (empty && bombMode) setBombMode(false);
    for (const [id, off] of [
      ["photo", empty || busy],
      ["fireworks", empty || busy],
      ["bomb", empty || photoInProgress],
    ])
      if ($(id).disabled !== off) $(id).disabled = off;
  }
  world.addEventListener("pointerdown", (e) => {
    if (photoInProgress || (fireworksInProgress && !bombMode)) return;
    if (e.button !== 0) return;
    const point = worldPoint(e),
      m = characterAt(point.x, point.y);
    if (bombMode) {
      if (!m) return;
      if (!m.bombEnd) {
        m.bombEnd = performance.now() + 10000;
        m.lastBombSecond = 11;
        soundTick(10, panFor(m.x));
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
    soundExplosion(panFor(m.x));
    skyFlash = 1;
    skyFlashColor = "#ffcf6c";
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
  const fireworkShapes = ["ring", "heart", "smile", "star"];
  function fireworksBurst(m, shape = "ring") {
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
    skyFlash = 1;
    skyFlashColor = colors[0];
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
  }
  const fireworkCalls = $("firework-calls"),
    fireworkCallWords = ["た〜まや〜！", "か〜ぎや〜！", "どっか〜ん！", "ぱちぱち〜", "きれい〜！", "わ〜い！"];
  function fireworkCall(text, variant = 0) {
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
  function fireworkCallText(index) {
    if (index < 2) return fireworkCallWords[index];
    return fireworkCallWords[Math.floor(Math.random() * fireworkCallWords.length)];
  }
  function drawBombCountdown(ctx, m, remaining, now) {
    // Frameless badge: a little bomb with a sparking fuse plus the number.
    const danger = remaining <= 3,
      pulse = 1.2 * (1 + Math.sin(now / (danger ? 70 : 150)) * (danger ? 0.12 : 0.04)),
      shake = danger ? Math.sin(now / 28) * 1.6 : 0,
      badgeY = Math.max(26, m.y - characterRadius(m) - 24),
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
  function bg(ctx, width = w, height = h, topOffset = 0, totalHeight = height) {
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
      drawNightSky(ctx, width, height, totalHeight * 0.7 - topOffset);
  }
  function drawNightSky(ctx, width, height, horizonY) {
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
    const size = baseCharacterRadius(m) * 1.6;
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
        ) * characterDisplayScale();
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
    for (const path of m.paths)
      ink(ctx, [path], path.inkColor || m.color, path.brushScale || 1);
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
    if (fireworksInProgress) {
      dayReturnAt = 0;
      nightProgress = Math.min(1, nightProgress + dt / 3.2);
    }
    wc.clearRect(0, 0, w, h);
    bg(wc, w, h, topbar.offsetHeight, app.clientHeight);
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (m.bombEnd && now >= m.bombEnd) {
        explode(m);
        monsters.splice(i, 1);
        continue;
      }
      m.age += dt;
      if (photoInProgress) {
        const target = m.photoTarget,
          easing = 1 - Math.exp(-dt * 5);
        if (target) {
          m.x += (target.x - m.x) * easing;
          m.y += (target.y - m.y) * easing;
          m.presentationScale =
            (m.presentationScale || 1) +
            (target.scale - (m.presentationScale || 1)) * easing;
          if (
            Math.abs(target.x - m.x) < 0.2 &&
            Math.abs(target.y - m.y) < 0.2 &&
            Math.abs(target.scale - m.presentationScale) < 0.002
          ) {
            m.x = target.x;
            m.y = target.y;
            m.presentationScale = target.scale;
          }
        }
        m.vx = 0;
        m.vy = 0;
        continue;
      }
      if (fireworksInProgress && m.fireworkAt) {
        if (now < m.fireworkAt) {
          m.vx = 0;
          m.vy = 0;
          continue;
        }
        if (!m.fireworkStartAt) {
          m.fireworkStartAt = now;
          m.fireworkStartX = m.x;
          m.fireworkStartY = m.y;
          soundRocket(panFor(m.x));
        }
        const duration = 850,
          progress = Math.min(1, (now - m.fireworkStartAt) / duration);
        if (progress >= 1) {
          const order = m.fireworkOrder || 0;
          fireworksBurst(m, fireworkShapes[order % fireworkShapes.length]);
          soundBurst(panFor(m.x));
          soundCheer();
          fireworkCall(fireworkCallText(order), order);
          monsters.splice(i, 1);
          continue;
        }
        const eased = 1 - (1 - progress) ** 2,
          topLimit = Math.min(
            baseCharacterRadius(m) + 18,
            Math.max(0, m.fireworkStartY),
          ),
          targetY = Math.max(
            topLimit,
            Math.min(h * 0.26, m.fireworkStartY - 100),
          );
        m.x = m.fireworkStartX + Math.sin(progress * Math.PI) * 7;
        m.y = m.fireworkStartY - (m.fireworkStartY - targetY) * eased;
        if (Math.random() < 0.72) {
          particles.push({
            x: m.x + (Math.random() - 0.5) * 8,
            y: m.y + baseCharacterRadius(m) * 0.35,
            vx: (Math.random() - 0.5) * 18,
            vy: 16 + Math.random() * 32,
            life: 0.3 + Math.random() * 0.25,
            max: 1,
            color: Math.random() < 0.5 ? "#fff5bf" : "#ffbd70",
            r: 2 + Math.random() * 2.5,
          });
        }
        continue;
      }
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
    if (!photoInProgress && !fireworksInProgress) avoidNearCollisions();
    for (const m of monsters) {
      monster(wc, m, tick);
      if (m.bombEnd) {
        const remaining = Math.max(0, Math.ceil((m.bombEnd - now) / 1000));
        if (remaining !== m.lastBombSecond) {
          m.lastBombSecond = remaining;
          soundTick(remaining, panFor(m.x));
        }
        drawBombCountdown(wc, m, remaining, now);
      }
    }
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
        wc.globalCompositeOperation = "lighter";
        wc.globalAlpha = fade * 0.22 * flicker;
        wc.fillStyle = p.color;
        wc.beginPath();
        wc.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        wc.fill();
      }
      wc.globalAlpha = fade * flicker;
      wc.fillStyle = p.glow && p.life > 0.9 ? "#fffdf4" : p.color;
      wc.beginPath();
      wc.arc(p.x, p.y, p.r * fade, 0, Math.PI * 2);
      wc.fill();
      wc.globalCompositeOperation = "source-over";
    }
    wc.globalAlpha = 1;
    skyFlash = Math.max(0, skyFlash - dt * 2.4);
    if (!fireworksInProgress && dayReturnAt && now >= dayReturnAt) {
      nightProgress = Math.max(0, nightProgress - dt / 3);
      if (nightProgress <= 0) dayReturnAt = 0;
    }
    if (
      fireworksInProgress &&
      nightProgress >= 1 &&
      monsters.every((m) => !m.fireworkAt)
    ) {
      fireworksInProgress = false;
      dayReturnAt = now + 2200;
    }
    updateTopButtons();
    requestAnimationFrame(frame);
  }
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
        templateIndex = 0;
        templateFills = [];
        pendingImage = img;
        pendingImageFullCanvas = false;
        strokes = [];
        current = null;
        updateAssets();
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
  const photoButton = $("photo"),
    fireworksButton = $("fireworks"),
    photoStage = $("photo-stage"),
    photoMessage = $("photo-message"),
    photoMessageText = $("photo-message-text"),
    photoFlash = $("photo-flash");
  function photoTargets() {
    if (!monsters.length) return [];
    const marginX = Math.min(18, w * 0.05),
      marginY = Math.min(22, h * 0.05),
      bubbleSpace = Math.min(78, h * 0.16),
      areaWidth = Math.max(1, w - marginX * 2),
      areaHeight = Math.max(1, h - marginY * 2 - bubbleSpace),
      maxRadius = Math.max(...monsters.map(baseCharacterRadius));
    let best = { columns: 1, scale: 0 };
    for (let columns = 1; columns <= monsters.length; columns++) {
      const rows = Math.ceil(monsters.length / columns),
        cellWidth = areaWidth / columns,
        cellHeight = areaHeight / rows,
        scale = Math.min(
          1,
          cellWidth / (maxRadius * 2 + 24),
          cellHeight / (maxRadius * 2 + 24),
        );
      if (scale > best.scale) best = { columns, rows, cellWidth, cellHeight, scale };
    }
    return monsters.map((_, index) => {
      const row = Math.floor(index / best.columns),
        column = index % best.columns,
        rowCount = Math.min(best.columns, monsters.length - row * best.columns),
        rowWidth = rowCount * best.cellWidth;
      return {
        x: (w - rowWidth) / 2 + best.cellWidth * (column + 0.5),
        y: marginY + bubbleSpace + best.cellHeight * (row + 0.5),
        scale: best.scale,
      };
    });
  }
  function showPhotoMessage(text, step) {
    photoMessageText.textContent = text;
    photoMessage.dataset.step = step;
    photoStage.hidden = false;
    photoStage.classList.remove("snap");
    photoMessage.classList.remove("pop");
    void photoMessage.offsetWidth;
    photoMessage.classList.add("pop");
  }
  function hidePhotoStage() {
    photoStage.hidden = true;
    photoStage.classList.remove("snap");
    photoMessage.classList.remove("pop");
  }
  function showPhotoPrint(canvas) {
    const print = document.createElement("div"),
      target = photoButton.getBoundingClientRect(),
      size = Math.min(innerWidth * 0.62, innerHeight * 0.48, 340),
      fromX = innerWidth / 2,
      fromY = innerHeight * 0.42,
      dx = target.left + target.width / 2 - fromX,
      dy = target.top + target.height / 2 - fromY;
    print.className = "photo-print";
    print.style.width = size + "px";
    print.style.left = fromX - size / 2 + "px";
    print.style.top = fromY - size * 0.56 + "px";
    canvas.className = "photo-print-image";
    print.append(canvas);
    document.body.append(print);
    if (!print.animate) {
      setTimeout(() => print.remove(), 1600);
      return;
    }
    const animation = print.animate(
      [
        { transform: "scale(0.55) rotate(0deg)", opacity: 0, offset: 0 },
        { transform: "scale(1.06) rotate(-5deg)", opacity: 1, offset: 0.14 },
        { transform: "scale(1) rotate(-4deg)", opacity: 1, offset: 0.22 },
        { transform: "scale(1) rotate(-4deg)", opacity: 1, offset: 0.62 },
        {
          transform: `translate(${dx}px, ${dy}px) scale(0.08) rotate(14deg)`,
          opacity: 0.2,
          offset: 1,
        },
      ],
      { duration: 1900, easing: "ease-in-out", fill: "forwards" },
    );
    animation.onfinish = () => {
      print.remove();
      photoButton.classList.remove("received");
      void photoButton.offsetWidth;
      photoButton.classList.add("received");
    };
  }
  function savePhoto() {
    const out = document.createElement("canvas");
    out.width = 1200;
    out.height = 1200;
    const c = out.getContext("2d");
    const capturedAt = new Date(),
      two = (n) => String(n).padStart(2, "0"),
      ymd = [
        capturedAt.getFullYear(),
        two(capturedAt.getMonth() + 1),
        two(capturedAt.getDate()),
      ],
      hm = [two(capturedAt.getHours()), two(capturedAt.getMinutes())],
      dateLabel = ymd.join(".") + "  " + hm.join(":"),
      s = Math.min(1080 / Math.max(w, 1), 930 / Math.max(h, 1));
    bg(c, out.width, out.height);
    c.save();
    c.translate((out.width - w * s) / 2, 135 + (930 - h * s) / 2);
    c.scale(s, s);
    for (const m of monsters) monster(c, m, tick);
    c.restore();
    c.textAlign = "center";
    c.lineJoin = "round";
    c.font = '1000 48px "Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", system-ui, sans-serif';
    c.lineWidth = 12;
    c.strokeStyle = "#fffaf0";
    c.strokeText("うかべてあそぼ", 600, 78);
    c.fillStyle = "#57463f";
    c.fillText("うかべてあそぼ", 600, 78);
    c.font = '700 25px "Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", system-ui, sans-serif';
    c.lineWidth = 8;
    c.strokeText(dateLabel, 600, 1144);
    c.fillStyle = "#57463f";
    c.fillText(dateLabel, 600, 1144);
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a"),
        dateStamp = ymd.join("") + "-" + hm.join("");
      a.href = url;
      a.download = "ukabete-asobo-" + dateStamp + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
    return out;
  }
  const wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
  async function takePhoto() {
    if (photoInProgress || fireworksInProgress) return;
    cancelFloat();
    const session = ++photoSessionId,
      targets = photoTargets();
    photoInProgress = true;
    if (grabbedMonster) releaseGrab(null, false);
    monsters.forEach((m, index) => {
      m.photoTarget = targets[index];
      m.presentationScale = m.presentationScale || 1;
      m.vx = 0;
      m.vy = 0;
      m.turnIn = 3;
      m.nextActionAt = Math.max(m.nextActionAt, tick + 3);
    });
    soundPhotoCue();
    showPhotoMessage("あつまれ〜", "gather");
    await wait(750);
    if (session !== photoSessionId) return;
    soundPhotoCue();
    showPhotoMessage("ならんで〜", "line");
    await wait(1000);
    if (session !== photoSessionId) return;
    for (const m of monsters) {
      if (!m.photoTarget) continue;
      m.x = m.photoTarget.x;
      m.y = m.photoTarget.y;
      m.presentationScale = m.photoTarget.scale;
    }
    tone(880, 0.1, "sine", 0.035);
    tone(1175, 0.16, "sine", 0.035, 0.09);
    showPhotoMessage("はい、チーズ！", "cheese");
    await wait(700);
    if (session !== photoSessionId) return;
    soundShutter();
    photoStage.classList.add("snap");
    photoFlash.classList.remove("active");
    void photoFlash.offsetWidth;
    photoFlash.classList.add("active");
    const shot = savePhoto();
    await wait(380);
    if (session !== photoSessionId) return;
    hidePhotoStage();
    showPhotoPrint(shot);
    photoInProgress = false;
    for (const m of monsters) {
      m.photoTarget = null;
      m.turnIn = 0.7;
      m.nextActionAt = Math.max(m.nextActionAt, tick + 2);
    }
  }
  function startFireworks() {
    if (photoInProgress || fireworksInProgress) return;
    cancelFloat();
    fireworksInProgress = true;
    fireworksStartedAt = performance.now();
    if (grabbedMonster) releaseGrab(null, false);
    monsters.forEach((m, index) => {
      m.photoTarget = null;
      m.vx = 0;
      m.vy = 0;
      m.fireworkAt = fireworksStartedAt + 3200 + index * 1500;
      m.fireworkStartAt = 0;
      m.fireworkOrder = index;
    });
    const startedAt = fireworksStartedAt;
    setTimeout(() => {
      if (!fireworksInProgress || fireworksStartedAt !== startedAt) return;
      soundPhotoCue();
      fireworkCall(
        monsters.length ? "はなび いくよ〜！" : "おほしさま きらきら〜",
        3,
      );
    }, 1200);
  }
  photoButton.onclick = () => void takePhoto();
  fireworksButton.onclick = startFireworks;
  resize();
  requestAnimationFrame(frame);
})();
