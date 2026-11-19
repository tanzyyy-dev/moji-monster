import { createAudio } from "./components/audio/audio.js";
import { createDrawingEditor } from "./components/drawing-editor/drawing-editor.js";
import { createPlayground } from "./components/playground/playground.js";
import { createPointerEffects } from "./components/pointer-effects/pointer-effects.js";
import { installZoomGuards } from "./zoom-guard.mjs";

const audio = createAudio();
const { sparkle } = createPointerEffects(document.querySelector("#pointer-effects"));
const playground = createPlayground(document.querySelector("#playground"), {
  app: document.querySelector(".app"),
  topbar: document.querySelector(".topbar"),
  audio,
  sparkle,
  onPresentationStart: () => editor.cancelFloat(),
});
const editor = createDrawingEditor(document.querySelector("#drawing-editor"), {
  audio,
  sparkle,
  isPlaygroundBusy: playground.isBusy,
  planLanding: playground.planLanding,
  onComplete: playground.addArtwork,
});

document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("dragstart", (event) => event.preventDefault());
document.addEventListener("selectstart", (event) => {
  if (!event.target.closest("input")) event.preventDefault();
});
installZoomGuards({
  document,
  canvases: [playground.canvas, editor.canvas],
});

function frame(now) {
  playground.update(now);
  editor.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
