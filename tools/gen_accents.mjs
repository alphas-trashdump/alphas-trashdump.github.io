#!/usr/bin/env node
/* Generates assets/css/accents.css: one M3 accent per [data-accent] value.
   Chromatic roles only - neutrals/surfaces live in theme.css and never move.
   usage: node gen_accents.mjs > ../assets/css/accents.css  */
import { writeFileSync } from "node:fs";

/* --- OKLCH helpers (same maths as the original palette script) --- */
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const to255 = (v) => Math.round(Math.max(0, Math.min(1, linToSrgb(Math.max(0, Math.min(1, v))))) * 255);
function oklab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = srgbToLin(((n >> 16) & 255) / 255), g = srgbToLin(((n >> 8) & 255) / 255), b = srgbToLin((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function labToRgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [to255(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
          to255(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
          to255(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
const inGamut = ([r, g, b]) => [r, g, b].every((v) => v >= 0 && v <= 255);
const hexOf = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

const ANCHORS = [[0, "#000000"], [4, "#0e0e0f"], [6, "#141416"], [8, "#18181a"], [10, "#1d1d20"],
                 [12, "#202125"], [17, "#2a2b2e"], [20, "#313236"], [22, "#353639"], [24, "#3d3e42"],
                 [30, "#494b50"], [35, "#54575c"], [40, "#5e6166"], [50, "#73767b"], [52, "#767a7f"],
                 [60, "#878a8f"], [62, "#8d9095"], [70, "#a1a4a9"], [80, "#c3c4c8"], [82, "#c9cacd"],
                 [87, "#dadade"], [90, "#e2e2e6"], [92, "#ebebee"], [94, "#f1f1f4"], [96, "#f7f7f9"],
                 [98, "#fcfcfe"], [100, "#ffffff"]];
function neutralRgb(t) {
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  if (t <= 0) return hex(ANCHORS[0][1]);
  if (t >= 100) return hex(ANCHORS.at(-1)[1]);
  for (let i = 1; i < ANCHORS.length; i++) {
    const [t1, c1] = ANCHORS[i], [t0, c0] = ANCHORS[i - 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0), a = hex(c0), b = hex(c1);
      return a.map((v, n) => v + (b[n] - v) * k);
    }
  }
}
const hueOf = (h) => { const [, a, b] = oklab(h); return (Math.atan2(b, a) * 180) / Math.PI; };
const chromaOf = (h) => { const [, a, b] = oklab(h); return Math.hypot(a, b); };

function palette(hue, peak) {
  const rad = (hue * Math.PI) / 180;
  return (t) => {
    const L = oklab(hexOf(neutralRgb(t)))[0];
    const env = t <= 50 ? peak * (t / 50) : peak * ((100 - t) / 50);
    const at = (c) => labToRgb(L, Math.cos(rad) * c, Math.sin(rad) * c);
    if (inGamut(at(env))) return hexOf(at(env));
    let lo = 0, hi = env, best = at(0);
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(at(mid))) { lo = mid; best = at(mid); } else hi = mid;
    }
    return hexOf(best);
  };
}

/* --- the accents the site offers --- */
const ACCENTS = [
  { id: "orange", label: "Orange", seed: "#e65100" },
  { id: "purple", label: "Purple", seed: "#7b4dd8" },
  { id: "blue", label: "Blue", seed: "#1565d8" },
  { id: "green", label: "Green", seed: "#3c7c34" },
];

const roles = (P, S, T) => ({
  primary: P(40), "on-primary": "#ffffff", "primary-container": P(90), "on-primary-container": P(10),
  "primary-fixed": P(90), "primary-fixed-dim": P(80), "on-primary-fixed": P(10), "on-primary-fixed-variant": P(30),
  secondary: S(40), "on-secondary": "#ffffff", "secondary-container": S(90), "on-secondary-container": S(10),
  "secondary-fixed": S(90), "secondary-fixed-dim": S(80), "on-secondary-fixed": S(10), "on-secondary-fixed-variant": S(30),
  tertiary: T(40), "on-tertiary": "#ffffff", "tertiary-container": T(90), "on-tertiary-container": T(10),
  "tertiary-fixed": T(90), "tertiary-fixed-dim": T(80), "on-tertiary-fixed": T(10), "on-tertiary-fixed-variant": T(30),
});
/* Material You derives five tonal palettes from one seed, with these relative
   chroma values: primary 48, secondary 16, tertiary 24, neutral 4, neutral
   variant 8. Surfaces come from neutral / neutral variant, which is why the
   greys pick up a faint hue cast when you change accent on Android. */
const RATIO = { primary: 1, secondary: 0.333, tertiary: 0.5, neutral: 0.083, nv: 0.167 };

/* roles Material You tints with the seed - everything else is achromatic */
const surfaceRoles = (N, NV, dark) => dark
  ? {
    background: N(6), "on-background": N(90), surface: N(6), "on-surface": N(90),
    "surface-dim": N(6), "surface-bright": N(24),
    "surface-container-lowest": N(4), "surface-container-low": N(10), "surface-container": N(12),
    "surface-container-high": N(17), "surface-container-highest": NV(24),
    outline: NV(60), "outline-variant": NV(28), "on-surface-variant": NV(80),
    "inverse-surface": N(90), "inverse-on-surface": N(20),
  }
  : {
    background: N(98), "on-background": N(10), surface: N(98), "on-surface": N(10),
    "surface-dim": N(87), "surface-bright": N(98),
    "surface-container-lowest": N(100), "surface-container-low": N(96), "surface-container": N(94),
    "surface-container-high": N(92), "surface-container-highest": NV(90),
    outline: NV(60), "outline-variant": NV(80), "on-surface-variant": NV(30),
    "inverse-surface": N(20), "inverse-on-surface": N(95),
  };

const darkRoles = (P, S, T) => ({
  primary: P(80), "on-primary": P(20), "primary-container": P(30), "on-primary-container": P(90),
  "primary-fixed": P(90), "primary-fixed-dim": P(80), "on-primary-fixed": P(10), "on-primary-fixed-variant": P(30),
  secondary: S(80), "on-secondary": S(20), "secondary-container": S(30), "on-secondary-container": S(90),
  "secondary-fixed": S(90), "secondary-fixed-dim": S(80), "on-secondary-fixed": S(10), "on-secondary-fixed-variant": S(30),
  tertiary: T(80), "on-tertiary": T(20), "tertiary-container": T(30), "on-tertiary-container": T(90),
  "tertiary-fixed": T(90), "tertiary-fixed-dim": T(80), "on-tertiary-fixed": T(10), "on-tertiary-fixed-variant": T(30),
});

let out = `/* ------------------------------------------------------------------
   Accent palettes - generated by tools/gen_accents.mjs, do not hand-edit.
   One [data-accent] value per scheme. Carries the accent's Primary /
   Secondary / Tertiary roles *and* the Neutral / Neutral-variant roles that
   Material You derives from the same seed, so switching accent tints the
   surfaces the way it does on Android. theme.css holds the default accent,
   plus the achromatic roles (error, shadow, scrim) and the shape, type,
   motion and elevation scales.
   ------------------------------------------------------------------ */
`;
for (const a of ACCENTS) {
  const h = hueOf(a.seed), c = chromaOf(a.seed);
  const P1 = palette(h, c * RATIO.primary);
  const S1 = palette(h, c * RATIO.secondary);
  const T1 = palette(h + 58, c * RATIO.tertiary);
  const N = palette(h, c * RATIO.neutral);
  const NV = palette(h, c * RATIO.nv);
  const dark = { ...darkRoles(P1, S1, T1), ...surfaceRoles(N, NV, true) };
  const light = { ...roles(P1, S1, T1), ...surfaceRoles(N, NV, false) };
  out += `\n/* ${a.label} (seed ${a.seed}) */\n`;
  out += `:root[data-accent="${a.id}"] {\n`;
  for (const [k, v] of Object.entries(dark)) out += `  --md-sys-color-${k}: ${v};\n`;
  out += `}\n\n:root[data-accent="${a.id}"][data-theme="light"] {\n`;
  for (const [k, v] of Object.entries(light)) out += `  --md-sys-color-${k}: ${v};\n`;
  out += `}\n`;
}
process.stdout.write(out);