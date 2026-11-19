const personalities = ["regular", "mischief", "timid", "lazy"];
const chasePriority = { lazy: 0, timid: 1, regular: 2 };

export function choosePersonality(random = Math.random) {
  return personalities[Math.floor(random() * personalities.length)];
}

// Return true when a personality owns movement for this frame.
export function steerPersonality(character, others, radius, tick, dt) {
  const type = character.personality;
  if (!type || type === "regular") return false;

  let neighbor, distance = Infinity, priority = Infinity;
  for (const other of others) {
    if (other === character) continue;
    const rank = type === "mischief" ? chasePriority[other.personality] ?? 3 : 0;
    const separation = Math.hypot(other.x - character.x, other.y - character.y);
    if (rank < priority || (rank === priority && separation < distance)) {
      neighbor = other;
      distance = separation;
      priority = rank;
    }
  }

  const near = neighbor ? radius(character) + radius(neighbor) : 0;
  if (type === "lazy") {
    if (character.shoveTarget) {
      const target = character.shoveTarget;
      const remaining = Math.hypot(target.x - character.x, target.y - character.y);
      if (remaining > 0.5) {
        aim(character, target, remaining, Math.min(185, remaining / Math.max(dt, 0.001)), 1);
        return true;
      }
      character.shoveTarget = null;
      character.vx = character.vy = 0;
    }
    const startled = neighbor && distance < near + 30;
    if (startled && !character.hadCloseNeighbor) {
      aim(character, neighbor, distance, -125, 1);
      character.wakeUntil = tick + 0.65;
    }
    character.hadCloseNeighbor = Boolean(startled);
    character.napping = !(tick < character.wakeUntil);
    if (character.napping) character.vx = character.vy = 0;
    return true;
  }

  if (tick < character.reactionCooldown) return true;
  if (!neighbor || (type === "timid" && distance > near + 105)) return false;

  const speed = type === "mischief" ? 100 : -120;
  aim(character, neighbor, distance, speed, 1 - Math.exp(-dt * 9));
  return true;
}

function aim(character, neighbor, distance, speed, amount) {
  const dx = distance ? (neighbor.x - character.x) / distance : Math.cos(character.phase);
  const dy = distance ? (neighbor.y - character.y) / distance : Math.sin(character.phase);
  character.vx += (dx * speed - character.vx) * amount;
  character.vy += (dy * speed - character.vy) * amount;
}

export function movementLimits(width, height) {
  const left = Math.min(40, width / 2), top = Math.min(45, height / 2);
  return { left, right: width - left, top, bottom: Math.max(top, height - 40) };
}

export function shoveDestination(pusher, target, width, height, clearance) {
  const { left, right, top, bottom } = movementLimits(width, height);
  const dx = target.x - pusher.x, dy = target.y - pusher.y;
  const angle = Math.hypot(dx, dy) >= 1 ? Math.atan2(dy, dx) : target.phase;
  let best, bestDistance = -1;
  // Aim away first, then along the edge if the direct path is too short.
  for (const turn of [0, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const x = Math.max(left, Math.min(right, pusher.x + Math.cos(angle + turn) * clearance));
    const y = Math.max(top, Math.min(bottom, pusher.y + Math.sin(angle + turn) * clearance));
    const separation = Math.hypot(x - pusher.x, y - pusher.y);
    if (separation >= clearance - 1) return { x, y };
    if (separation > bestDistance) {
      best = { x, y };
      bestDistance = separation;
    }
  }
  return best;
}

export const SCATTER_SECONDS = 1;
export const SCATTER_SPEED_MULTIPLIER = 2.6;

export function scatterCharacters(characters, tick, random = Math.random) {
  if (!characters.length) return;
  const x = characters.reduce((sum, m) => sum + m.x, 0) / characters.length;
  const y = characters.reduce((sum, m) => sum + m.y, 0) / characters.length;
  const spin = random() * Math.PI * 2;
  for (const [index, m] of characters.entries()) {
    const away = Math.hypot(m.x - x, m.y - y) > 10;
    const angle = away
      ? Math.atan2(m.y - y, m.x - x) + (random() - 0.5) * 0.6
      : spin + (index * Math.PI * 2) / characters.length;
    const speed = 38 + random() * 8;
    m.vx = Math.cos(angle) * speed;
    m.vy = Math.sin(angle) * speed;
    m.turnIn = 0.35 + random() * 0.4;
    m.action = "";
    m.actionUntil = 0;
    m.sweatUntil = 0;
    m.thunderRunUntil = 0;
    m.napping = false;
    m.shoveTarget = null;
    m.wakeUntil = 0;
    m.hadCloseNeighbor = false;
    m.nextActionAt = tick + 2 + random() * 2;
  }
}

export function boltEscape(character, strikeX, radius, width, tick) {
  if (Math.abs(character.x - strikeX) > radius + 12) return false;
  const spaceLeft = character.x - radius, spaceRight = width - radius - character.x;
  let direction = character.x < strikeX ? -1 : 1;
  if (direction < 0 && spaceLeft < 50 && spaceRight > spaceLeft) direction = 1;
  if (direction > 0 && spaceRight < 50 && spaceLeft > spaceRight) direction = -1;
  character.vx = direction * 215;
  character.thunderRunUntil = tick + 0.64;
  return true;
}
