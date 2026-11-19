import markup from "./drawing-editor.html?raw";
import { templateDefs, loadTemplateImages } from "./templates.js";
import { floodFillCanvas } from "./flood-fill.js";
import { paperViewport } from "./paper.mjs";
import { fitCanvas, ink } from "../../canvas.js";
import { iconUrl, withIconUrls } from "../../icons.js";

export function createDrawingEditor(root, { audio, sparkle, isPlaygroundBusy, planLanding, onComplete }) {
  root.innerHTML = withIconUrls(markup);
  const $ = (id) => root.querySelector(`#${id}`);
  const draw = $("draw"), dc = draw.getContext("2d");
  const { startBgm, soundDraw, tone } = audio;
  let paper = null;
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
  let color = paletteColors[0][1],
    strokes = [],
    current = null,
    drawing = false,
    pendingImage = null,
    pendingImageFullCanvas = false;
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
    img.src = iconUrl(fileName);
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
  const templateImages = loadTemplateImages(renderDrawing);
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
      paper = null;
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
    const canvas = composeDrawing();
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
    const canvas = document.createElement("canvas");
    canvas.width = paper.pixelWidth;
    canvas.height = paper.pixelHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.scale(canvas.width / paper.width, canvas.height / paper.height);
    paintPaper(ctx, paper.width, paper.height);
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
      { landing, size, sway, getOrigin } = planLanding(!!(templateIndex || pendingImage)),
      endScale = Math.min(1, size / Math.max(startW, startH));
    el.style.width = startW + "px";
    el.style.height = startH + "px";
    document.body.append(el);
    const ghost = {
      el,
      landing,
      startedAt: performance.now(),
      nextSparkAt: 0,
    };
    floatGhost = ghost;
    const ease = (p) => 0.5 - Math.cos(Math.PI * p) / 2;
    ghost.update = (now) => {
      if (floatGhost !== ghost) return;
      const t = (now - ghost.startedAt) / 1000,
        wr = getOrigin(),
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
    };
  }
  function setDrawLocked(locked) {
    root.querySelector(".inline-draw").classList.toggle("locked", locked);
    for (const button of root.querySelectorAll("#color-cycle, #brush-cycle, #asset-cycle, #clear"))
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
    if (isPlaygroundBusy()) return;
    cancelFloat();
    if (!strokes.length && !pendingImage && !templateIndex)
      return;
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
      if (!drawing && !isPlaygroundBusy()) {
        const artwork = finishArtwork();
        if (artwork && onComplete(artwork, landing)) resetDrawing();
      }
    }, FLOAT_DELAY);
  }
  $("finish").onclick = () => {
    startBgm();
    scheduleFloat();
  };
  function resetDrawing() {
    cancelFloat();
    strokes = [];
    current = null;
    pendingImage = null;
    pendingImageFullCanvas = false;
    templateIndex = 0;
    templateFills = [];
    paper = null;
    updateAssets();
    renderDrawing();
  }
  $("clear").onclick = resetDrawing;
  function pt(e) {
    const r = draw.getBoundingClientRect();
    const view = paperViewport(paper, r.width, r.height);
    return {
      x: (e.clientX - r.left - view.x) / view.width,
      y: (e.clientY - r.top - view.y) / view.height,
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
    if (!templateIndex) rememberPaper();
    const point = templateIndex ? templatePoint(e) : pt(e);
    if (!templateIndex && (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) return;
    if (brushMode === "fill") {
      if (templateIndex) applyTemplateFill(templatePoint(e));
      else fillCurrentArtwork(point);
      return;
    }
    draw.setPointerCapture(e.pointerId);
    drawing = true;
    current = [point];
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
    const view = paperViewport(paper, dw, dh);
    if (!view.width || !view.height) return;
    dc.save();
    dc.translate(view.x, view.y);
    dc.beginPath();
    dc.rect(0, 0, view.width, view.height);
    dc.clip();
    const width = paper?.width ?? dw, height = paper?.height ?? dh;
    dc.scale(view.width / width, view.height / height);
    paintPaper(dc, width, height);
    dc.restore();
  }

  function paintPaper(ctx, dw, dh) {
    if (pendingImage) {
      if (pendingImageFullCanvas) {
        ctx.drawImage(pendingImage, 0, 0, dw, dh);
      } else {
        const iw = pendingImage.width,
          ih = pendingImage.height,
          scale = Math.min((dw - 25) / iw, (dh - 18) / ih);
        ctx.drawImage(
          pendingImage,
          (dw - iw * scale) / 2,
          (dh - ih * scale) / 2,
          iw * scale,
          ih * scale,
        );
      }
    }
    ctx.save();
    ctx.scale(dw, dh);
    for (const path of strokes)
      ink(ctx, [path], path.inkColor || color, path.brushScale || 0.0014);
    ctx.restore();
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
  imageInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        cancelFloat();
        templateIndex = 0;
        templateFills = [];
        paper = null;
        rememberPaper();
        pendingImage = img;
        pendingImageFullCanvas = false;
        strokes = [];
        current = null;
        updateAssets();
        renderDrawing();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch {
      // The file could not be opened. Keep the current artwork.
    }
    e.target.value = "";
  });

  function finishArtwork() {
    if (templateIndex) {
      const image = templateArt();
      return image ? { image } : null;
    }
    if (pendingImage) return { image: strokes.length ? composeDrawing() : pendingImage };
    if (!strokes.length) return null;
    const paths = strokes.map((path) => ({
      points: path.map(({ x, y }) => ({ x, y })),
      color: path.inkColor || color,
      scale: path.brushScale || 0.0014,
    }));
    return { paths, color, bounds: bounds(strokes) };
  }

  function rememberPaper() {
    if (paper) return;
    const { width, height } = draw.getBoundingClientRect();
    paper = { width, height, pixelWidth: draw.width, pixelHeight: draw.height };
  }

  function resize() {
    fitCanvas(draw);
    renderDrawing();
    positionOpenMenus();
  }
  resize();
  new ResizeObserver(resize).observe(draw);
  window.addEventListener("resize", resize);
  return { canvas: draw, cancelFloat, update: (now) => floatGhost?.update(now) };
}
