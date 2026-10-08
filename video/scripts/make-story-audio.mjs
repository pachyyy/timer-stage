// Synthesises the Instagram story's soundtrack into public/story/*.wav — an original 120 BPM
// music bed plus the UI sound effects — so the story needs no downloaded or licensed audio.
// Deterministic (seeded noise): re-running it produces byte-identical files.
//   node scripts/make-story-audio.mjs
//
// 120 BPM at 30 fps is one beat every 15 frames, so src/scenes/Story.tsx times its cuts, clicks
// and colour changes on multiples of 15 and they land on the kick. Keep BPM and the arrangement's
// landmarks (DROP_AT, IMPACT_AT) in step with the scene lengths there.
import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;
const DURATION = 20;
/** Drums come in with the first cut (frame 60). */
const DROP_AT = 2;
/** The end card lands here (frame 525): drums stop on one big hit and the chord rings out. */
const IMPACT_AT = 17.5;
const OUT_DIR = "public/story";

// --- Plumbing -------------------------------------------------------------------------------------

let seed = 0x2f6e2b1;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
};

const stereo = (sec) => {
  const n = Math.ceil(sec * SR);
  return [new Float32Array(n), new Float32Array(n)];
};

/** Mixes a mono sound into a stereo buffer at `at` seconds, equal-power panned (-1 left … 1 right). */
function mix(target, at, sound, gain = 1, pan = 0) {
  const start = Math.round(at * SR);
  const angle = ((pan + 1) * Math.PI) / 4;
  const [l, r] = [gain * Math.cos(angle), gain * Math.sin(angle)];
  for (let i = 0; i < sound.length; i++) {
    const j = start + i;
    if (j < 0 || j >= target[0].length) continue;
    target[0][j] += sound[i] * l;
    target[1][j] += sound[i] * r;
  }
}

const render = (sec, fn) => {
  const out = new Float32Array(Math.ceil(sec * SR));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / SR, i);
  return out;
};

const onePoleCoef = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / SR);

function lowpass(sound, hz) {
  const out = new Float32Array(sound.length);
  let y = 0;
  for (let i = 0; i < sound.length; i++) {
    const a = onePoleCoef(typeof hz === "function" ? hz(i / SR) : hz);
    y += a * (sound[i] - y);
    out[i] = y;
  }
  return out;
}

const highpass = (sound, hz) => {
  const low = lowpass(sound, hz);
  return sound.map((x, i) => x - low[i]);
};

/** Peak-normalises to -1 dBFS and writes 16-bit stereo PCM. */
function writeWav(name, [l, r], fadeOut = 0.01) {
  const n = l.length;
  const fade = Math.round(fadeOut * SR);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    l[n - 1 - i] *= g;
    r[n - 1 - i] *= g;
  }
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
  const gain = 0.891 / peak;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i] * gain)) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i] * gain)) * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(2, 22); // channels
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(`${OUT_DIR}/${name}.wav`, Buffer.concat([header, data]));
  console.log(`  ${OUT_DIR}/${name}.wav  ${(n / SR).toFixed(2)}s`);
}

const monoToStereo = (sound) => [sound, Float32Array.from(sound)];

// --- Instruments ----------------------------------------------------------------------------------

function kick(punch = 1) {
  let phase = 0;
  return render(0.45, (t) => {
    phase += (2 * Math.PI * (44 + 120 * Math.exp(-t * 32))) / SR;
    const body = Math.sin(phase) * Math.exp(-t * (8 / punch));
    const click = t < 0.003 ? noise() * 0.4 : 0;
    return body + click;
  });
}

function snare() {
  const hiss = highpass(render(0.25, () => noise()), 1800);
  return render(0.25, (t, i) => hiss[i] * Math.exp(-t * 20) * 0.7 + Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 32) * 0.45);
}

function hat(decay = 85) {
  const hiss = highpass(highpass(render(0.08, () => noise()), 6000), 6000);
  return render(0.08, (t, i) => hiss[i] * Math.exp(-t * decay));
}

const saw = (freq, t) => 2 * ((freq * t) % 1) - 1;

function bass(freq, dur) {
  const raw = render(dur + 0.05, (t) => {
    const env = Math.min(1, t / 0.004) * (t < dur ? Math.exp(-t * 3) : Math.exp(-dur * 3) * Math.exp(-(t - dur) * 60));
    return (saw(freq, t) * 0.6 + Math.sin(2 * Math.PI * freq * t) * 0.8) * env;
  });
  return lowpass(raw, (t) => 220 + 900 * Math.exp(-t * 18));
}

