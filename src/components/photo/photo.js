import markup from "./photo.html?raw";
import { withIconUrls } from "../../icons.js";

export function createPhoto(root, button, { audio, beginPose, alignPose, endPose, captureScene }) {
  root.insertAdjacentHTML("beforeend", withIconUrls(markup));
  const photoStage = root.querySelector("#photo-stage");
  const photoMessage = root.querySelector("#photo-message");
  const photoMessageText = root.querySelector("#photo-message-text");
  const photoFlash = root.querySelector("#photo-flash");
  const { soundPhotoCue, soundShutter, tone } = audio;

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
      target = button.getBoundingClientRect(),
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
      button.classList.remove("received");
      void button.offsetWidth;
      button.classList.add("received");
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
      dateLabel = ymd.join(".") + "  " + hm.join(":");
    captureScene(c, out.width, out.height);
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
    if (!beginPose()) return;
    soundPhotoCue();
    showPhotoMessage("あつまれ〜", "gather");
    await wait(750);
    soundPhotoCue();
    showPhotoMessage("ならんで〜", "line");
    await wait(1000);
    alignPose();
    tone(880, 0.1, "sine", 0.035);
    tone(1175, 0.16, "sine", 0.035, 0.09);
    showPhotoMessage("はい、チーズ！", "cheese");
    await wait(700);
    soundShutter();
    photoStage.classList.add("snap");
    photoFlash.classList.remove("active");
    void photoFlash.offsetWidth;
    photoFlash.classList.add("active");
    const shot = savePhoto();
    await wait(380);
    hidePhotoStage();
    showPhotoPrint(shot);
    endPose();
  }
  button.onclick = () => void takePhoto();
}
