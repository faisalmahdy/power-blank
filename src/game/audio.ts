type Bus = { master: GainNode; sfx: GainNode; music: GainNode };

export type AudioHandle = {
  unlock: () => void;
  setGains: (master: number, sfx: number, music: number) => void;
  gun: (kind: string, dist?: number, pan?: number) => void;
  hit: (head: boolean) => void;
  foot: (sprint: boolean, dist?: number, id?: string, crouch?: boolean, pan?: number) => void;
  land: () => void;
  reload: (kind?: string) => void;
  cycle: (kind?: string) => void;
  empty: () => void;
  hurt: (pan?: number, armor?: boolean) => void;
  boom: (pan?: number) => void;
  ui: () => void;
  plant: () => void;
  beep: () => void;
  tick: (n: number) => void;
  slam: () => void;
  radio: (kind: "go" | "plant" | "defuse" | "ten" | "down" | "win") => void;
  whoosh: () => void;
  startDrones: () => void;
  stopDrones: () => void;
  dispose: () => void;
};

function noise(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function jitter(amt = 0.08): number {
  return 1 - amt + Math.random() * amt * 2;
}

let sharedCtx: AudioContext | null = null;

/** Call from a real click (START MATCH) so countdown VO can play on mount. */
export function bootAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!sharedCtx) sharedCtx = new AC({ latencyHint: "interactive" });
  if (sharedCtx.state === "suspended") void sharedCtx.resume();
  return sharedCtx;
}

/** Waiting-room 3-2-1 / GO. Safe before createAudio(). n=0 is GO. */
export function lobbyCount(n: number) {
  const ctx = bootAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = n <= 0 ? "sawtooth" : "square";
  osc.frequency.value = n <= 0 ? 220 : 480 + (3 - Math.max(1, Math.min(3, n))) * 140;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(n <= 0 ? 0.16 : 0.1, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (n <= 0 ? 0.38 : 0.16));
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + (n <= 0 ? 0.42 : 0.18));
  if (n <= 0) {
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "square";
    o2.frequency.value = 660;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.start(t);
    o2.stop(t + 0.24);
  }
}

