const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const zoomGuard = require(path.join(root, "src", "zoom-guard.mjs"));

function makeTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, handler, options) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ handler, options });
    },
    dispatch(type, event) {
      const list = listeners.get(type) || [];
      for (const entry of list) entry.handler(event);
    },
  };
}

function makeEvent(overrides) {
  const base = {
    timeStamp: 0,
    clientX: 0,
    clientY: 0,
    cancelable: true,
    defaultPrevented: false,
    ctrlKey: false,
    touches: [],
    changedTouches: [{ clientX: 0, clientY: 0 }],
    target: null,
    preventDefault() {
      if (this.cancelable !== false) this.defaultPrevented = true;
    },
    composedPath() {
      return this.target ? [this.target] : [];
    },
  };
  const event = Object.assign(base, overrides || {});
  if (overrides && overrides.changedTouches) {
    event.changedTouches = overrides.changedTouches;
  }
  if (overrides && overrides.touches) {
    event.touches = overrides.touches;
  }
  return event;
}

test("double tap: first tap is not canceled", () => {
  const target = makeTarget();
  zoomGuard.installDoubleTapZoomBlocker(target);
  const event = makeEvent({
    timeStamp: 100,
    changedTouches: [{ clientX: 10, clientY: 10 }],
  });
  target.dispatch("touchend", event);
  assert.equal(event.defaultPrevented, false);
});

test("double tap: second tap within time and distance is canceled", () => {
  const target = makeTarget();
  zoomGuard.installDoubleTapZoomBlocker(target);
  const first = makeEvent({
    timeStamp: 100,
    changedTouches: [{ clientX: 10, clientY: 10 }],
  });
  target.dispatch("touchend", first);
  const second = makeEvent({
    timeStamp: 200,
    changedTouches: [{ clientX: 12, clientY: 12 }],
  });
  target.dispatch("touchend", second);
  assert.equal(second.defaultPrevented, true);
});

test("double tap: too late second tap is not canceled", () => {
  const target = makeTarget();
  zoomGuard.installDoubleTapZoomBlocker(target);
  const first = makeEvent({
    timeStamp: 100,
    changedTouches: [{ clientX: 10, clientY: 10 }],
  });
  target.dispatch("touchend", first);
  const second = makeEvent({
    timeStamp: 500,
    changedTouches: [{ clientX: 12, clientY: 12 }],
  });
  target.dispatch("touchend", second);
  assert.equal(second.defaultPrevented, false);
});

test("double tap: too far second tap is not canceled", () => {
  const target = makeTarget();
  zoomGuard.installDoubleTapZoomBlocker(target);
  const first = makeEvent({
    timeStamp: 100,
    changedTouches: [{ clientX: 10, clientY: 10 }],
  });
  target.dispatch("touchend", first);
  const second = makeEvent({
    timeStamp: 200,
    changedTouches: [{ clientX: 60, clientY: 60 }],
  });
  target.dispatch("touchend", second);
  assert.equal(second.defaultPrevented, false);
});

test("double tap: both #world and #draw are guarded", () => {
  for (const name of ["world", "draw"]) {
    const target = makeTarget();
    zoomGuard.installDoubleTapZoomBlocker(target);
    const first = makeEvent({
      timeStamp: 10,
      changedTouches: [{ clientX: 5, clientY: 5 }],
    });
    target.dispatch("touchend", first);
    const second = makeEvent({
      timeStamp: 20,
      changedTouches: [{ clientX: 6, clientY: 6 }],
    });
    target.dispatch("touchend", second);
    assert.equal(second.defaultPrevented, true, name);
  }
});

test("double tap: operations outside canvas are not canceled", () => {
  const unguarded = makeTarget();
  const event = makeEvent({
    timeStamp: 100,
    changedTouches: [{ clientX: 10, clientY: 10 }],
  });
  unguarded.dispatch("touchend", event);
  assert.equal(event.defaultPrevented, false);
});

