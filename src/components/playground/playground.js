import markup from "./playground.html?raw";
import toolsMarkup from "./tools.html?raw";
import { fitCanvas } from "../../canvas.js";
import { withIconUrls } from "../../icons.js";
import { createPhoto } from "../photo/photo.js";
import { drawBackground, drawRain, drawWind } from "./background.js";
import { drawHeat, drawLightning } from "./weather-art.js";
import { boltEscape, choosePersonality, movementLimits, scatterCharacters, SCATTER_SECONDS, SCATTER_SPEED_MULTIPLIER, shoveDestination, steerPersonality } from "./character-motion.mjs";
import { baseCharacterRadius, characterBob, characterDisplayScale, drawCharacter } from "./character-art.js";
import { drawBombCountdown, fireworkCall, fireworkCallText, fireworksBurst, fireworkShapes, updateParticles } from "./effects.js";

const WEATHER_TYPES = ["wind", "rain", "night", "thunder", "heat"];
const MAX_CHARACTERS = 12;

export function createPlayground(root, { app, topbar, audio, sparkle, onPresentationStart, onBombPress, onFireworksChange }) {
  root.innerHTML = markup;
  topbar.innerHTML = withIconUrls(toolsMarkup);
  const $ = (id) => root.querySelector(`#${id}`) ?? topbar.querySelector(`#${id}`);
  const world = $("world"), wc = world.getContext("2d");
  const fireworkCalls = $("firework-calls");
  const { soundFloat, soundTick, soundExplosion, soundRocket, soundBurst, soundCheer, soundPhotoCue } = audio;

  const monsters = [];
  let replacement = null;
  let w = 0,
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
    randomEventInProgress = false,
    randomEventType = "",
    randomEventEnd = 0,
    randomEventEndTick = 0,
    nextStrikeAt = 0,
    lightning = null,
    scatterUntil = 0,
    nextRandomEventAt = performance.now() + 45000 + Math.random() * 30000;
  let grabbedMonster = null,
    grabbedPointerId = null,
    grabOffsetX = 0,
    grabOffsetY = 0,
    lastGrabX = 0,
    lastGrabY = 0,
    lastGrabAt = 0,
    grabbedPrevX = 0,
    grabbedPrevY = 0,
    grabbedPrevAt = 0;
  function resize() {
    [w, h] = fitCanvas(world);
  }
  window.addEventListener("resize", resize);
  new ResizeObserver(resize).observe(world);

  function setCharacterAction(m, action, duration) {
    m.action = action;
    m.actionStart = tick;
    m.actionUntil = tick + duration;
  }
  function characterRadius(m) {
    return baseCharacterRadius(m, w, h) * (m.presentationScale || 1);
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
        bob = characterBob(m, tick),
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
    if (!photoInProgress && !fireworksInProgress && !randomEventInProgress && tick >= scatterUntil) avoidNearCollisions();
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
  function separateSleepers(a, b, radiusSum) {
    const [pusher, target] = Math.random() < 0.5 ? [a, b] : [b, a];
    const destination = shoveDestination(pusher, target, w, h, radiusSum + 40);
    pusher.shoveAngle = Math.atan2(destination.y - pusher.y, destination.x - pusher.x);
    pusher.vx = pusher.vy = 0;
    pusher.shoveTarget = null;
    pusher.wakeUntil = tick + 0.35;
    target.shoveTarget = destination;
    target.wakeUntil = tick + 0.75;
    for (const m of [pusher, target]) {
      m.napping = false;
      m.hadCloseNeighbor = true;
      m.reactionCooldown = tick + 1.2;
    }
    setCharacterAction(pusher, "shove", 0.35);
    setCharacterAction(target, "startled", 0.65);
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
        if (a.personality === "lazy" && b.personality === "lazy") {
          if (rawDistance < radiusSum * 0.88 && tick >= a.reactionCooldown && tick >= b.reactionCooldown) {
            separateSleepers(a, b, radiusSum);
          }
          continue;
        }
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
    // A held character is also part of proximity checks: only the
    // unheld characters are allowed to flee from it.
    if (grabbedMonster && !grabbedMonster.bombEnd) {
      const g = grabbedMonster,
        nowTime = performance.now(),
        elapsed = Math.max(0.016, (nowTime - grabbedPrevAt) / 1000),
        gvx = (g.x - grabbedPrevX) / elapsed,
        gvy = (g.y - grabbedPrevY) / elapsed;
      grabbedPrevX = g.x;
      grabbedPrevY = g.y;
      grabbedPrevAt = nowTime;
      for (const m of monsters) {
        if (m === g || m.bombEnd) continue;
        const dx = m.x - g.x,
          dy = m.y - g.y,
          rawDistance = Math.hypot(dx, dy),
          distance = Math.max(1, rawDistance),
          radiusSum = characterRadius(g) + characterRadius(m),
          closing = (m.vx - gvx) * dx + (m.vy - gvy) * dy < 0;
        if (
          distance > radiusSum + 30 ||
          (!closing && distance > radiusSum + 18) ||
          tick < m.reactionCooldown
        ) {
          continue;
        }
        const nx = rawDistance
            ? dx / distance
            : Math.cos(g.phase - m.phase),
          ny = rawDistance
            ? dy / distance
            : Math.sin(g.phase - m.phase),
          kick = 130 + Math.random() * 70,
          mood = Math.random() < 0.5 ? "panic" : "angry";
        m.vx = nx * kick + ny * 24;
        m.vy = ny * kick - nx * 24;
        m.turnIn = 1.2;
        m.reactionCooldown = tick + 1.15;
        m.nextActionAt = tick + 3 + Math.random() * 3;
        setCharacterAction(m, mood, 0.85);
      }
    }
  }
  function isPlaygroundBusy() {
    return photoInProgress || fireworksInProgress;
  }
  function prepareArtwork(deadline) {
    if (monsters.length < MAX_CHARACTERS) return;
    const slot = { target: monsters[0], deadline };
    replacement = slot;
    return () => {
      if (replacement === slot) replacement = null;
    };
  }
  function planLanding(hasImage) {
    const displayScale = characterDisplayScale(w, h);
    const size = hasImage
      ? Math.min(Math.min(160, w * 0.4), Math.min(170, h * 0.34)) * displayScale * 0.9
      : Math.min(90, Math.max(55, w * 0.16)) * displayScale * 1.15;
    const margin = Math.min(80, w * 0.18);
    const landing = {
      x: margin + Math.random() * Math.max(1, w - margin * 2),
      y: h * (0.3 + Math.random() * 0.28),
    };
    const sway = (Math.random() < 0.5 ? -1 : 1) * Math.min(60, w * 0.12);
    return { landing, size, sway, getOrigin: () => world.getBoundingClientRect() };
  }
  function addArtwork(artwork, landing) {
    if (isPlaygroundBusy()) return false;
    const m = artwork.image ? { image: artwork.image } : {};
    if (!artwork.image || artwork.handDrawn) {
      const width = artwork.image?.width ?? artwork.bounds.width;
      const height = artwork.image?.height ?? artwork.bounds.height;
      const displayScale = characterDisplayScale(w, h);
      const size = Math.min(90, Math.max(55, w * 0.16)) * displayScale;
      const unit = size / Math.max(width, height);
      Object.assign(m, {
        size,
        withFace: artwork.withFace,
        personality: artwork.withFace === true ? choosePersonality() : null,
        faceY: -Math.min(12, height * unit * 0.18),
        eyeOffset: Math.min(14, width * unit * 0.17),
      });
      if (!artwork.image) {
        const b = artwork.bounds;
        const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
        m.color = artwork.color;
        m.paths = artwork.paths.map(({ points, color, scale }) => {
          const path = points.map((q) => ({
            x: (q.x - cx) * unit,
            y: (q.y - cy) * unit,
          }));
          path.inkColor = color;
          path.brushScale = scale * unit;
          return path;
        });
      }
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
      napping: m.personality === "lazy",
      action: "",
      actionStart: 0,
      actionUntil: 0,
      nextActionAt: tick + 2.5 + Math.random() * 3.5,
      reactionCooldown: 0,
      sweatUntil: 0,
      dragVX: 0,
      dragVY: 0,
    });
    if (monsters.length >= MAX_CHARACTERS) {
      const departing = monsters.shift();
      if (departing === grabbedMonster) {
        const pointer = grabbedPointerId;
        releaseGrab(null, false);
        if (world.hasPointerCapture(pointer)) world.releasePointerCapture(pointer);
      }
      explode(departing);
    }
    monsters.push(m);
    soundFloat();
    if (landing) {
      const r = world.getBoundingClientRect();
      sparkle(r.left + m.x, r.top + m.y, true);
    }
    return true;
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
  $("bomb").onclick = () => {
    setBombMode(!bombMode);
    onBombPress();
  };
  function updateTopButtons() {
    // Top tools only make sense while at least one character is floating.
    const empty = monsters.length === 0,
      busy = photoInProgress || fireworksInProgress;
    if (empty && bombMode) setBombMode(false);
    for (const [id, off] of [
      ["photo", empty || busy],
      ["fireworks", empty || busy],
      ["bomb", empty || busy],
    ])
      if ($(id).disabled !== off) $(id).disabled = off;
  }
  world.addEventListener("pointerdown", (e) => {
    if (isPlaygroundBusy()) return;
    if (e.button !== 0) return;
    const point = worldPoint(e),
      m = characterAt(point.x, point.y);
    if (bombMode) {
      if (!m) return;
      if (!m.bombEnd) {
        m.bombEnd = performance.now() + 10000;
        m.lastBombSecond = 11;
        soundTick(10, panFor(m.x));
      }
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
    grabbedPrevX = m.x;
    grabbedPrevY = m.y;
    grabbedPrevAt = performance.now();
    m.sweatUntil = tick + 0.45;
    m.napping = false;
    m.shoveTarget = null;
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
  function startRandomEvent() {
    if (randomEventInProgress || photoInProgress || fireworksInProgress || grabbedMonster)
      return;
    if (!monsters.length) {
      nextRandomEventAt = performance.now() + 10000;
      return;
    }
    randomEventInProgress = true;
    randomEventType = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
    const now = performance.now();
    randomEventEnd = now + 10000;
    randomEventEndTick = tick + 10;
    if (randomEventType === "thunder") nextStrikeAt = now + 450 + Math.random() * 600;
    if (randomEventType === "night") dayReturnAt = 0;
    for (const m of monsters) {
      m.vx = m.vy = 0;
      m.turnIn = 0;
      m.action = "";
      m.actionUntil = 0;
      m.napping = false;
      m.shoveTarget = null;
      m.thunderRunUntil = 0;
    }
  }

  function endRandomEvent(now) {
    if (randomEventType === "night") dayReturnAt = now;
    randomEventInProgress = false;
    randomEventType = "";
    lightning = null;
    scatterCharacters(monsters, tick);
    scatterUntil = tick + SCATTER_SECONDS;
    nextRandomEventAt = now + 50000 + Math.random() * 20000;
  }

  function updateThunder(now) {
    if (lightning && now >= lightning.until) lightning = null;
    if (now < nextStrikeAt) return;
    const x = w * (0.1 + Math.random() * 0.8);
    lightning = {
      x,
      until: now + 260,
      offsets: Array.from({ length: 9 }, (_, i) =>
        i === 8 || i % 2 === 0 ? 0 : (Math.random() - 0.5) * Math.min(54, w * 0.12),
      ),
    };
    nextStrikeAt = now + 1550 + Math.random() * 1000;
    for (const m of monsters) {
      if (m !== grabbedMonster && boltEscape(m, x, characterRadius(m), w, tick)) {
        setCharacterAction(m, "startled", 0.72);
      }
    }
  }

  function turnCharacter(m, minSpeed = 10, speedRange = 40) {
    m.turnIn = 0.4 + Math.random() * 2.8;
    const angle = Math.random() * Math.PI * 2;
    const speed = minSpeed + Math.random() * speedRange;
    m.vx = Math.cos(angle) * speed;
    m.vy = Math.sin(angle) * speed;
  }

  function updateWeatherCharacter(m, dt) {
    m.napping = false;
    if (randomEventType === "wind") {
      m.sweatUntil = tick + 0.5;
      placeCharacter(m, m.x + 150 * dt, m.y);
    } else if (randomEventType === "rain" || randomEventType === "thunder") {
      if (tick < m.thunderRunUntil) {
        placeCharacter(m, m.x + m.vx * dt, m.y + 16 * dt);
        return;
      }
      if (tick >= m.actionUntil || m.action !== "startled")
        setCharacterAction(m, "angry", Math.max(0, randomEventEndTick - tick));
      placeCharacter(m, m.x, m.y + 42 * dt);
    } else if (randomEventType === "heat") {
      if (m.action !== "tired" || tick >= m.actionUntil)
        setCharacterAction(m, "tired", Math.max(0, randomEventEndTick - tick));
      m.sweatUntil = tick + 0.45;
      m.turnIn -= dt;
      if (m.turnIn <= 0) turnCharacter(m, 22, 16);
      moveCharacter(m, dt * 0.3);
      return;
    } else {
      if (m.action !== "sleep" || tick >= m.actionUntil)
        setCharacterAction(m, "sleep", Math.max(0, randomEventEndTick - tick));
    }
    m.vx = m.vy = 0;
  }

  function moveCharacter(m, dt) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    const { left, right, top, bottom } = movementLimits(w, h);
    if (m.x < left) {
      m.x = left;
      m.vx = Math.abs(m.vx);
    } else if (m.x > right) {
      m.x = right;
      m.vx = -Math.abs(m.vx);
    }
    if (m.y < top) {
      m.y = top;
      m.vy = Math.abs(m.vy);
    } else if (m.y > bottom) {
      m.y = bottom;
      m.vy = -Math.abs(m.vy);
    }
  }

  function updateCharacters(now, dt) {
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
          skyFlash = 1;
          skyFlashColor = fireworksBurst(m, fireworkShapes[order % fireworkShapes.length], particles);
          soundBurst(panFor(m.x));
          soundCheer();
          fireworkCall(fireworkCalls, w, h, fireworkCallText(order), order);
          monsters.splice(i, 1);
          continue;
        }
        const eased = 1 - (1 - progress) ** 2,
          topLimit = Math.min(
            baseCharacterRadius(m, w, h) + 18,
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
            y: m.y + baseCharacterRadius(m, w, h) * 0.35,
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
      if (randomEventInProgress) {
        updateWeatherCharacter(m, dt);
        continue;
      }
      const scatterTime = Math.min(dt, scatterUntil - (tick - dt));
      if (scatterTime > 0) {
        moveCharacter(m, scatterTime * SCATTER_SPEED_MULTIPLIER + dt - scatterTime);
        continue;
      }
      const steered = steerPersonality(m, monsters, characterRadius, tick, dt);
      if (!steered) {
        m.turnIn -= dt;
        if (m.turnIn <= 0) turnCharacter(m);
      }
      moveCharacter(m, dt);
      if (!steered && !m.bombEnd && tick >= m.nextActionAt && tick >= m.actionUntil) {
        const action = Math.random() < 0.5 ? "jump" : "dance";
        setCharacterAction(m, action, action === "jump" ? 0.85 : 1.35);
        m.nextActionAt = tick + 4 + Math.random() * 5;
      }
    }
    if (!photoInProgress && !fireworksInProgress && !randomEventInProgress && tick >= scatterUntil) avoidNearCollisions();
  }

  function update(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick += dt;
    if (fireworksInProgress && !dayReturnAt) {
      nightProgress = Math.min(1, nightProgress + dt / 3.2);
    } else if (randomEventInProgress && randomEventType === "night") {
      dayReturnAt = 0;
      nightProgress = Math.min(1, nightProgress + dt / 1.2);
    }
    wc.clearRect(0, 0, w, h);
    renderBackground(wc, w, h, topbar.offsetHeight, app.clientHeight);
    if (randomEventInProgress) {
      if (randomEventType === "rain" || randomEventType === "thunder") drawRain(wc, w, h, tick);
      if (randomEventType === "thunder") {
        updateThunder(now);
        if (lightning) drawLightning(wc, w, h, lightning, now);
      } else if (randomEventType === "wind") drawWind(wc, w, h, tick);
      else if (randomEventType === "heat") drawHeat(wc, w, h, tick);
    }
    updateCharacters(now, dt);
    for (const m of monsters) {
      renderCharacter(wc, m);
      const replacementDeadline = monsters.length >= MAX_CHARACTERS && replacement?.target === m
        ? replacement.deadline : Infinity;
      const deadline = Math.min(m.bombEnd || Infinity, replacementDeadline);
      if (deadline !== Infinity) {
        const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
        if (remaining !== m.lastBombSecond) {
          m.lastBombSecond = remaining;
          soundTick(remaining, panFor(m.x));
        }
        drawBombCountdown(wc, m, characterRadius(m), remaining, now);
      }
    }
    updateParticles(wc, particles, dt);
    skyFlash = Math.max(0, skyFlash - dt * 2.4);
    if (dayReturnAt && now >= dayReturnAt) {
      nightProgress = Math.max(0, nightProgress - dt / 3);
      if (nightProgress <= 0) {
        dayReturnAt = 0;
        if (fireworksInProgress) {
          fireworksInProgress = false;
          onFireworksChange(false);
        }
      }
    }
    if (
      fireworksInProgress &&
      !dayReturnAt &&
      nightProgress >= 1 &&
      monsters.every((m) => !m.fireworkAt)
    ) {
      dayReturnAt = now + 2200;
    }
    if (randomEventInProgress && (monsters.length === 0 || now >= randomEventEnd))
      endRandomEvent(now);
    if (
      !randomEventInProgress &&
      !photoInProgress &&
      !fireworksInProgress &&
      !grabbedMonster &&
      monsters.length > 0 &&
      now >= nextRandomEventAt
    )
      startRandomEvent();
    updateTopButtons();
  }
  function photoTargets() {
    if (!monsters.length) return [];
    const marginX = Math.min(18, w * 0.05),
      marginY = Math.min(22, h * 0.05),
      bubbleSpace = Math.min(78, h * 0.16),
      areaWidth = Math.max(1, w - marginX * 2),
      areaHeight = Math.max(1, h - marginY * 2 - bubbleSpace),
      maxRadius = Math.max(...monsters.map((m) => baseCharacterRadius(m, w, h)));
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
  function beginPose() {
    if (photoInProgress || fireworksInProgress || randomEventInProgress) return false;
    onPresentationStart();
    const targets = photoTargets();
    photoInProgress = true;
    if (grabbedMonster) releaseGrab(null, false);
    monsters.forEach((m, index) => {
      m.napping = false;
      m.shoveTarget = null;
      m.photoTarget = targets[index];
      m.presentationScale = m.presentationScale || 1;
      m.vx = 0;
      m.vy = 0;
      m.turnIn = 3;
      m.nextActionAt = Math.max(m.nextActionAt, tick + 3);
    });
    return true;
  }
  function alignPose() {
    for (const m of monsters) {
      if (!m.photoTarget) continue;
      m.x = m.photoTarget.x;
      m.y = m.photoTarget.y;
      m.presentationScale = m.photoTarget.scale;
    }
  }
  function endPose() {
    photoInProgress = false;
    for (const m of monsters) {
      m.photoTarget = null;
      m.turnIn = 0.7;
      m.nextActionAt = Math.max(m.nextActionAt, tick + 2);
    }
  }
  function renderBackground(ctx, width, height, topOffset, totalHeight) {
    drawBackground(ctx, width, height, { nightProgress, skyFlash, skyFlashColor, tick }, topOffset, totalHeight);
  }
  function renderCharacter(ctx, character) {
    drawCharacter(ctx, character, tick, character === grabbedMonster, w, h);
  }
  function captureScene(ctx, width, height) {
    const scale = Math.min(1080 / Math.max(w, 1), 930 / Math.max(h, 1));
    renderBackground(ctx, width, height);
    ctx.save();
    ctx.translate((width - w * scale) / 2, 135 + (930 - h * scale) / 2);
    ctx.scale(scale, scale);
    for (const m of monsters) renderCharacter(ctx, m);
    ctx.restore();
  }
  function startFireworks() {
    if (photoInProgress || fireworksInProgress || randomEventInProgress) return;
    fireworksInProgress = true;
    dayReturnAt = 0;
    onFireworksChange(true);
    updateTopButtons();
    fireworksStartedAt = performance.now();
    if (grabbedMonster) releaseGrab(null, false);
    monsters.forEach((m, index) => {
      m.photoTarget = null;
      m.vx = 0;
      m.vy = 0;
      m.napping = false;
      m.fireworkAt = fireworksStartedAt + 3200 + index * 1500;
      m.fireworkStartAt = 0;
      m.fireworkOrder = index;
    });
    const startedAt = fireworksStartedAt;
    setTimeout(() => {
      if (!fireworksInProgress || fireworksStartedAt !== startedAt) return;
      soundPhotoCue();
      fireworkCall(
        fireworkCalls, w, h,
        monsters.length ? "はなび いくよ〜！" : "おほしさま きらきら〜",
        3,
      );
    }, 1200);
  }
  createPhoto(root, $("photo"), { audio, beginPose, alignPose, endPose, captureScene });
  $("fireworks").onclick = startFireworks;
  resize();
  return { canvas: world, isBusy: isPlaygroundBusy, prepareArtwork, planLanding, addArtwork, update };
}