export function createAudio(): AudioHandle {
  let ctx: AudioContext | null = null;
  let bus: Bus | null = null;
  let drone: { osc: OscillatorNode; g: GainNode } | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let footNext = new Map<string, number>();
  let footSide = new Map<string, number>();
  let nextPan = 0;

  function panDest(): AudioNode {
    if (!ctx || !bus) throw new Error("audio");
    if (Math.abs(nextPan) < 0.03) return bus.sfx;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, nextPan));
    p.connect(bus.sfx);
    return p;
  }

  function ensure(): AudioContext {
    if (!ctx) {
      ctx = bootAudio();
      if (!ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AC({ latencyHint: "interactive" });
      }
      const master = ctx.createGain();
      const sfx = ctx.createGain();
      const music = ctx.createGain();
      sfx.gain.value = 1;
      music.gain.value = 0.35;
      master.gain.value = 0.85;
      sfx.connect(master);
      music.connect(master);
      master.connect(ctx.destination);
      bus = { master, sfx, music };
      noiseBuf = noise(ctx, 0.5);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (c.state === "suspended") void c.resume();
  }

  function envGain(peak: number, a: number, d: number, dest: AudioNode, t: number): GainNode {
    const g = ctx!.createGain();
    g.gain.value = 0;
    g.connect(dest);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0008, t + a + d);
    return g;
  }

  function playNoise(
    seconds: number,
    peak: number,
    a: number,
    d: number,
    freq: number,
    q: number,
    rate = 1,
    when?: number,
    filter: BiquadFilterType = "bandpass",
  ) {
    if (!ctx || !bus || !noiseBuf) return;
    const t = when ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = rate;
    const bp = ctx.createBiquadFilter();
    bp.type = filter;
    bp.frequency.value = freq;
    bp.Q.value = q;
    const dest = panDest();
    const g = envGain(peak, a, d, dest, t);
    src.connect(bp);
    bp.connect(g);
    const playDur = Math.max(seconds, a + d) + 0.05;
    const avail = noiseBuf.duration / Math.max(0.35, rate);
    const maxOff = Math.max(0, avail - playDur);
    src.start(t, maxOff > 0 ? Math.random() * Math.min(0.12, maxOff) : 0);
    src.stop(t + playDur);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
      if (dest !== bus!.sfx) dest.disconnect();
    };
  }

  function tone(freq: number, type: OscillatorType, peak: number, a: number, d: number, detune = 0, when?: number) {
    if (!ctx || !bus) return;
    const t = when ?? ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const dest = panDest();
    const g = envGain(peak, a, d, dest, t);
    o.connect(g);
    o.start(t);
    o.stop(t + a + d + 0.04);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      if (dest !== bus!.sfx) dest.disconnect();
    };
  }

  function clink(t: number, freq: number, peak: number, decay: number) {
    tone(freq, "square", peak, 0.001, decay, 0, t);
    playNoise(decay + 0.02, peak * 0.85, 0.001, decay, freq * 3.4, 1.6, 1.05, t);
  }

  function thunk(t: number, freq: number, peak: number, decay: number) {
    tone(freq, "square", peak, 0.001, decay, 0, t);
    playNoise(decay + 0.03, peak, 0.001, decay, Math.max(80, freq * 1.3), 0.75, 0.88, t, "lowpass");
  }

  function slap(t: number, freq: number, peak: number, decay: number) {
    tone(freq, "square", peak, 0.001, decay * 0.65, 0, t);
    playNoise(decay + 0.02, peak * 1.05, 0.001, decay, freq * 3.8, 1.35, 1.08, t);
  }

  const gunMap: Record<string, () => void> = {
    car15: () => {
      const p = jitter(0.08);
      playNoise(0.065, 0.26, 0.001, 0.05, 210, 0.75, p, undefined, "lowpass");
      tone(158 * p, "square", 0.1, 0.001, 0.042);
      playNoise(0.055, 0.54, 0.001, 0.05, 1180, 0.9, p * 1.06);
      playNoise(0.032, 0.3, 0.001, 0.028, 3450, 1.55, p * 1.14);
    },
    ak74: () => {
      const p = jitter(0.08);
      playNoise(0.12, 0.52, 0.001, 0.1, 92, 0.48, p * 0.86, undefined, "lowpass");
      tone(80 * p, "sawtooth", 0.18, 0.001, 0.11);
      playNoise(0.09, 0.48, 0.001, 0.082, 455, 0.62, p * 0.9);
      playNoise(0.055, 0.2, 0.001, 0.05, 1620, 0.95, p * 0.96);
    },
    mp5n: () => {
      const p = jitter(0.08);
      playNoise(0.038, 0.15, 0.001, 0.03, 270, 0.95, p * 1.12, undefined, "lowpass");
      tone(205 * p, "square", 0.055, 0.001, 0.026);
      playNoise(0.032, 0.34, 0.001, 0.028, 1580, 1.15, p * 1.18);
      playNoise(0.022, 0.16, 0.001, 0.02, 3550, 1.7, p * 1.22);
    },
    sr98: () => {
      const p = jitter(0.08);
      playNoise(0.2, 0.84, 0.001, 0.175, 64, 0.38, p * 0.68, undefined, "lowpass");
      tone(50 * p, "sawtooth", 0.26, 0.001, 0.16);
      playNoise(0.1, 0.48, 0.001, 0.09, 255, 0.5, p * 0.74);
      playNoise(0.055, 0.38, 0.001, 0.048, 2280, 1.15, p);
      tone(1480 * p, "square", 0.07, 0.001, 0.028);
    },
    m870: () => {
      const p = jitter(0.08);
      playNoise(0.16, 0.78, 0.001, 0.14, 78, 0.34, p * 0.7, undefined, "lowpass");
      tone(56 * p, "sine", 0.24, 0.001, 0.135);
      playNoise(0.1, 0.5, 0.001, 0.09, 355, 0.42, p * 0.82);
      playNoise(0.075, 0.36, 0.001, 0.065, 1880, 0.55, p * 1.04);
    },
    d50: () => {
      const p = jitter(0.08);
      playNoise(0.11, 0.74, 0.001, 0.095, 88, 0.44, p * 0.78, undefined, "lowpass");
      tone(66 * p, "square", 0.2, 0.001, 0.088);
      playNoise(0.07, 0.48, 0.001, 0.062, 390, 0.58, p * 0.86);
      playNoise(0.042, 0.32, 0.001, 0.036, 2180, 1.12, p);
    },
    g18c: () => {
      const p = jitter(0.08);
      playNoise(0.03, 0.13, 0.001, 0.026, 230, 1.05, p * 1.16, undefined, "lowpass");
      tone(248 * p, "square", 0.052, 0.001, 0.02);
      playNoise(0.028, 0.32, 0.001, 0.024, 1780, 1.28, p * 1.24);
      playNoise(0.018, 0.2, 0.001, 0.016, 4050, 1.9, p * 1.32);
    },
    knife: () => {
      playNoise(0.07, 0.22, 0.003, 0.055, 2500, 1.7, 1.38);
      playNoise(0.045, 0.14, 0.001, 0.038, 4700, 2.2, 1.52);
      tone(900, "triangle", 0.065, 0.001, 0.07);
    },
    he: () => {
      playNoise(0.06, 0.18, 0.002, 0.08, 800, 0.8, 1);
    },
    flash: () => playNoise(0.05, 0.16, 0.002, 0.06, 1200, 0.8, 1.2),
    smoke: () => playNoise(0.08, 0.12, 0.004, 0.1, 500, 0.5, 0.9),
  };

  function reloadMag(t: number) {
    clink(t, 250, 0.055, 0.038);
    thunk(t + 0.18, 175, 0.07, 0.055);
    slap(t + 0.45, 310, 0.08, 0.038);
  }
  function reloadAk(t: number) {
    clink(t, 185, 0.07, 0.05);
    thunk(t + 0.2, 92, 0.11, 0.08);
    slap(t + 0.5, 205, 0.1, 0.048);
    playNoise(0.045, 0.09, 0.001, 0.042, 980, 1.15, 0.82, t + 0.58);
    tone(155, "sawtooth", 0.06, 0.001, 0.05, 0, t + 0.58);
  }
  function reloadMp5(t: number) {
    clink(t, 330, 0.045, 0.028);
    thunk(t + 0.12, 215, 0.055, 0.038);
    slap(t + 0.28, 470, 0.062, 0.028);
  }
  function reloadTube(t: number) {
    tone(710, "triangle", 0.055, 0.001, 0.032, 0, t);
    playNoise(0.038, 0.08, 0.001, 0.032, 2350, 1.85, 1.12, t);
    thunk(t + 0.16, 125, 0.1, 0.055);
    playNoise(0.055, 0.12, 0.001, 0.055, 360, 0.7, 0.84, t + 0.16);
    slap(t + 0.24, 195, 0.085, 0.048);
  }
  function reloadBolt(t: number) {
    clink(t, 205, 0.06, 0.042);
    thunk(t + 0.16, 135, 0.08, 0.06);
    playNoise(0.1, 0.1, 0.004, 0.095, 480, 0.9, 0.68, t + 0.4);
    tone(88, "sawtooth", 0.06, 0.002, 0.1, 0, t + 0.4);
    slap(t + 0.55, 155, 0.12, 0.07);
  }
  function reloadPistol(t: number) {
    clink(t, 285, 0.05, 0.032);
    thunk(t + 0.15, 195, 0.065, 0.042);
    slap(t + 0.36, 530, 0.09, 0.032);
  }
  function cyclePump(t: number) {
    playNoise(0.055, 0.12, 0.001, 0.05, 410, 0.82, 0.9, t);
    tone(148, "square", 0.08, 0.001, 0.048, 0, t);
    playNoise(0.045, 0.11, 0.001, 0.04, 690, 1.02, 1.06, t + 0.07);
    tone(188, "square", 0.07, 0.001, 0.038, 0, t + 0.07);
  }
  function cycleBolt(t: number) {
    playNoise(0.075, 0.11, 0.002, 0.065, 580, 1, 0.74, t);
    tone(108, "sawtooth", 0.07, 0.002, 0.072, 0, t);
    slap(t + 0.09, 175, 0.1, 0.048);
  }
  function cycleSlide(t: number) {
    playNoise(0.055, 0.1, 0.001, 0.05, 1750, 1.5, 1.16, t);
    tone(370, "square", 0.07, 0.001, 0.042, 0, t);
    playNoise(0.035, 0.08, 0.001, 0.032, 2480, 1.65, 1.22, t + 0.055);
  }

  function vox(freq: number, peak: number, dur: number, when?: number) {
    if (!ctx || !bus) return;
    const t = when ?? ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "square";
    o2.frequency.value = freq * 1.49;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1650;
    bp.Q.value = 0.85;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 420;
    const g = envGain(peak, 0.012, dur, bus.sfx, t);
    o.connect(bp);
    o2.connect(bp);
    bp.connect(hp);
    hp.connect(g);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
    o.onended = () => {
      o.disconnect();
      o2.disconnect();
      bp.disconnect();
      hp.disconnect();
      g.disconnect();
    };
  }

  function squelch(when?: number) {
    const t = when ?? ctx!.currentTime;
    playNoise(0.045, 0.1, 0.001, 0.04, 3100, 1.2, 1.35, t);
    playNoise(0.03, 0.06, 0.001, 0.028, 220, 0.7, 0.7, t, "lowpass");
  }

  function phrase(notes: Array<[number, number, number]>, t0?: number) {
    if (!ctx) return;
    const t = t0 ?? ctx.currentTime;
    squelch(t);
    let acc = 0.05;
    for (const [f, p, d] of notes) {
      vox(f, p, d, t + acc);
      acc += d + 0.045;
    }
    playNoise(0.05, 0.07, 0.001, 0.045, 2800, 1.1, 1.2, t + acc);
  }

  return {
    unlock,
    setGains: (master, sfx, music) => {
      ensure();
      if (!ctx || !bus) return;
      const t = ctx.currentTime;
      bus.master.gain.setTargetAtTime(master * master, t, 0.03);
      bus.sfx.gain.setTargetAtTime(sfx * sfx, t, 0.03);
      bus.music.gain.setTargetAtTime(music * music, t, 0.03);
    },
    gun: (kind, dist = 0, pan = 0) => {
      ensure();
      if (!ctx || !bus) return;
      nextPan = pan;
      const att = dist <= 1 ? 1 : Math.max(0.12, 1 - (dist - 1) / 42);
      const fn = gunMap[kind] ?? gunMap.car15!;
      fn();
      if (dist > 14) playNoise(0.05, 0.07 * att, 0.001, 0.06, 380, 0.55, 0.72);
      nextPan = 0;
    },
    hit: (head) => {
      ensure();
      if (head) {
        tone(1480, "square", 0.12, 0.001, 0.05);
        playNoise(0.04, 0.2, 0.001, 0.04, 2800, 1.4, 1.3);
      } else {
        playNoise(0.04, 0.18, 0.001, 0.04, 900, 1, 1);
        tone(420, "triangle", 0.06, 0.001, 0.04);
      }
    },
    foot: (sprint, dist = 0, id = "self", crouch = false, pan = 0) => {
      ensure();
      if (!ctx || !bus) return;
      const now = ctx.currentTime;
      const gap = crouch ? 0.52 : sprint ? 0.255 : 0.4;
      if (now < (footNext.get(id) ?? 0)) return;
      const att = dist <= 0.8 ? 1 : Math.max(0, 1 - (dist - 0.8) / 20);
      if (att < 0.05) return;
      footNext.set(id, now + gap);
      const side = (footSide.get(id) ?? 0) ^ 1;
      footSide.set(id, side);
      const self = dist <= 0.8 ? 0.52 : 1;
      const sneak = crouch ? 0.32 : 1;
      const peak = (sprint ? 0.17 : 0.11) * att * self * sneak;
      const heel = (sprint ? 125 : 175) * (side ? 0.94 : 1.05);
      nextPan = pan;
      playNoise(0.048, peak, 0.001, 0.055, heel, 0.82, 0.58 + Math.random() * 0.1, now, "lowpass");
      tone((sprint ? 58 : 74) * (side ? 0.96 : 1.04), "sine", peak * 0.42, 0.001, 0.055, 0, now);
      playNoise(0.028, peak * 0.5, 0.001, 0.032, sprint ? 390 : 540, 1.05, 0.88 + Math.random() * 0.08, now);
      nextPan = 0;
    },
    land: () => {
      ensure();
      playNoise(0.09, 0.24, 0.001, 0.085, 88, 0.48, 0.52, undefined, "lowpass");
      tone(46, "sine", 0.14, 0.001, 0.1);
    },
    reload: (kind) => {
      ensure();
      if (!ctx || !bus) return;
      const t = ctx.currentTime;
      if (kind === "ak74") reloadAk(t);
      else if (kind === "mp5n") reloadMp5(t);
      else if (kind === "m870") reloadTube(t);
      else if (kind === "sr98") reloadBolt(t);
      else if (kind === "d50" || kind === "g18c") reloadPistol(t);
      else reloadMag(t);
    },
    cycle: (kind) => {
      ensure();
      if (!ctx || !bus) return;
      const t = ctx.currentTime;
      if (kind === "m870") cyclePump(t);
      else if (kind === "sr98") cycleBolt(t);
      else cycleSlide(t);
    },
    empty: () => {
      ensure();
      tone(190, "square", 0.05, 0.001, 0.04);
    },
    hurt: (pan = 0, armor = false) => {
      ensure();
      nextPan = pan;
      if (armor) {
        playNoise(0.055, 0.22, 0.001, 0.05, 2100, 1.35, 1.15);
        tone(1560, "square", 0.09, 0.001, 0.035);
        tone(92, "sine", 0.06, 0.001, 0.07);
      } else {
        playNoise(0.11, 0.3, 0.001, 0.1, 240, 0.65, 0.62);
        tone(86, "sawtooth", 0.11, 0.001, 0.12);
      }
      nextPan = 0;
    },
    boom: (pan = 0) => {
      ensure();
      nextPan = pan;
      playNoise(0.28, 0.9, 0.002, 0.32, 90, 0.4, 0.5);
      playNoise(0.16, 0.4, 0.001, 0.18, 700, 0.6, 0.8);
      tone(48, "sine", 0.28, 0.001, 0.3);
      nextPan = 0;
    },
    ui: () => {
      ensure();
      tone(620, "square", 0.05, 0.001, 0.05);
    },
    plant: () => {
      ensure();
      tone(880, "square", 0.08, 0.001, 0.06);
    },
    beep: () => {
      ensure();
      tone(1040, "square", 0.07, 0.001, 0.05);
    },
    tick: (n) => {
      ensure();
      if (!ctx) return;
      const k = Math.max(1, Math.min(5, Math.round(n)));
      const t = ctx.currentTime;
      squelch(t);
      const f = 118 + (6 - k) * 36;
      vox(f, 0.2, 0.16, t + 0.04);
      vox(f * 1.22, 0.12, 0.11, t + 0.1);
      playNoise(0.04, 0.08, 0.001, 0.04, 2400 - k * 160, 1.05, 1, t + 0.18);
    },
    slam: () => {
      ensure();
      playNoise(0.28, 0.7, 0.002, 0.24, 70, 0.4, 0.5, undefined, "lowpass");
      tone(72, "sawtooth", 0.32, 0.002, 0.28);
      tone(140, "sine", 0.22, 0.002, 0.2);
      tone(740, "square", 0.18, 0.001, 0.14);
      tone(1480, "triangle", 0.1, 0.001, 0.1);
    },
    radio: (kind) => {
      ensure();
      if (!ctx) return;
      const t = ctx.currentTime;
      if (kind === "go") {
        squelch(t);
        vox(156, 0.22, 0.12, t + 0.04);
        vox(210, 0.2, 0.18, t + 0.18);
        vox(248, 0.16, 0.22, t + 0.36);
      } else if (kind === "plant") {
        phrase([
          [150, 0.18, 0.12],
          [168, 0.16, 0.1],
          [132, 0.2, 0.16],
          [188, 0.14, 0.2],
        ]);
      } else if (kind === "defuse") {
        phrase([
          [172, 0.16, 0.1],
          [148, 0.15, 0.12],
          [196, 0.18, 0.14],
          [160, 0.14, 0.18],
        ]);
      } else if (kind === "ten") {
        phrase([
          [210, 0.2, 0.09],
          [240, 0.18, 0.1],
          [188, 0.16, 0.16],
        ]);
      } else if (kind === "down") {
        squelch(t);
        vox(198, 0.14, 0.08, t + 0.03);
        vox(164, 0.12, 0.12, t + 0.12);
      } else if (kind === "win") {
        squelch(t);
        vox(140, 0.18, 0.14, t + 0.04);
        vox(188, 0.16, 0.16, t + 0.2);
        vox(230, 0.14, 0.2, t + 0.38);
      }
    },
    whoosh: () => {
      ensure();
      playNoise(0.12, 0.16, 0.004, 0.12, 600, 0.7, 1.1);
    },
    startDrones: () => {
      ensure();
      if (!ctx || !bus || drone) return;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 52;
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(g);
      g.connect(bus.music);
      osc.start();
      g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.2);
      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.value = 78;
      const g2 = ctx.createGain();
      g2.gain.value = 0;
      osc2.connect(g2);
      g2.connect(bus.music);
      osc2.start();
      g2.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 1.6);
      drone = { osc, g };
    },
    stopDrones: () => {
      if (!ctx || !drone) return;
      drone.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    },
    dispose: () => {
      try {
        drone?.osc.stop();
      } catch {
        /* already stopped */
      }
      if (ctx && ctx === sharedCtx) sharedCtx = null;
      void ctx?.close();
      ctx = null;
      bus = null;
      drone = null;
      noiseBuf = null;
    },
  };
}