/** Karplus–Strong plucked string. */
function pluck(freq, sec = 0.7, brightness = 0.5) {
  const period = Math.max(2, Math.round(SR / freq));
  const line = Float32Array.from({ length: period }, () => noise());
  const out = new Float32Array(Math.ceil(sec * SR));
  let prev = 0;
  for (let i = 0; i < out.length; i++) {
    const k = i % period;
    const value = line[k];
    out[i] = value;
    line[k] = (brightness * value + (1 - brightness) * prev) * 0.996;
    prev = value;
  }
  return lowpass(out, 5000);
}

function pad(freqs, dur, release = 0.6) {
  const raw = render(dur + release, (t) => {
    const env = Math.min(1, t / 0.25) * (t < dur ? 1 : Math.exp(-(t - dur) * (4 / release)));
    let v = 0;
    for (const f of freqs) v += saw(f * 0.997, t) + saw(f * 1.004, t + 0.13);
    return (v / (2 * freqs.length)) * env;
  });
  return lowpass(raw, 1100);
}

/** Small Schroeder reverb — four combs into two allpasses — with different lengths per side. */
function reverb([l, r], wet = 0.25) {
  const tank = (input, combs) => {
    const out = new Float32Array(input.length);
    for (const len of combs) {
      const buf = new Float32Array(len);
      for (let i = 0; i < input.length; i++) {
        const y = buf[i % len];
        buf[i % len] = input[i] + y * 0.78;
        out[i] += y / combs.length;
      }
    }
    for (const len of [225, 556]) {
      const buf = new Float32Array(len);
      for (let i = 0; i < out.length; i++) {
        const delayed = buf[i % len];
        const x = out[i];
        buf[i % len] = x + delayed * 0.5;
        out[i] = delayed - x * 0.5;
      }
    }
    return out;
  };
  const wl = tank(l, [1557, 1617, 1491, 1422]);
  const wr = tank(r, [1580, 1640, 1514, 1445]);
  return [l.map((x, i) => x + wl[i] * wet), r.map((x, i) => x + wr[i] * wet)];
}

// --- Music bed ------------------------------------------------------------------------------------

const NOTE = { G1: 49, A1: 55, F1: 43.65, C2: 65.41, F3: 174.61, G3: 196, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392 };
// Am – F – C – G, one chord per bar.
const CHORDS = [
  { root: NOTE.A1, tones: [NOTE.A3, NOTE.C4, NOTE.E4] },
  { root: NOTE.F1, tones: [NOTE.F3, NOTE.A3, NOTE.C4] },
  { root: NOTE.C2, tones: [NOTE.C4, NOTE.E4, NOTE.G4] },
  { root: NOTE.G1, tones: [NOTE.G3, NOTE.B3, NOTE.D4] },
];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];

function musicBed() {
  const drums = stereo(DURATION);
  const tonal = stereo(DURATION);
  const kickSound = kick();
  const snareSound = snare();
  const hatSound = hat();

  for (let bar = 0; bar * BAR < IMPACT_AT; bar++) {
    const barAt = bar * BAR;
    const chord = CHORDS[bar % CHORDS.length];
    const intro = barAt < DROP_AT;

    mix(tonal, barAt, pad(chord.tones, Math.min(BAR, IMPACT_AT - barAt)), intro ? 0.5 : 0.32);

    for (let step = 0; step < 8; step++) {
      const at = barAt + (step * BEAT) / 2;
      if (at >= IMPACT_AT) break;
      const tone = chord.tones[ARP[step]] * 2;
      mix(tonal, at, pluck(tone, 0.6), intro ? 0.22 : 0.17, step % 2 ? 0.45 : -0.45);
      if (intro) continue;
      mix(tonal, at, bass(step % 2 ? chord.root * 2 : chord.root, BEAT / 2 - 0.03), 0.5);
      if (step % 2) mix(drums, at, hatSound, 0.22, 0.3);
    }
  }

  for (let beat = DROP_AT / BEAT; beat * BEAT < IMPACT_AT; beat++) {
    const at = beat * BEAT;
    mix(drums, at, kickSound, 0.95);
    if (beat % 2 === 1) mix(drums, at, snareSound, 0.42, -0.1);
  }

  // Riser into the drop, and a shorter one into the end card.
  for (const [from, to] of [[DROP_AT - 1.5, DROP_AT], [IMPACT_AT - 1, IMPACT_AT]]) {
    const len = to - from;
    const swell = lowpass(render(len, () => noise()), (t) => 300 + 7000 * (t / len) ** 2);
    mix(drums, from, swell.map((x, i) => x * ((i / SR / len) ** 2) * 0.55), 1);
  }

  // The end-card hit: a heavy kick, a low boom, a crash, and the home chord left to ring out.
  mix(drums, IMPACT_AT, kick(2.2), 1.1);
  mix(drums, IMPACT_AT, render(2, (t) => Math.sin(2 * Math.PI * 41 * t) * Math.exp(-t * 2.2)), 0.6);
  mix(drums, IMPACT_AT, highpass(render(2, (t) => noise() * Math.exp(-t * 2.6)), 3500), 0.3);
  const home = CHORDS[0];
  mix(tonal, IMPACT_AT, pad(home.tones, DURATION - IMPACT_AT - 0.6, 0.6), 0.45);
  home.tones.forEach((tone, i) => mix(tonal, IMPACT_AT + i * 0.06, pluck(tone * 2, 2.5, 0.7), 0.28, i - 1));
  mix(tonal, IMPACT_AT, bass(home.root, 1.6), 0.5);

  const wet = reverb(tonal, 0.35);
  return [wet[0].map((x, i) => x + drums[0][i]), wet[1].map((x, i) => x + drums[1][i])];
}

