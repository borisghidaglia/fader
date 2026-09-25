// Synthesizes the video's sound effects into public/sfx, so every sound is ours to publish.
// Run with `pnpm sfx`. Seeded, so it writes the same files every time.

import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

const RATE = 48_000
const OUT = path.join(import.meta.dirname, "..", "public", "sfx")
const TAU = 2 * Math.PI

type Stereo = { left: Float32Array; right: Float32Array }

// --- Building blocks ---

function stereo(seconds: number): Stereo {
  const length = Math.ceil(seconds * RATE)
  return { left: new Float32Array(length), right: new Float32Array(length) }
}

/** A mono signal, sample by sample, from its time in seconds. It fades out over its last 10 ms, so it never ends on a click. */
function mono(seconds: number, sample: (t: number) => number): Float32Array {
  const out = new Float32Array(Math.ceil(seconds * RATE))
  const fade = 0.01 * RATE
  for (let i = 0; i < out.length; i++) out[i] = sample(i / RATE) * Math.min(1, (out.length - 1 - i) / fade)
  return out
}

/** Adds `source` into `into` at `at` seconds, panned from -1 (left) to 1 (right), equal power. */
function place(into: Stereo, source: Float32Array, at = 0, gain = 1, pan: number | ((t: number) => number) = 0) {
  const offset = Math.round(at * RATE)
  for (let i = 0; i < source.length && offset + i < into.left.length; i++) {
    const p = typeof pan === "number" ? pan : pan(i / RATE)
    const angle = ((p + 1) * Math.PI) / 4
    into.left[offset + i] += source[i] * gain * Math.cos(angle)
    into.right[offset + i] += source[i] * gain * Math.sin(angle)
  }
  return into
}

/** Deterministic noise, so the files don't change between runs. */
function noise(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
  }
}

/** An RBJ biquad whose frequency can move while it runs. */
function filter(kind: "lowpass" | "highpass" | "bandpass", q = 0.707) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  return (x: number, freq: number) => {
    const w = (TAU * Math.min(freq, RATE * 0.45)) / RATE
    const cos = Math.cos(w)
    const alpha = Math.sin(w) / (2 * q)
    const [b0, b1, b2] =
      kind === "lowpass"
        ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
        : kind === "highpass"
          ? [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
          : [alpha, 0, -alpha]
    const [a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha]
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    return y
  }
}

/** A sine whose pitch can glide, integrated so the glide stays smooth. */
function oscillator() {
  let phase = 0
  return (freq: number) => {
    phase += (TAU * freq) / RATE
    return Math.sin(phase)
  }
}

const decay = (t: number, tau: number) => Math.exp(-t / tau)
/** Rises over `attack` seconds, so a sound never starts with a click. */
const rise = (t: number, attack: number) => Math.min(1, t / attack)
const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2)

// --- The sounds ---

/** A post appearing: a small glassy ping. */
function tick(freq: number, seed: number) {
  const hiss = noise(seed)
  const air = filter("highpass", 0.7)
  return mono(0.07, (t) => {
    const ping = Math.sin(TAU * freq * t) * decay(t, 0.007) + 0.22 * Math.sin(TAU * freq * 2.41 * t) * decay(t, 0.003)
    const transient = 0.4 * air(hiss(), 3500) * decay(t, 0.0008)
    return (ping + transient) * rise(t, 0.0004)
  })
}

/** A fader passing a bar: a dry notch. */
function detent(freq: number, seed: number) {
  const hiss = noise(seed)
  const band = filter("bandpass", 2.5)
  return mono(0.05, (t) => {
    const notch = band(hiss(), 2800) * 2.2 * decay(t, 0.0016)
    const body = 0.35 * Math.sin(TAU * freq * t) * decay(t, 0.004) + 0.15 * Math.sin(TAU * 190 * t) * decay(t, 0.01)
    return (notch + body) * rise(t, 0.0003)
  })
}

/** A button or cursor press. */
function click(seed: number) {
  const hiss = noise(seed)
  const band = filter("bandpass", 1.4)
  const body = oscillator()
  return mono(0.09, (t) => {
    const snap = band(hiss(), 3200) * 2 * decay(t, 0.0013)
    const tone = 0.45 * Math.sin(TAU * 1500 * t) * decay(t, 0.005)
    const thock = 0.35 * body(240 - 60 * Math.min(1, t / 0.03)) * decay(t, 0.015)
    return (snap + tone + thock) * rise(t, 0.0003)
  })
}

/** A switch turning on: its click, then a little rising blip. */
function toggle() {
  const out = stereo(0.2)
  place(out, click(41), 0, 0.9)
  const blip = oscillator()
  place(out, mono(0.14, (t) => blip(720 * 1.5 ** Math.min(1, t / 0.04)) * rise(t, 0.004) * decay(t, 0.045)), 0.022, 0.45)
  return out
}

/** Something arriving on screen: a soft drop in pitch. */
function pop() {
  const tone = oscillator()
  return mono(0.18, (t) => tone(260 + 260 * decay(t, 0.025)) * rise(t, 0.003) * decay(t, 0.045))
}

/** Air moving past, panned from left to right along with what flies. */
function whoosh(seconds: number, seed: number) {
  const hissL = noise(seed)
  const body = filter("bandpass", 0.8)
  const air = filter("bandpass", 1.6)
  const soften = filter("lowpass", 0.7)
  const sound = mono(seconds, (t) => {
    const u = t / seconds
    const swell = Math.sin(Math.PI * u) ** 1.2
    const n = soften(hissL(), 7000)
    const center = 500 + 1900 * swell
    return (body(n, center) + 0.35 * air(n, center * 2.2)) * Math.sin(Math.PI * u) ** 2 * 3
  })
  return place(stereo(seconds), sound, 0, 1, (t) => -0.8 + 1.6 * easeInOut(t / seconds))
}