test("double tap: multi-finger touchend is not treated as double tap", () => {
  const target = makeTarget();
  zoomGuard.installDoubleTapZoomBlocker(target);
  const first = makeEvent({
    timeStamp: 100,
    changedTouches: [{ clientX: 10, clientY: 10 }],
    touches: [],
  });
  target.dispatch("touchend", first);
  const second = makeEvent({
    timeStamp: 150,
    changedTouches: [{ clientX: 11, clientY: 11 }, { clientX: 20, clientY: 20 }],
    touches: [],
  });
  target.dispatch("touchend", second);
  assert.equal(second.defaultPrevented, false);
});

test("double tap: remaining fingers (touches.length > 1) is not treated as tap", () => {
  const target = makeTarget();
  zoomGuard.installDoubleTapZoomBlocker(target);
  const first = makeEvent({
    timeStamp: 100,
    changedTouches: [{ clientX: 10, clientY: 10 }],
    touches: [],
  });
  target.dispatch("touchend", first);
  const second = makeEvent({
    timeStamp: 150,
    changedTouches: [{ clientX: 11, clientY: 11 }],
    touches: [{}, {}],
  });
  target.dispatch("touchend", second);
  assert.equal(second.defaultPrevented, false);
});

test("double tap: non-cancelable event does not throw and is not canceled", () => {
  const target = makeTarget();
  zoomGuard.installDoubleTapZoomBlocker(target);
  const first = makeEvent({
    timeStamp: 100,
    changedTouches: [{ clientX: 10, clientY: 10 }],
    cancelable: true,
  });
  target.dispatch("touchend", first);
  const second = makeEvent({
    timeStamp: 150,
    changedTouches: [{ clientX: 11, clientY: 11 }],
    cancelable: false,
  });
  assert.doesNotThrow(() => target.dispatch("touchend", second));
  assert.equal(second.defaultPrevented, false);
});

test("double tap: listener is registered with passive: false", () => {
  const target = makeTarget();
  zoomGuard.installDoubleTapZoomBlocker(target);
  const registrations = target.listeners.get("touchend");
  assert.ok(Array.isArray(registrations) && registrations.length > 0);
  assert.equal(registrations[0].options.passive, false);
});

test("pinch: gesturestart, gesturechange, gestureend are canceled", () => {
  const target = makeTarget();
  zoomGuard.installSafariPinchZoomBlocker(target);
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    const event = makeEvent({ cancelable: true });
    target.dispatch(type, event);
    assert.equal(event.defaultPrevented, true, type);
  }
});

test("pinch: gesture listener is registered with passive: false", () => {
  const target = makeTarget();
  zoomGuard.installSafariPinchZoomBlocker(target);
  const registrations = target.listeners.get("gesturestart");
  assert.ok(Array.isArray(registrations) && registrations.length > 0);
  assert.equal(registrations[0].options.passive, false);
});

test("pinch: multi-finger touchmove is canceled", () => {
  const target = makeTarget();
  zoomGuard.installTouchMovePinchBlocker(target);
  const event = makeEvent({
    touches: [{}, {}],
    changedTouches: [],
    cancelable: true,
  });
  target.dispatch("touchmove", event);
  assert.equal(event.defaultPrevented, true);
});

test("pinch: single-finger touchmove is not canceled", () => {
  const target = makeTarget();
  zoomGuard.installTouchMovePinchBlocker(target);
  const event = makeEvent({
    touches: [{}],
    changedTouches: [],
    cancelable: true,
  });
  target.dispatch("touchmove", event);
  assert.equal(event.defaultPrevented, false);
});

test("wheel: ctrlKey wheel is canceled", () => {
  const target = makeTarget();
  zoomGuard.installCtrlWheelZoomBlocker(target);
  const event = makeEvent({ ctrlKey: true, cancelable: true });
  target.dispatch("wheel", event);
  assert.equal(event.defaultPrevented, true);
});

test("wheel: normal wheel is not canceled", () => {
  const target = makeTarget();
  zoomGuard.installCtrlWheelZoomBlocker(target);
  const event = makeEvent({ ctrlKey: false, cancelable: true });
  target.dispatch("wheel", event);
  assert.equal(event.defaultPrevented, false);
});

test("viewport and touch-action settings are maintained", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /user-scalable=no/);
  assert.match(html, /maximum-scale=1/);
  const css = fs.readFileSync(path.join(root, "styles", "main.css"), "utf8");
  assert.match(css, /touch-action:\s*none/);
});