// --- Sound effects --------------------------------------------------------------------------------

const click = () =>
  render(0.06, (t) => noise() * Math.exp(-t * 420) * 0.6 + Math.sin(2 * Math.PI * 3200 * t) * Math.exp(-t * 260) * 0.5 + Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t * 120) * 0.35);

const tap = () => render(0.08, (t) => Math.sin(2 * Math.PI * 1400 * t) * Math.exp(-t * 85) + noise() * Math.exp(-t * 650) * 0.3);

const key = () => {
  const hiss = highpass(render(0.035, () => noise()), 3000);
  return render(0.035, (t, i) => hiss[i] * Math.exp(-t * 480) * 0.7 + Math.sin(2 * Math.PI * 2300 * t) * Math.exp(-t * 320) * 0.25);
};

/** Slide-transition whoosh, panned right → left with the incoming scene. */
function whoosh() {
  const len = 0.55;
  const band = (cut) => highpass(lowpass(render(len, () => noise()), cut), (t) => cut(t) * 0.35);
  const sound = band((t) => 400 + 3800 * Math.sin(Math.PI * Math.min(1, t / len)));
  const env = sound.map((x, i) => x * Math.sin(Math.PI * Math.min(1, i / SR / len)) ** 2);
  const out = stereo(len);
  for (let i = 0; i < env.length; i++) {
    const pan = 0.7 - 1.4 * (i / env.length);
    const angle = ((pan + 1) * Math.PI) / 4;
    out[0][i] = env[i] * Math.cos(angle);
    out[1][i] = env[i] * Math.sin(angle);
  }
  return out;
}

const bell = (freq, sec, decay) =>
  render(sec, (t) => (Math.sin(2 * Math.PI * freq * t) + 0.35 * Math.sin(2 * Math.PI * freq * 2.01 * t) * Math.exp(-t * 6)) * Math.min(1, t / 0.002) * Math.exp(-t * decay));

/** "Every screen just updated" — a bright two-partial ping. */
const sync = () => {
  const a = bell(1318.5, 0.7, 7);
  const b = bell(1975.5, 0.7, 9);
  return a.map((x, i) => x + 0.5 * b[i]);
};

/** Joined the room — a rising two-note chime. */
function success() {
  const out = stereo(0.9);
  mix(out, 0, bell(1046.5, 0.8, 6), 0.8, -0.2);
  mix(out, 0.09, bell(1568, 0.8, 5), 0.8, 0.2);
  return out;
}

/** Wrap-up — a soft amber chime. */
function warn() {
  const out = stereo(1.1);
  mix(out, 0, bell(880, 1.1, 4), 0.8);
  mix(out, 0, bell(1318.5, 1.1, 5), 0.4);
  return out;
}

/** Overtime — two short square-ish beeps. */
function alert() {
  const beep = render(0.13, (t) => {
    const f = 620;
    const env = Math.min(1, t / 0.004) * Math.min(1, (0.13 - t) / 0.01);
    return (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * 3 * f * t) / 3 + Math.sin(2 * Math.PI * 5 * f * t) / 5) * env;
  });
  const out = stereo(0.4);
  mix(out, 0, beep);
  mix(out, 0.2, beep);
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
console.log("Writing story audio:");
writeWav("music", musicBed(), 0.4);
writeWav("click", monoToStereo(click()));
writeWav("tap", monoToStereo(tap()));
writeWav("key", monoToStereo(key()));
writeWav("whoosh", whoosh());
writeWav("sync", monoToStereo(sync()), 0.05);
writeWav("success", success(), 0.05);
writeWav("warn", warn(), 0.1);
writeWav("alert", alert());
