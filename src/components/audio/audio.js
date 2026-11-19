export function createAudio() {
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
  const bgm = new Audio(new URL("../../../assets/audio/Through_the_Garden_Gate.mp3", import.meta.url));
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
  return { startBgm, tone, soundRocket, soundBurst, soundCheer, soundShutter, soundPhotoCue, soundDraw, soundFloat, soundTick, soundExplosion };
}
