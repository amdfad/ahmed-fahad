// Shared helpers for the etched SVG illustrations.
// Everything is generated, never hand-drawn, so the look stays consistent
// and every build of the page produces identical output (seeded RNG).

export const INK = "#141414";
export const PAPER = "#f5f3ee";
export const BLUE = "#2f4bff";
export const MUTED = "#6d6a62";
export const GOLD = "#c49a3e";

/** Deterministic RNG so the same seed always yields the same drawing. */
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(next.range(lo, hi + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}

/** Round to 2 decimals so the SVG stays compact. */
export const n = (v) => Number(v.toFixed(2));

/** Attribute string from an object, skipping null/undefined. */
export function attrs(o) {
  return Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${typeof v === "number" ? n(v) : v}"`)
    .join(" ");
}

export const el = (tag, o = {}, inner) =>
  inner === undefined
    ? `<${tag} ${attrs(o)}/>`
    : `<${tag} ${attrs(o)}>${inner}</${tag}>`;

export const pts = (list) => list.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");

/** Hatching pattern: parallel lines at an angle. Tonal scale is
 *  paper → hatch → dense hatch → cross-hatch → solid ink. */
export function hatch(id, { gap = 5.5, angle = 38, width = 0.75, cross = false, color = INK } = {}) {
  const v = el("line", { x1: 0, y1: 0, x2: 0, y2: gap, stroke: color, "stroke-width": width });
  const h = cross
    ? el("line", { x1: 0, y1: 0, x2: gap, y2: 0, stroke: color, "stroke-width": width * 0.7 })
    : "";
  return el(
    "pattern",
    { id, width: gap, height: gap, patternUnits: "userSpaceOnUse", patternTransform: `rotate(${angle})` },
    v + h,
  );
}

/** Spline easing used for every ambient loop (same curve as the reference). */
export const EASE = "0.45 0 0.55 1";
export const splines = (count) => Array(count).fill(EASE).join(";");

/** A gentle up/down bob. */
export function bob(dy, dur, begin = 0) {
  return el("animateTransform", {
    attributeName: "transform",
    type: "translate",
    values: `0 0;0 ${dy};0 0`,
    keyTimes: "0;0.5;1",
    calcMode: "spline",
    keySplines: splines(2),
    dur: `${dur}s`,
    begin: `${begin}s`,
    repeatCount: "indefinite",
  });
}

/** Sinusoidal wave from x0 to x1 using quadratic + smooth-continuation segments. */
export function wave(x0, x1, y, amp, wl) {
  const half = wl / 2;
  const count = Math.max(1, Math.floor((x1 - x0) / half));
  let d = `M${n(x0)} ${n(y)}q${n(half / 2)} ${n(-amp * 2)} ${n(half)} 0`;
  for (let i = 1; i < count; i++) d += `t${n(half)} 0`;
  return d;
}
