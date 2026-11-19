(function (root) {
  "use strict";

  const DOUBLE_TAP_WINDOW_MS = 350;
  const DOUBLE_TAP_RADIUS_PX = 30;

  function asArray(value) {
    if (value == null) return [];
    if (Array.isArray(value)) return value.slice();
    if (
      typeof value === "object" &&
      typeof value.length === "number" &&
      typeof value.addEventListener !== "function" &&
      typeof value !== "string"
    ) {
      try {
        return Array.from(value);
      } catch (e) {
        const out = [];
        for (let i = 0; i < value.length; i++) out.push(value[i]);
        return out;
      }
    }
    return [value];
  }

  function safePreventDefault(e) {
    if (!e || typeof e.preventDefault !== "function") return;
    try {
      e.preventDefault();
    } catch (err) {
      // Ignore non-cancelable or otherwise unusable events.
    }
  }

  function tapsInteractiveElement(e) {
    const path =
      typeof e.composedPath === "function" ? e.composedPath() : [e && e.target];
    const selector =
      "a[href], button, input, label, select, summary, textarea, [contenteditable], [role='button']";
    if (!Array.isArray(path)) return false;
    for (const el of path) {
      if (el && typeof el.matches === "function") {
        try {
          if (el.matches(selector)) return true;
        } catch (err) {
          // Ignore selector errors from non-Element nodes.
        }
      }
    }
    return false;
  }

  function getTouchCoords(e) {
    const touch = e && e.changedTouches && e.changedTouches[0];
    if (touch) {
      return {
        x: typeof touch.clientX === "number" ? touch.clientX : 0,
        y: typeof touch.clientY === "number" ? touch.clientY : 0,
      };
    }
    if (e && typeof e.clientX === "number") {
      return { x: e.clientX, y: typeof e.clientY === "number" ? e.clientY : 0 };
    }
    return { x: 0, y: 0 };
  }

  function isSingleFingerTouch(e) {
    const changed =
      e && e.changedTouches && typeof e.changedTouches.length === "number"
        ? e.changedTouches.length
        : 1;
    const remaining =
      e && e.touches && typeof e.touches.length === "number"
        ? e.touches.length
        : 0;
    return changed === 1 && remaining <= 1;
  }

  function isDoubleTap(previous, current, windowMs, radiusPx) {
    if (!previous || !current) return false;
    const w =
      windowMs == null ? DOUBLE_TAP_WINDOW_MS : windowMs;
    const r =
      radiusPx == null ? DOUBLE_TAP_RADIUS_PX : radiusPx;
    const dt = current.time - previous.time;
    const dist = Math.hypot(current.x - previous.x, current.y - previous.y);
    return dt <= w && dist <= r;
  }

  function installSafariPinchZoomBlocker(target) {
    if (!target || typeof target.addEventListener !== "function") return;
    const block = (e) => {
      safePreventDefault(e);
    };
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
      target.addEventListener(type, block, { passive: false });
    }
  }

  function installTouchMovePinchBlocker(target) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(
      "touchmove",
      (e) => {
        if (e && e.touches && e.touches.length > 1) {
          safePreventDefault(e);
        }
      },
      { passive: false },
    );
  }

  function installCtrlWheelZoomBlocker(target) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(
      "wheel",
      (e) => {
        if (e && e.ctrlKey) {
          safePreventDefault(e);
        }
      },
      { passive: false },
    );
  }

  function createDoubleTapHandler(options) {
    if (typeof options === "number") {
      options = { windowMs: options, radiusPx: arguments[1] };
    }
    options = options || {};
    const windowMs =
      options.windowMs != null ? options.windowMs : DOUBLE_TAP_WINDOW_MS;
    const radiusPx =
      options.radiusPx != null ? options.radiusPx : DOUBLE_TAP_RADIUS_PX;
    const skipInteractive =
      options.skipInteractive == null ? true : !!options.skipInteractive;

    let lastTapTime = -Infinity;
    let lastTapX = 0;
    let lastTapY = 0;

    return function handleTouchEnd(e) {
      if (!isSingleFingerTouch(e)) return;

      const coords = getTouchCoords(e);
      const now = typeof e.timeStamp === "number" ? e.timeStamp : 0;
      const prev = { time: lastTapTime, x: lastTapX, y: lastTapY };
      const curr = { time: now, x: coords.x, y: coords.y };
      const doubleTap =
        lastTapTime !== -Infinity &&
        isDoubleTap(prev, curr, windowMs, radiusPx);

      lastTapTime = now;
      lastTapX = coords.x;
      lastTapY = coords.y;

      if (
        doubleTap &&
        e.cancelable !== false &&
        !(skipInteractive && tapsInteractiveElement(e))
      ) {
        safePreventDefault(e);
      }
    };
  }

  function installDoubleTapZoomBlocker(target, options) {
    if (!target || typeof target.addEventListener !== "function") return null;
    if (typeof options === "number") {
      options = { windowMs: options, radiusPx: arguments[2] };
    }
    const handler = createDoubleTapHandler(options);
    target.addEventListener("touchend", handler, { passive: false });
    return handler;
  }

  function installDoubleTapZoomBlockers(targets, options) {
    return asArray(targets).map((t) =>
      installDoubleTapZoomBlocker(t, options),
    );
  }

  function installZoomGuards(options) {
    options = options || {};
    const doc =
      options.document ||
      (typeof document !== "undefined" ? document : null);
    const targets =
      options.targets ||
      options.canvases ||
      (doc && typeof doc.getElementById === "function"
        ? [doc.getElementById("world"), doc.getElementById("draw")].filter(
            Boolean,
          )
        : []);

    if (doc) {
      installSafariPinchZoomBlocker(doc);
      installTouchMovePinchBlocker(doc);
      installCtrlWheelZoomBlocker(doc);
    }
    return installDoubleTapZoomBlockers(targets, options);
  }

  const api = {
    DOUBLE_TAP_WINDOW_MS,
    DOUBLE_TAP_RADIUS_PX,
    DOUBLE_TAP_TIMEOUT: DOUBLE_TAP_WINDOW_MS,
    DOUBLE_TAP_DISTANCE: DOUBLE_TAP_RADIUS_PX,
    isDoubleTap,
    isDoubleTapGesture: isDoubleTap,
    tapsInteractiveElement,
    getTouchCoords,
    isSingleFingerTouch,
    safePreventDefault,
    createDoubleTapHandler,
    installSafariPinchZoomBlocker,
    installPinchZoomBlocker: installSafariPinchZoomBlocker,
    installTouchMovePinchBlocker,
    installTouchMoveZoomBlocker: installTouchMovePinchBlocker,
    installCtrlWheelZoomBlocker,
    installCtrlWheelZoom: installCtrlWheelZoomBlocker,
    installDoubleTapZoomBlocker,
    installDoubleTapZoomBlockers,
    installDoubleTapZoom: installDoubleTapZoomBlocker,
    installZoomGuards,
    installZoomGuard: installZoomGuards,
    installAll: installZoomGuards,
  };

  try {
    root.UkabeteZoomGuard = api;
  } catch (e) {
    // Ignore global assignment failures.
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  return api;
})(typeof globalThis !== "undefined" ? globalThis : typeof global !== "undefined" ? global : this);