/** Landing in your feed, on the right. */
function land(seed: number) {
  const hiss = noise(seed)
  const soften = filter("lowpass", 0.7)
  const tone = oscillator()
  const sound = mono(0.2, (t) => {
    const thud = tone(105 + 85 * decay(t, 0.02)) * decay(t, 0.035)
    const tap = 0.4 * soften(hiss(), 1800) * decay(t, 0.003)
    return (thud + tap) * rise(t, 0.001)
  })
  return place(stereo(0.2), sound, 0, 1, 0.35)
}

/** A gap where a post should be: two soft notes going down. */
function missing() {
  const out = stereo(0.5)
  const note = (freq: number, length: number) => {
    const soften = filter("lowpass", 0.7)
    return mono(length, (t) => {
      const tone = Math.sin(TAU * freq * t) + 0.08 * Math.sin(TAU * 2 * freq * t) + 0.16 * Math.sin(TAU * 3 * freq * t)
      return soften(tone, 1600) * rise(t, 0.008) * decay(t, 0.07)
    })
  }
  place(out, note(392, 0.22), 0, 1, 0.35)
  place(out, note(311.13, 0.32), 0.11, 1, 0.35)
  return out
}

/** A bell, from its partials: [ratio to the note, level, decay in seconds]. */
function bell(freq: number, seconds: number, partials: [number, number, number][]) {
  return mono(seconds, (t) => {
    let sum = 0
    for (const [ratio, level, tau] of partials) sum += level * Math.sin(TAU * freq * ratio * t) * decay(t, tau)
    return sum * rise(t, 0.002)
  })
}

/** X's blue pill showing up: a bright two-note chime. */
function notify() {
  const partials: [number, number, number][] = [
    [1, 1, 0.35],
    [2, 0.28, 0.18],
    [3.01, 0.1, 0.1],
    [4.2, 0.05, 0.05],
  ]
  const out = stereo(1.3)
  place(out, bell(1046.5, 1.2, partials), 0, 0.8, 0.25)
  place(out, bell(1568, 1.2, partials), 0.075, 0.8, 0.25)
  return out
}

/** Bars sorting themselves: a quick shuffle of dry clicks over a soft swish. */
function shuffle() {
  const seconds = 1.3
  const out = stereo(seconds)
  const r = noise(31)
  let placed = 0
  while (placed < 90) {
    const u = (r() + 1) / 2
    if ((r() + 1) / 2 > Math.sin(Math.PI * u)) continue
    place(out, detent(1400 + 900 * (r() + 1), 200 + placed), u * (seconds - 0.06), 0.25 + 0.35 * ((r() + 1) / 2), 0.6 * r())
    placed++
  }
  const hiss = noise(32)
  const band = filter("bandpass", 0.6)
  place(out, mono(seconds, (t) => band(hiss(), 1600) * Math.sin((Math.PI * t) / seconds) ** 1.5 * 0.5), 0, 1, 0)
  return out
}

// --- Writing ---

function normalized(sound: Stereo | Float32Array, peak = 0.89): Stereo {
  const s = sound instanceof Float32Array ? place(stereo(sound.length / RATE), sound) : sound
  let max = 0
  for (const channel of [s.left, s.right]) for (const v of channel) max = Math.max(max, Math.abs(v))
  for (const channel of [s.left, s.right]) for (let i = 0; i < channel.length; i++) channel[i] = (channel[i] / max) * peak
  return s
}

function wav({ left, right }: Stereo): Buffer {
  const data = Buffer.alloc(left.length * 4)
  for (let i = 0; i < left.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), i * 4)
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), i * 4 + 2)
  }
  const header = Buffer.alloc(44)
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write("WAVEfmt ", 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(2, 22) // stereo
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 4, 28)
  header.writeUInt16LE(4, 32)
  header.writeUInt16LE(16, 34)
  header.write("data", 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

const sounds: Record<string, Stereo | Float32Array> = {
  ...Object.fromEntries([1320, 1480, 1660, 1760].map((f, i) => [`tick-${i}`, place(stereo(0.07), tick(f, i + 1), 0, 1, -0.25)])),
  ...Object.fromEntries([1050, 1100, 1160].map((f, i) => [`detent-${i}`, detent(f, i + 11)])),
  click: click(40),
  toggle: toggle(),
  pop: pop(),
  whoosh: whoosh(0.75, 51),
  "whoosh-short": whoosh(0.5, 52),
  land: land(61),
  missing: missing(),
  notify: notify(),
  shuffle: shuffle(),
}

mkdirSync(OUT, { recursive: true })
const lengths: Record<string, number> = {}
for (const [name, sound] of Object.entries(sounds)) {
  const s = normalized(sound)
  writeFileSync(path.join(OUT, `${name}.wav`), wav(s))
  lengths[name] = s.left.length / RATE
}
// How long each one plays, for the video's timeline.
writeFileSync(path.join(OUT, "lengths.json"), `${JSON.stringify(lengths, null, 2)}\n`)
console.log(`Wrote ${Object.keys(sounds).length} sounds to ${path.relative(process.cwd(), OUT)}`)
