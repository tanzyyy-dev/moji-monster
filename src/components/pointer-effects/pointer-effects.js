import markup from "./pointer-effects.html?raw";
import { withIconUrls } from "../../icons.js";

export function createPointerEffects(root) {
  root.innerHTML = withIconUrls(markup);
  const magicCursor = root.querySelector("#magic-cursor");
  const pointerFx = root.querySelector("#pointer-fx");
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

  return { sparkle };
}
