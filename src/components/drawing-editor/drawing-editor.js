import markup from "./drawing-editor.html?raw";
import { templateDefs, loadTemplateImages } from "./templates.js";
import { cropDrawing } from "./artwork-bitmap.js";
import { floodFillCanvas } from "./flood-fill.js";
import { extendPaper, paperTransform } from "./paper.mjs";
import { fitCanvas, ink, strokeWidth } from "../../canvas.js";
import { withIconUrls } from "../../icons.js";

const MAX_UNDO_STEPS = 12;

export function createDrawingEditor(root, { audio, sparkle, isPlaygroundBusy, planLanding, onComplete }) {
  root.innerHTML = withIconUrls(markup);
  const $ = (id) => root.querySelector(`#${id}`);
  const draw = $("draw"), dc = draw.getContext("2d");
  const panel = $("drawing-panel");
  const modeButton = $("editor-mode");
  const undoButton = $("undo"), clearButton = $("clear");
  const toolButtons = root.querySelectorAll(".style-tools button, .drawing-tools button");
  const fillToggle = $("fill-toggle"), faceToggle = $("face-toggle"), eraserToggle = $("eraser-toggle");
  const nextMode = { half: "full", full: "minimized", minimized: "half" };
  const modeLabels = { half: "おえかきをいっぱいにひろげる", full: "おえかきをしまう", minimized: "おえかきをひらく" };
  const { startBgm, soundDraw, tone } = audio;
  let paper = null;
  const editHistory = [];
  let visibleSize;
  let visiblePixelRatio;
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
    drawingPointer = null,
    sourceImage = null,
    painted = null;
  const overlayPreview = document.createElement("canvas");
  const cycle = $("color-cycle"),
    palette = $("color-palette"),
    paletteColorList = $("palette-colors"),
    brushCycle = $("brush-cycle"),
    brushMenu = $("brush-menu");
  let brushMode = "pen";
  let drawingTool = "brush";
  let withFace = true;
  const brushes = {
    thin: { label: "ほそい", scale: 0.0008, dotRadius: 2 },
    pen: { label: "ふつう", scale: 0.0028, dotRadius: 4 },
    thick: { label: "ふとい", scale: 0.009, dotRadius: 7 },
  };
  function thicknessIcon(brush) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    const dot = document.createElementNS(ns, "circle");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    dot.setAttribute("cx", "12");
    dot.setAttribute("cy", "12");
    dot.setAttribute("r", brush.dotRadius);
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("stroke", "none");
    svg.append(dot);
    return svg;
  }
  function positionMenu(menu, trigger) {
    if (menu.hidden) return;
    const viewport = window.visualViewport;
    const margin = 8, gap = 10;
    const minX = (viewport?.offsetLeft ?? 0) + margin;
    const minY = (viewport?.offsetTop ?? 0) + margin;
    const width = (viewport?.width ?? document.documentElement.clientWidth) - 2 * margin;
    const height = (viewport?.height ?? document.documentElement.clientHeight) - 2 * margin;
    menu.style.maxWidth = Math.max(0, width) + "px";
    menu.style.maxHeight = Math.max(0, height) + "px";

    const rect = menu.getBoundingClientRect();
    const anchor = trigger.getBoundingClientRect();
    const above = anchor.top - gap - rect.height;
    const below = anchor.bottom + gap;
    const top = above >= minY ? above : below;
    menu.style.left = Math.max(minX, Math.min(anchor.left, minX + width - rect.width)) + "px";
    menu.style.top = Math.max(minY, Math.min(top, minY + height - rect.height)) + "px";
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
    brushCycle.setAttribute(
      "aria-label",
      "せんのふとさ：" + brushes[brushMode].label,
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
  Object.entries(brushes).forEach(([mode, brush]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "brush-option";
    button.dataset.mode = mode;
    button.setAttribute("aria-label", brush.label);
    button.setAttribute("aria-pressed", String(mode === brushMode));
    button.append(thicknessIcon(brush));
    button.onclick = () => {
      brushMode = mode;
      updateBrushMenu();
      closeBrushMenu();
    };
    brushMenu.append(button);
  });
  updateBrushMenu();
  updatePalette();
  function setDrawingTool(tool) {
    end();
    drawingTool = tool;
    fillToggle.setAttribute("aria-pressed", String(tool === "fill"));
    eraserToggle.setAttribute("aria-pressed", String(tool === "erase"));
  }
  fillToggle.onclick = () => setDrawingTool(drawingTool === "fill" ? "brush" : "fill");
  eraserToggle.onclick = () => setDrawingTool(drawingTool === "erase" ? "brush" : "erase");
  faceToggle.onclick = () => {
    withFace = !withFace;
    faceToggle.setAttribute("aria-pressed", String(withFace));
  };
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
    templateFillColors = [];
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
      end();
      if (i === templateIndex && !painted && !strokes.length && !sourceImage) {
        closeAssets();
        return;
      }
      editHistory.length = 0;
      paper = null;
      templateIndex = i;
      templateFillColors = [];
      strokes = [];
      sourceImage = null;
      painted = null;
      syncEditControls();
      updateAssets();
      renderDrawing();
      closeAssets();
    };
    assetList.append(b);
  });
  $("image-upload").onclick = () => imageInput.click();
  assetCycle.onclick = () => {
    if (assetList.hidden) openAssets();
    else closeAssets();
  };

  function applyTemplateFill(point, before) {
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
    const overlay = templateOverlay();
    const composite = templateArt(overlay);
    if (!composite || !floodFillCanvas(
      composite,
      point.x * overlay.width,
      point.y * overlay.height,
      color,
      { templateOnly: true, allowedColors: templateFillColors, paintLayer: overlay },
    )) return;
    rememberEdit(before);
    painted = { image: overlay };
    strokes = [];
    if (!templateFillColors.includes(color)) templateFillColors.push(color);
    syncEditControls();
    renderDrawing();
  }

  function fillCurrentArtwork(point, before) {
    const overlay = paperOverlay();
    const { x, y, width, height } = paper.area;
    const composite = sourceImage ? paperComposite(overlay) : overlay;
    if (floodFillCanvas(
      composite,
      ((point.x * paper.unit - x) / width) * overlay.width,
      ((point.y * paper.unit - y) / height) * overlay.height,
      color,
      { paintLayer: overlay },
    )) {
      rememberEdit(before);
      painted = { image: overlay, area: { ...paper.area } };
      strokes = [];
      syncEditControls();
      renderDrawing();
    } else {
      paper = before.paper;
    }
  }

  function prepareCanvas(canvas, width, height) {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: canvas !== overlayPreview });
    ctx.resetTransform();
    ctx.clearRect(0, 0, width, height);
    return ctx;
  }

  function templateOverlay(canvas = document.createElement("canvas")) {
    const ctx = prepareCanvas(canvas, 360, 330);
    if (painted) ctx.drawImage(painted.image, 0, 0);
    paintStrokes(ctx, canvas.width, canvas.height);
    return canvas;
  }

  function templateArt(overlay = templateOverlay()) {
    const img = templateImages[templateIndex];
    if (!img || !img.complete || !img.naturalWidth) return null;
    const canvas = document.createElement("canvas");
    const ctx = prepareCanvas(canvas, overlay.width, overlay.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(overlay, 0, 0);
    return canvas;
  }

  function paperOverlay(canvas = document.createElement("canvas")) {
    const { width, height } = paper.area;
    const scale = Math.min(paper.pixelRatio, Math.max(draw.width, draw.height) / Math.max(width, height));
    const ctx = prepareCanvas(canvas, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    mapCanvasToPaper(ctx);
    paintPaperOverlay(ctx);
    return canvas;
  }

  function mapCanvasToPaper(ctx) {
    const { x, y, width, height } = paper.area;
    ctx.scale(ctx.canvas.width / width, ctx.canvas.height / height);
    ctx.translate(-x, -y);
  }

  function paperComposite(overlay) {
    const canvas = document.createElement("canvas");
    const ctx = prepareCanvas(canvas, overlay.width, overlay.height);
    ctx.save();
    mapCanvasToPaper(ctx);
    paintSourceImage(ctx);
    ctx.restore();
    ctx.drawImage(overlay, 0, 0);
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
  function startFloatGhost(hasImage) {
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
      { landing, size, sway, getOrigin } = planLanding(hasImage),
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
    panel.classList.toggle("locked", locked);
    for (const button of toolButtons) button.disabled = locked;
    syncEditControls();
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
    if (!hasArtwork()) return;
    end();
    const artwork = finishArtwork();
    if (!artwork) return;
    countdownEnd = performance.now() + FLOAT_DELAY;
    draw.parentElement.classList.add("waiting");
    setDrawLocked(true);
    $("finish").disabled = true;
    startFloatGhost(!!artwork.image && !artwork.handDrawn);
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
      if (!isPlaygroundBusy() && onComplete(artwork, landing)) resetDrawing();
    }, FLOAT_DELAY);
  }
  $("finish").onclick = () => {
    editHistory.length = 0;
    syncEditControls();
    startBgm();
    scheduleFloat();
  };
  function hasArtwork() {
    return strokes.length > 0 || painted !== null || sourceImage !== null || templateIndex !== 0;
  }

  function captureEdit() {
    // Completed paths and existing bitmaps are shared. Each fill creates a new bitmap.
    return {
      strokes: strokes.slice(),
      sourceImage,
      painted,
      templateIndex,
      templateFillColors: templateFillColors.slice(),
      paper: paper && { ...paper },
    };
  }

  function rememberEdit(state = captureEdit()) {
    editHistory.push(state);
    if (editHistory.length > MAX_UNDO_STEPS) editHistory.shift();
  }

  function syncEditControls() {
    const locked = panel.classList.contains("locked");
    clearButton.disabled = locked || !hasArtwork();
    undoButton.disabled = locked || editHistory.length === 0;
    eraserToggle.disabled = locked;
  }

  undoButton.onclick = () => {
    if (!editHistory.length || floatPending()) return;
    end();
    ({ strokes, sourceImage, painted, templateIndex, templateFillColors, paper } = editHistory.pop());
    syncEditControls();
    updateAssets();
    renderDrawing();
  };

  function resetDrawing() {
    cancelFloat();
    end();
    strokes = [];
    sourceImage = null;
    painted = null;
    templateIndex = 0;
    templateFillColors = [];
    paper = null;
    syncEditControls();
    updateAssets();
    renderDrawing();
  }
  clearButton.onclick = () => {
    if (!hasArtwork() || floatPending()) return;
    editHistory.length = 0;
    resetDrawing();
  };
  function paperPoint(e, extend = true) {
    const { left, top, width, height } = draw.getBoundingClientRect();
    const view = paperTransform(paper.area, width, height);
    const point = {
      x: (Math.min(width, Math.max(0, e.clientX - left)) - view.x) / view.scale,
      y: (Math.min(height, Math.max(0, e.clientY - top)) - view.y) / view.scale,
    };
    if (extend) paper.area = extendPaper(paper.area, point, view, width, height);
    return { x: point.x / paper.unit, y: point.y / paper.unit };
  }
  function templateRect(width, height) {
    const size = Math.max(1, Math.min(width - 16, (height - 10) * 120 / 110));
    const artHeight = size * 110 / 120;
    return { x: (width - size) / 2, y: (height - artHeight) / 2, width: size, height: artHeight };
  }
  function templatePoint(e) {
    const r = draw.getBoundingClientRect();
    const art = templateRect(r.width, r.height);
    return {
      x: (e.clientX - r.left - art.x) / art.width,
      y: (e.clientY - r.top - art.y) / art.height,
    };
  }
  function floatPending() {
    return countdownTimer !== null;
  }
  draw.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    startBgm();
    if (floatPending() || drawingPointer !== null || e.button !== 0) return;
    const erase = drawingTool === "erase";
    if (erase && !painted && !strokes.length) return;
    const before = captureEdit();
    if (!templateIndex) rememberPaper();
    const point = templateIndex ? templatePoint(e) : paperPoint(e, !erase);
    if (drawingTool === "fill") {
      if (templateIndex) applyTemplateFill(point, before);
      else fillCurrentArtwork(point, before);
      return;
    }
    rememberEdit(before);
    draw.setPointerCapture(e.pointerId);
    drawingPointer = e.pointerId;
    current = [point];
    current.inkColor = color;
    current.brushScale = brushes[brushMode].scale;
    current.erase = erase;
    strokes.push(current);
    syncEditControls();
    soundDraw();
    renderDrawing();
  });
  draw.addEventListener("pointermove", (e) => {
    if (drawingPointer !== e.pointerId) return;
    e.preventDefault();
    current.push(templateIndex ? templatePoint(e) : paperPoint(e, !current.erase));
    soundDraw();
    renderDrawing();
  });
  function end(e) {
    if (drawingPointer === null || (e && e.pointerId !== drawingPointer)) return;
    const pointer = drawingPointer;
    drawingPointer = null;
    current = null;
    if (draw.hasPointerCapture(pointer)) draw.releasePointerCapture(pointer);
  }
  draw.addEventListener("pointerup", end);
  draw.addEventListener("pointercancel", end);
  draw.addEventListener("lostpointercapture", end);
  function renderDrawing() {
    const r = draw.getBoundingClientRect(),
      dw = r.width,
      dh = r.height;
    if (panel.hidden || !dw || !dh) return;
    dc.clearRect(0, 0, dw, dh);
    if (templateIndex) {
      const img = templateImages[templateIndex];
      if (!img?.naturalWidth) return;
      const rect = templateRect(dw, dh);
      dc.drawImage(img, rect.x, rect.y, rect.width, rect.height);
      if (painted || strokes.length) {
        const overlay = templateOverlay(overlayPreview);
        dc.drawImage(overlay, rect.x, rect.y, rect.width, rect.height);
      }
      return;
    }
    if (!paper) return;
    const view = paperTransform(paper.area, dw, dh);
    dc.save();
    dc.translate(view.x, view.y);
    dc.scale(view.scale, view.scale);
    if (sourceImage) {
      paintSourceImage(dc);
      if (painted || strokes.length) {
        const overlay = paperOverlay(overlayPreview);
        const { x, y, width, height } = paper.area;
        dc.drawImage(overlay, x, y, width, height);
      }
    } else {
      paintPaperOverlay(dc);
    }
    dc.restore();
  }

  function paintSourceImage(ctx) {
    const { width, height } = paper;
    const scale = Math.min((width - 25) / sourceImage.width, (height - 18) / sourceImage.height);
    const imageWidth = sourceImage.width * scale, imageHeight = sourceImage.height * scale;
    ctx.drawImage(sourceImage, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
  }

  function paintPaperOverlay(ctx) {
    if (painted) {
      const { image, area: { x, y, width, height } } = painted;
      ctx.drawImage(image, x, y, width, height);
    }
    paintStrokes(ctx, paper.unit, paper.unit);
  }

  function paintStrokes(ctx, width, height) {
    ctx.save();
    ctx.scale(width, height);
    for (const path of strokes) {
      ctx.globalCompositeOperation = path.erase ? "destination-out" : "source-over";
      ink(ctx, [path], path.inkColor || color, path.brushScale || 0.0014);
    }
    ctx.restore();
  }
  function bounds(paths) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of paths) {
      const radius = strokeWidth(p.brushScale) / 2;
      for (const q of p) {
        minX = Math.min(minX, q.x - radius);
        minY = Math.min(minY, q.y - radius);
        maxX = Math.max(maxX, q.x + radius);
        maxY = Math.max(maxY, q.y + radius);
      }
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
        end();
        editHistory.length = 0;
        templateIndex = 0;
        templateFillColors = [];
        paper = null;
        rememberPaper();
        sourceImage = img;
        painted = null;
        strokes = [];
        syncEditControls();
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
    if (sourceImage) {
      return { image: painted || strokes.length ? paperComposite(paperOverlay()) : sourceImage };
    }
    if (painted || strokes.some((path) => path.erase)) {
      const image = cropDrawing(paperOverlay());
      return image ? { image, handDrawn: true, withFace } : null;
    }
    if (!strokes.length) return null;
    const paths = strokes.map((path) => ({
      points: path.map(({ x, y }) => ({ x, y })),
      color: path.inkColor || color,
      scale: path.brushScale || 0.0014,
    }));
    return { paths, color, bounds: bounds(strokes), withFace };
  }

  function rememberPaper() {
    if (paper) return;
    const [width, height] = visibleSize;
    paper = {
      width,
      height,
      // Both axes use the same unit so strokes keep their shape when floated.
      unit: Math.min(width, height),
      pixelRatio: Math.min(devicePixelRatio || 1, 2),
      area: { x: 0, y: 0, width, height },
    };
  }

  function resize() {
    if (panel.hidden) return;
    const { width, height } = draw.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (width !== visibleSize?.[0] || height !== visibleSize?.[1] || ratio !== visiblePixelRatio) {
      end();
      visibleSize = fitCanvas(draw);
      visiblePixelRatio = ratio;
      renderDrawing();
    }
    positionOpenMenus();
  }

  function setMode(mode) {
    if (root.dataset.mode === mode) return;
    end();
    closePalette();
    closeBrushMenu();
    closeAssets();
    root.dataset.mode = mode;
    panel.hidden = mode === "minimized";
    modeButton.setAttribute("aria-label", modeLabels[mode]);
    modeButton.setAttribute("aria-expanded", String(!panel.hidden));
    resize();
    renderDrawing();
  }
  function minimize() {
    setMode("minimized");
  }
  function setFireworksActive(active) {
    modeButton.disabled = active;
    if (active) {
      cancelFloat();
      minimize();
    }
  }
  modeButton.onclick = () => setMode(nextMode[root.dataset.mode]);
  setMode("half");
  new ResizeObserver(resize).observe(draw);
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", positionOpenMenus);
  return { canvas: draw, cancelFloat, minimize, setFireworksActive, update: (now) => floatGhost?.update(now) };
}
