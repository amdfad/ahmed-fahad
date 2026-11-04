// Hero: "the GTM coast". Rocky islands in a calm sea, each one a channel.
//   - Outbound Post (cold email): 5 domains × 3 inbox mailboxes on the facade
//   - Radio tower (LinkedIn): pulsing blue signal
//   - Billboard of phone screens (paid social / UGC): variants take turns winning
//   - Trade-show pavilion (events) with a pier and one lonely reply mailbox
// Envelopes arc out of the post office. Most splash into the sea; one in a
// while reaches the mailbox and its flag goes up. Pigeons coo when clicked.

import { INK, PAPER, BLUE, MUTED, GOLD, rng, n, el, pts, hatch, bob, splines, wave, EASE } from "./lib.mjs";

const W = 1200;
const H = 620;
const SEA = 470;

export function hero() {
  const r = rng(20261104);
  const parts = [];
  const add = (s) => parts.push(s);

  // ---------- defs ----------
  add(
    el(
      "defs",
      {},
      [
        hatch("hero-h", { gap: 5.5, angle: 38 }),
        hatch("hero-x", { gap: 5.5, angle: 38, cross: true }),
        hatch("hero-d", { gap: 3.2, angle: 48, width: 0.7 }),
        hatch("hero-v", { gap: 4, angle: 0, width: 0.45 }),
        hatch("hero-p", { gap: 1.5, angle: 40, width: 0.35 }),
      ].join(""),
    ),
  );

  // ---------- sky ----------
  let sky = "";
  for (let i = 0; i < 120; i++) {
    const x = r.range(8, W - 8);
    const y = r.range(10, 330);
    const rad = r.range(0.45, 1.25);
    const twinkle =
      i % 11 === 0
        ? el("animate", {
            attributeName: "opacity",
            values: "1;0.15;1",
            keyTimes: "0;0.5;1",
            calcMode: "spline",
            keySplines: splines(2),
            dur: `${r.range(3, 6).toFixed(1)}s`,
            begin: `-${r.range(0, 5).toFixed(1)}s`,
            repeatCount: "indefinite",
          })
        : undefined;
    sky += el("circle", { cx: x, cy: y, r: rad, fill: INK }, twinkle);
  }
  for (let i = 0; i < 10; i++) {
    const x = r.range(20, W - 20);
    const y = r.range(20, 300);
    sky += el("path", { d: `M${n(x - 3.5)} ${n(y)}h7M${n(x)} ${n(y - 3.5)}v7`, stroke: INK, "stroke-width": 0.8 });
  }
  add(el("g", { class: "sky" }, sky));

  // clouds: overlapping circles, inner strokes erased, flat hatched underside
  const cloud = (id, cx, cy, s, drift, dur) => {
    const blobs = [
      [-44, 2, 15],
      [-22, -9, 21],
      [4, -14, 25],
      [30, -6, 19],
      [50, 3, 13],
    ];
    const base = 12;
    let lo = Infinity;
    let hi = -Infinity;
    for (const [bx, by, br] of blobs) {
      const dy = base - by;
      if (Math.abs(dy) < br) {
        const dx = Math.sqrt(br * br - dy * dy);
        lo = Math.min(lo, bx - dx);
        hi = Math.max(hi, bx + dx);
      }
    }
    const strokes = blobs.map(([x, y, rr]) => el("circle", { cx: x, cy: y, r: rr, fill: PAPER, stroke: INK, "stroke-width": 0.9 })).join("");
    const fills = blobs.map(([x, y, rr]) => el("circle", { cx: x, cy: y, r: rr - 0.9, fill: PAPER })).join("");
    const clip = el("clipPath", { id: `${id}-c` }, blobs.map(([x, y, rr]) => el("circle", { cx: x, cy: y, r: rr - 0.9 })).join(""));
    const cut = el("clipPath", { id: `${id}-b` }, el("rect", { x: -80, y: -60, width: 160, height: 60 + base }));
    const shade = el("rect", { x: -70, y: 1, width: 140, height: base - 1, fill: "url(#hero-d)", "clip-path": `url(#${id}-c)`, opacity: 0.8 });
    const bottom = el("line", { x1: lo, y1: base, x2: hi, y2: base, stroke: INK, "stroke-width": 0.9 });
    const driftAnim = el("animateTransform", {
      attributeName: "transform",
      type: "translate",
      values: `0 0;${drift} 0;0 0`,
      keyTimes: "0;0.5;1",
      calcMode: "spline",
      keySplines: splines(2),
      dur: `${dur}s`,
      repeatCount: "indefinite",
    });
    return el(
      "g",
      { transform: `translate(${cx} ${cy}) scale(${s})` },
      el("defs", {}, clip + cut) + el("g", {}, driftAnim + el("g", { "clip-path": `url(#${id}-b)` }, strokes + fills + shade) + bottom),
    );
  };
  add(cloud("cl1", 150, 118, 1.15, 14, 38));
  add(cloud("cl2", 700, 64, 0.85, -12, 46));
  add(cloud("cl3", 1010, 186, 1.0, 10, 41));

  // blue birds, bobbing
  let birds = "";
  const birdSpots = [
    [86, 230], [104, 238], [420, 120], [436, 112], [812, 214], [828, 206], [1110, 92],
  ];
  birdSpots.forEach(([x, y], i) => {
    const d = `M${x} ${y}q3 -4 6 0q3 -4 6 0`;
    birds += el(
      "g",
      {},
      el("path", { d, fill: "none", stroke: BLUE, "stroke-width": 1.2, "stroke-linecap": "round" }) +
        bob(-2.2, 2.6 + (i % 3) * 0.6, -i * 0.5),
    );
  });
  add(el("g", { class: "birds" }, birds));

  // ---------- sea ----------
  const rowsA = [];
  const rowsB = [];
  let y = SEA + 4;
  let gap = 3.4;
  let row = 0;
  while (y < H - 5) {
    const t = (y - SEA) / (H - SEA);
    const amp = 0.55 + t * 1.1;
    const wl = 13 + t * 12;
    let d = "";
    let x = -40 - r.range(0, 40);
    while (x < W + 30) {
      const len = r.range(40, 190);
      d += wave(x, x + len, y, amp, wl);
      x += len + r.range(8, 46);
    }
    (row % 2 ? rowsB : rowsA).push(
      el("path", { d, fill: "none", stroke: INK, "stroke-width": n(0.45 + t * 0.5), "stroke-linecap": "round" }),
    );
    y += gap;
    gap *= 1.075;
    row++;
  }
  const drift = (dx, dur) =>
    el("animateTransform", {
      attributeName: "transform",
      type: "translate",
      values: `0 0;${dx} 0;0 0`,
      keyTimes: "0;0.5;1",
      calcMode: "spline",
      keySplines: splines(2),
      dur: `${dur}s`,
      repeatCount: "indefinite",
    });
  add(
    el(
      "g",
      { class: "sea" },
      el("line", { x1: 0, y1: SEA, x2: W, y2: SEA, stroke: INK, "stroke-width": 1 }) +
        el("g", {}, drift(7, 9) + rowsA.join("")) +
        el("g", {}, drift(-6, 11) + rowsB.join("")),
    ),
  );

  // ---------- islands ----------
  const island = (x0, x1, top, label) => {
    const w = x1 - x0;
    const left = [];
    const right = [];
    const steps = 4;
    const lb = x0 - r.range(8, 18);
    const rb = x1 + r.range(8, 18);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      left.push([x0 + (lb - x0) * t + r.range(-5, 5), top + (SEA - top) * t]);
      right.push([x1 + (rb - x1) * t + r.range(-5, 5), top + (SEA - top) * t]);
    }
    const outline = [[x0, top], [x1, top], ...right, [rb, SEA], [lb, SEA], ...left.slice().reverse()];
    const shadeX = x1 - w * 0.3;
    const shade = [[shadeX, top], [x1, top], ...right, [rb, SEA], [shadeX + w * 0.07, SEA]];
    let g = "";
    g += el("polygon", { points: pts(outline), fill: "url(#hero-h)" });
    g += el("polygon", { points: pts(shade), fill: "url(#hero-x)" });
    g += el("polygon", { points: pts(outline), fill: "none", stroke: INK, "stroke-width": 1.1, "stroke-linejoin": "round" });
    // ledge
    g += el("polygon", { points: pts([[x0 - 1, top], [x1 + 1, top], [x1 - 2, top + 5], [x0 + 2, top + 5]]), fill: PAPER, stroke: INK, "stroke-width": 0.8 });
    // strata strokes
    const strata = Math.max(2, Math.round(w / 60));
    for (let i = 0; i < strata; i++) {
      const sy = r.range(top + 14, SEA - 8);
      const sx = r.range(x0 + 10, x1 - 50);
      const len = r.range(16, 40);
      g += el("path", { d: `M${n(sx)} ${n(sy)}h${n(len)}M${n(sx + 4)} ${n(sy + 3)}h${n(len * 0.6)}`, stroke: INK, "stroke-width": 1 });
    }
    // foam
    for (let i = 0; i < 3; i++) {
      const fx = r.range(lb - 6, rb - 20);
      g += el("line", { x1: fx, y1: SEA + 3, x2: fx + r.range(8, 20), y2: SEA + 3, stroke: INK, "stroke-width": 0.9 });
    }
    // reflection: short heavier dashes just under the island
    let refl = "";
    for (let ry = SEA + 6; ry < SEA + 44; ry += 4) {
      const k = 1 - (ry - SEA) / 44;
      let rx = lb + r.range(0, 10);
      while (rx < rb - 6) {
        const len = r.range(5, 18) * k + 3;
        if (r() < 0.65 * k + 0.15) refl += `M${n(rx)} ${n(ry)}h${n(len)}`;
        rx += len + r.range(3, 10);
      }
    }
    g += el("path", { d: refl, stroke: INK, "stroke-width": 0.9 });
    return el("g", { class: "island", "aria-label": label }, g);
  };

  add(island(60, 420, 400, "post office island"));
  add(island(505, 635, 420, "tower island"));
  add(island(700, 895, 412, "billboard island"));
  add(island(955, 1100, 415, "pavilion island"));

  // ---------- Outbound Post (cold email) ----------
  let po = "";
  // chimney (behind the roof) + smoke
  po += el("rect", { x: 318, y: 200, width: 14, height: 48, fill: "url(#hero-d)", stroke: INK, "stroke-width": 1 });
  po += el("rect", { x: 315.5, y: 196, width: 19, height: 5, fill: PAPER, stroke: INK, "stroke-width": 1 });
  for (let i = 0; i < 3; i++) {
    po += el(
      "g",
      { opacity: 0 },
      el("path", { d: `M${322 + i * 3} 190q3 -4 0 -8t0 -8t0 -8`, fill: "none", stroke: INK, "stroke-width": 0.8 }) +
        el("animateTransform", { attributeName: "transform", type: "translate", values: "0 0;2 -14", dur: "4.2s", begin: `-${i * 1.4}s`, repeatCount: "indefinite" }) +
        el("animate", { attributeName: "opacity", values: "0;0.85;0", keyTimes: "0;0.35;1", dur: "4.2s", begin: `-${i * 1.4}s`, repeatCount: "indefinite" }),
    );
  }
  // roof plane, side wall, facade
  po += el("polygon", { points: pts([[230, 214], [256, 202], [384, 250], [358, 262]]), fill: "url(#hero-x)", stroke: INK, "stroke-width": 1 });
  po += el("polygon", { points: pts([[350, 262], [376, 250], [376, 390], [350, 400]]), fill: "url(#hero-d)", stroke: INK, "stroke-width": 1 });
  po += el("rect", { x: 110, y: 262, width: 240, height: 138, fill: PAPER, stroke: INK, "stroke-width": 1.2 });
  po += el("polygon", { points: pts([[102, 262], [230, 214], [358, 262]]), fill: PAPER, stroke: INK, "stroke-width": 1.2, "stroke-linejoin": "round" });
  po += el("polygon", { points: pts([[122, 258], [230, 222], [338, 258]]), fill: "url(#hero-h)", stroke: INK, "stroke-width": 0.7 });
  po += el("circle", { cx: 230, cy: 246, r: 7, fill: PAPER, stroke: INK, "stroke-width": 0.9 });
  po += el("path", { d: "M225.5 243.5h9v6h-9zM225.5 243.5l4.5 3.4l4.5 -3.4", fill: "none", stroke: INK, "stroke-width": 0.7 });
  po += el("rect", { x: 104, y: 262, width: 252, height: 6, fill: PAPER, stroke: INK, "stroke-width": 1 });
  po += el("rect", { x: 122, y: 274, width: 216, height: 16, fill: PAPER, stroke: INK, "stroke-width": 0.8 });
  po += el("text", { x: 230, y: 285.2, class: "illo-sign", "text-anchor": "middle" }, "OUTBOUND POST · EST. 2026");
  // pilasters
  for (const px of [114, 342]) {
    po += el("path", { d: `M${px} 292V400M${px + 4} 292V400`, stroke: INK, "stroke-width": 0.8 });
  }
  // mailbox wall: 5 domains (columns) × 3 inboxes (rows)
  const flagged = new Set([2, 9]);
  for (let c = 0; c < 5; c++) {
    for (let k = 0; k < 3; k++) {
      const x = 128 + c * 32;
      const yy = 300 + k * 26;
      const idx = c * 3 + k;
      let mb = el("rect", { class: "mb", x, y: yy, width: 26, height: 20, fill: PAPER, stroke: INK, "stroke-width": 0.9 });
      mb += el("line", { x1: x + 5, y1: yy + 6, x2: x + 21, y2: yy + 6, stroke: INK, "stroke-width": 1.1 });
      mb += el("circle", { cx: x + 20, cy: yy + 14, r: 1.1, fill: INK });
      if (flagged.has(idx)) mb += el("path", { d: `M${x + 23} ${yy + 4}V${yy - 7}h6v4h-6`, fill: BLUE, stroke: BLUE, "stroke-width": 1, "stroke-linejoin": "round" });
      po += el("g", { class: "w", "data-cx": x + 13, "data-cy": yy + 10 }, mb);
    }
    po += el("text", { x: 128 + c * 32 + 13, y: 387, class: "illo-tiny", "text-anchor": "middle" }, `d${c + 1}`);
  }
  // door
  po += el("path", { d: "M296 400V340A20 20 0 0 1 336 340V400Z", fill: INK });
  po += el("path", { d: "M290 400h52M293 396.5h46", stroke: INK, "stroke-width": 0.9 });
  // bushes
  for (const [bx, s] of [[92, 1], [398, 0.8]]) {
    po += el("path", { d: `M${bx - 12 * s} 400a${12 * s} ${11 * s} 0 0 1 ${24 * s} 0z`, fill: "url(#hero-d)", stroke: INK, "stroke-width": 0.9 });
  }
  add(el("g", { class: "post-office" }, po));

  // ---------- Radio tower (LinkedIn) ----------
  let tw = "";
  const tx = 570;
  const tTop = 252;
  const base = 420;
  const hw = (yy) => 19 * ((yy - tTop) / (base - tTop)) + 2;
  tw += el("path", { d: `M${tx} 300L522 ${base}M${tx} 300L618 ${base}`, stroke: INK, "stroke-width": 0.5, "stroke-dasharray": "2 3" });
  tw += el("path", { d: `M${tx - hw(base)} ${base}L${tx - 2} ${tTop}M${tx + hw(base)} ${base}L${tx + 2} ${tTop}`, stroke: INK, "stroke-width": 1.3 });
  const levels = [];
  for (let yy = base; yy >= tTop + 10; yy -= 24) levels.push(yy);
  let brace = "";
  levels.forEach((yy, i) => {
    brace += `M${n(tx - hw(yy))} ${yy}H${n(tx + hw(yy))}`;
    const y2 = levels[i + 1];
    if (y2) brace += `M${n(tx - hw(yy))} ${yy}L${n(tx + hw(y2))} ${y2}M${n(tx + hw(yy))} ${yy}L${n(tx - hw(y2))} ${y2}`;
  });
  tw += el("path", { d: brace, stroke: INK, "stroke-width": 0.7, fill: "none" });
  tw += el("rect", { x: tx - 7, y: tTop - 3, width: 14, height: 4, fill: PAPER, stroke: INK, "stroke-width": 1 });
  tw += el("line", { x1: tx, y1: tTop - 3, x2: tx, y2: 226, stroke: INK, "stroke-width": 1.1 });
  tw += el(
    "circle",
    { cx: tx, cy: 225, r: 2.4, fill: BLUE },
    el("animate", { attributeName: "opacity", values: "1;0.2;1", dur: "1.6s", repeatCount: "indefinite" }),
  );
  for (const side of [-1, 1]) {
    [10, 18, 26].forEach((rad, i) => {
      const a = (40 * Math.PI) / 180;
      const x1 = tx + side * rad * Math.cos(a);
      const d = `M${n(x1)} ${n(225 - rad * Math.sin(a))}A${rad} ${rad} 0 0 ${side > 0 ? 1 : 0} ${n(x1)} ${n(225 + rad * Math.sin(a))}`;
      tw += el(
        "path",
        { d, fill: "none", stroke: BLUE, "stroke-width": 1.2, "stroke-linecap": "round", opacity: 0 },
        el("animate", { attributeName: "opacity", values: "0;1;0", keyTimes: "0;0.3;1", dur: "2.4s", begin: `${i * 0.35}s`, repeatCount: "indefinite" }),
      );
    });
  }
  // hut
  tw += el("rect", { x: 598, y: 404, width: 30, height: 16, fill: PAPER, stroke: INK, "stroke-width": 1 });
  tw += el("polygon", { points: pts([[595, 404], [613, 394], [631, 404]]), fill: "url(#hero-h)", stroke: INK, "stroke-width": 1 });
  tw += el("rect", { x: 605, y: 409, width: 6, height: 11, fill: INK });
  tw += el("rect", { x: 616, y: 408, width: 7, height: 5, fill: PAPER, stroke: INK, "stroke-width": 0.7 });
  add(el("g", { class: "tower" }, tw));

  // ---------- Billboard (paid social) ----------
  let bb = "";
  bb += el("path", { d: "M745 412V368M855 412V368", stroke: INK, "stroke-width": 2.2 });
  bb += el("path", { d: "M745 400L770 368M855 400L830 368", stroke: INK, "stroke-width": 0.8 });
  bb += el("line", { x1: 712, y1: 370, x2: 888, y2: 370, stroke: INK, "stroke-width": 1.1 });
  let rail = "";
  for (let x = 716; x <= 884; x += 8) rail += `M${x} 370v-4`;
  bb += el("path", { d: rail, stroke: INK, "stroke-width": 0.6 });
  bb += el("polygon", { points: pts([[888, 296], [897, 301], [897, 369], [888, 365]]), fill: "url(#hero-d)", stroke: INK, "stroke-width": 0.9 });
  bb += el("rect", { x: 712, y: 296, width: 176, height: 69, fill: PAPER, stroke: INK, "stroke-width": 1.3 });
  bb += el("line", { x1: 712, y1: 309, x2: 888, y2: 309, stroke: INK, "stroke-width": 0.8 });
  bb += el("text", { x: 800, y: 305.6, class: "illo-sign illo-sign--sm", "text-anchor": "middle" }, "PAID SOCIAL · 30 VIDEOS / MO");
  const cycle = 10.8;
  for (let i = 0; i < 6; i++) {
    const x = 721 + i * 28.6;
    const yy = 314;
    let ph = el("rect", { x, y: yy, width: 20, height: 46, rx: 3, fill: PAPER, stroke: INK, "stroke-width": 0.9 });
    ph += el("rect", { class: "mb", x: x + 2.2, y: yy + 5, width: 15.6, height: 35, fill: "url(#hero-h)" });
    // each variant gets its turn as the "winner"
    const a = i / 6;
    const b = (i + 1) / 6;
    const win = i === 0
      ? el("animate", { attributeName: "opacity", values: "1;0", keyTimes: `0;${n(b)}`, calcMode: "discrete", dur: `${cycle}s`, repeatCount: "indefinite" })
      : el("animate", { attributeName: "opacity", values: "0;1;0", keyTimes: `0;${n(a)};${n(b)}`, calcMode: "discrete", dur: `${cycle}s`, repeatCount: "indefinite" });
    ph += el("rect", { x: x + 2.2, y: yy + 5, width: 15.6, height: 35, fill: GOLD, opacity: 0 }, win);
    ph += el("path", { d: `M${n(x + 8)} ${yy + 18}l6 4.5l-6 4.5z`, fill: PAPER, stroke: INK, "stroke-width": 0.8 });
    ph += el("line", { x1: x + 7.5, y1: yy + 2.6, x2: x + 12.5, y2: yy + 2.6, stroke: INK, "stroke-width": 0.8 });
    bb += el("g", { class: "w", "data-cx": x + 10, "data-cy": yy + 22 }, ph);
  }
  add(el("g", { class: "billboard" }, bb));

  // ---------- Pavilion (events) + pier + reply mailbox ----------
  let pv = "";
  // body with alternating panels
  pv += el("rect", { x: 978, y: 368, width: 110, height: 47, fill: PAPER, stroke: INK, "stroke-width": 1.1 });
  for (let i = 0; i < 10; i += 2) pv += el("rect", { x: 978 + i * 11, y: 368, width: 11, height: 47, fill: "url(#hero-v)" });
  pv += el("rect", { x: 1018, y: 384, width: 30, height: 31, fill: "url(#hero-x)", stroke: INK, "stroke-width": 1 });
  pv += el("rect", { x: 1013, y: 373, width: 40, height: 9, fill: PAPER, stroke: INK, "stroke-width": 0.7 });
  pv += el("text", { x: 1033, y: 380, class: "illo-sign illo-sign--xs", "text-anchor": "middle" }, "LIVE DEMO");
  // striped roof
  const apex = [1033, 322];
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const xa = 970 + (126 / segs) * i;
    const xb = 970 + (126 / segs) * (i + 1);
    pv += el("polygon", { points: pts([apex, [xa, 368], [xb, 368]]), fill: i % 2 ? PAPER : "url(#hero-h)", stroke: INK, "stroke-width": 0.8, "stroke-linejoin": "round" });
  }
  // scalloped valance
  let val = "M970 368";
  for (let x = 970; x < 1096; x += 9) val += `a4.5 4.5 0 0 0 9 0`;
  pv += el("path", { d: val, fill: PAPER, stroke: INK, "stroke-width": 0.8 });
  // flag
  pv += el("line", { x1: 1033, y1: 322, x2: 1033, y2: 298, stroke: INK, "stroke-width": 1 });
  pv += el(
    "path",
    { d: "M1033 298L1050 302L1033 307Z", fill: BLUE },
    el("animate", {
      attributeName: "d",
      values: "M1033 298L1050 302L1033 307Z;M1033 298L1048 304L1033 307Z;M1033 298L1051 301L1033 307Z;M1033 298L1050 302L1033 307Z",
      dur: "1.8s",
      repeatCount: "indefinite",
    }),
  );
  // tiny visitors (one holding the lead-capture iPad)
  const person = (x, s, ipad, dur) => {
    let p = el("circle", { cx: 0, cy: -14, r: 2.3, fill: PAPER, stroke: INK, "stroke-width": 0.8 });
    p += el("path", { d: "M0 -11.6V-5M0 -5L-2 0M0 -5L2 0M0 -9.6L-3 -6.5M0 -9.6L3 -7", stroke: INK, "stroke-width": 0.8, fill: "none", "stroke-linecap": "round" });
    if (ipad) p += el("rect", { x: 2.6, y: -9.6, width: 3.4, height: 4.4, fill: BLUE });
    return el("g", { transform: `translate(${x} 415) scale(${s})` }, el("g", {}, p + bob(-0.6, dur)));
  };
  pv += person(996, 1.1, false, 2.3) + person(1064, 1.1, true, 2.7) + person(1077, 1.05, false, 2.1);
  // pier
  pv += el("rect", { x: 1096, y: 412, width: 92, height: 5, fill: PAPER, stroke: INK, "stroke-width": 1 });
  let planks = "";
  for (let x = 1102; x < 1188; x += 6) planks += `M${x} 412v5`;
  pv += el("path", { d: planks, stroke: INK, "stroke-width": 0.5 });
  pv += el("path", { d: "M1112 417V476M1142 417V478M1172 417V476", stroke: INK, "stroke-width": 1.4 });
  // reply mailbox
  pv += el("line", { x1: 1160, y1: 412, x2: 1160, y2: 392, stroke: INK, "stroke-width": 1.6 });
  pv += el("path", { d: "M1148 392V386A12 7 0 0 1 1172 386V392Z", fill: PAPER, stroke: INK, "stroke-width": 1 });
  pv += el("path", { d: "M1151 389h10", stroke: INK, "stroke-width": 0.8 });
  add(el("g", { class: "pavilion" }, pv));

  // ---------- Envelopes: most fall in the sea, one reaches the mailbox ----------
  const envShape = el("path", { d: "M-6 -4h12v8h-12zM-6 -4l6 4.6l6 -4.6", fill: PAPER, stroke: INK, "stroke-width": 0.85, "stroke-linejoin": "round" });
  const ARRIVE = 0.8;
  const flights = [
    { d: "M250 205Q380 90 462 486", dur: 7.2, begin: -1.5, trail: true, end: [462, 486] },
    { d: "M250 205Q470 20 668 490", dur: 8.6, begin: -5.2, trail: true, end: [668, 490] },
    { d: "M250 205Q430 140 470 600", dur: 6.4, begin: -3.1, trail: false, end: [470, 600] },
    { d: "M250 205Q640 -20 928 492", dur: 9.8, begin: -7.4, trail: true, end: [928, 492] },
    { d: "M250 205Q760 -110 1160 384", dur: 11.5, begin: -2.4, trail: "blue", end: [1160, 384], success: true },
  ];
  let trails = "";
  let env = "";
  for (const f of flights) {
    const timing = { dur: `${f.dur}s`, begin: `${f.begin}s`, repeatCount: "indefinite" };
    if (f.trail) {
      trails += el("path", {
        d: f.d,
        fill: "none",
        stroke: f.trail === "blue" ? BLUE : INK,
        "stroke-width": f.trail === "blue" ? 1.1 : 0.8,
        "stroke-dasharray": f.trail === "blue" ? "4 4" : "3 4",
        opacity: f.trail === "blue" ? 0.9 : 0.5,
      });
    }
    env += el(
      "g",
      { opacity: 0 },
      envShape +
        el("animateMotion", { path: f.d, keyPoints: "0;1;1", keyTimes: `0;${ARRIVE};1`, calcMode: "linear", rotate: "auto", ...timing }) +
        el("animate", { attributeName: "opacity", values: "0;1;1;0;0", keyTimes: `0;0.04;${ARRIVE};${ARRIVE + 0.01};1`, ...timing }),
    );
    const [ex, ey] = f.end;
    if (!f.success) {
      for (const [k, delay] of [[1, 0], [0.6, 0.04]]) {
        env += el(
          "ellipse",
          { cx: ex, cy: ey + 2, rx: 0, ry: 0, fill: "none", stroke: INK, "stroke-width": 0.9, opacity: 0 },
          el("animate", { attributeName: "rx", values: `0;0;${16 * k}`, keyTimes: `0;${ARRIVE + delay};1`, ...timing }) +
            el("animate", { attributeName: "ry", values: `0;0;${3.4 * k}`, keyTimes: `0;${ARRIVE + delay};1`, ...timing }) +
            el("animate", { attributeName: "opacity", values: "0;0;1;0", keyTimes: `0;${ARRIVE + delay};${ARRIVE + delay + 0.03};1`, ...timing }),
        );
      }
    } else {
      // mailbox flag swings up when the envelope lands, plus a little "reply!"
      env += el(
        "g",
        {},
        el("path", { d: "M1172 389V376h6v5h-6", fill: BLUE, stroke: BLUE, "stroke-width": 1.2, "stroke-linejoin": "round" }) +
          el("animateTransform", {
            attributeName: "transform",
            type: "rotate",
            values: "90 1172 389;90 1172 389;0 1172 389;0 1172 389;90 1172 389",
            keyTimes: `0;${ARRIVE};${ARRIVE + 0.04};0.97;1`,
            calcMode: "spline",
            keySplines: splines(4),
            ...timing,
          }),
      );
      env += el(
        "text",
        { x: 1160, y: 364, class: "illo-label illo-label--blue", "text-anchor": "middle", opacity: 0 },
        "reply!" + el("animate", { attributeName: "opacity", values: "0;0;1;1;0", keyTimes: `0;${ARRIVE + 0.02};${ARRIVE + 0.05};0.95;1`, ...timing }),
      );
    }
  }
  add(el("g", { class: "trails" }, trails));
  add(el("g", { class: "envelopes" }, env));

  // ---------- Pigeons (click one) ----------
  const pigeon = (x, y, s, facing, kind, peck) => {
    let body = "";
    body += el("ellipse", { class: "hit", cx: 0, cy: -6, rx: 12, ry: 10, fill: "#000", "fill-opacity": 0 });
    body += el("path", { d: "M-5.5 -5L-12.5 -3.2L-11.6 -1.2L-5 -3Z", fill: "url(#hero-p)", stroke: INK, "stroke-width": 0.6, "stroke-linejoin": "round" });
    body += el("ellipse", { cx: -1, cy: -5, rx: 6.6, ry: 4.3, fill: PAPER, stroke: INK, "stroke-width": 0.75 });
    body += el("path", { d: "M-5.2 -6Q0 -8.6 4 -5.6Q0 -3 -5.2 -4.1Z", fill: "url(#hero-p)", stroke: INK, "stroke-width": 0.5 });
    body += el("path", { d: "M-1.5 -6.6l-1 2.2M0.6 -6.7l-1 2.3", stroke: INK, "stroke-width": 0.6 });
    body += el("path", { d: "M-1 -0.9l-0.5 1M1.2 -0.9l0.5 1", stroke: INK, "stroke-width": 0.6 });
    let head = "";
    head += el("path", { d: "M2.6 -7.4Q3.6 -10.4 5 -11.4", fill: "none", stroke: INK, "stroke-width": 0.75 });
    head += el("circle", { cx: 5.2, cy: -10.2, r: 2.6, fill: PAPER, stroke: INK, "stroke-width": 0.75 });
    head += el(
      "circle",
      { cx: 6, cy: -10.6, r: 0.6, fill: INK },
      el("animate", { attributeName: "r", values: "0.6;0.6;0.1;0.6;0.6", keyTimes: "0;0.92;0.95;0.98;1", dur: `${r.range(6, 9).toFixed(1)}s`, repeatCount: "indefinite" }),
    );
    head += el("path", { d: "M7.6 -10.4L9.8 -9.7L7.6 -9.1Z", fill: INK });
    head += el("path", { d: "M3.2 -7.7Q4.8 -6.3 6.6 -7.6", fill: "none", stroke: BLUE, "stroke-width": 1, "stroke-linecap": "round" });
    const tilt = peck ? 38 : 16;
    head = el(
      "g",
      {},
      head +
        el("animateTransform", {
          attributeName: "transform",
          type: "rotate",
          values: `0 3 -6;0 3 -6;${tilt} 3 -6;0 3 -6;${tilt * 0.6} 3 -6;0 3 -6;0 3 -6`,
          keyTimes: "0;0.55;0.6;0.65;0.7;0.75;1",
          calcMode: "spline",
          keySplines: splines(6),
          dur: `${r.range(4.5, 8).toFixed(1)}s`,
          begin: `-${r.range(0, 4).toFixed(1)}s`,
          repeatCount: "indefinite",
        }),
    );
    return el(
      "g",
      { class: "bird", "data-kind": kind, transform: `translate(${x} ${y}) scale(${n(facing * s)} ${s})` },
      el("g", {}, body + head + bob(-0.5, r.range(2.2, 3).toFixed(1))),
    );
  };
  let flock = "";
  flock += pigeon(230, 214, 2.0, 1, "rock", false);
  flock += pigeon(856, 296, 1.9, -1, "city", false);
  flock += pigeon(382, 400, 1.9, -1, "hungry", true);
  flock += pigeon(613, 394.5, 1.6, 1, "young", false);
  flock += pigeon(1124, 412, 1.8, 1, "old", true);
  add(el("g", { class: "flock" }, flock));

  // ---------- Labels ----------
  const label = (x, y, text, lead, anchor = "start", cls = "illo-label") => {
    let g = el("text", { x, y, class: cls, "text-anchor": anchor }, text);
    if (lead) {
      const [[a, b], [c, d]] = lead;
      g += el("path", { d: `M${a} ${b}L${c} ${d}`, stroke: MUTED, "stroke-width": 0.6 });
      g += el("circle", { cx: c, cy: d, r: 1.4, fill: INK });
    }
    return g;
  };
  let labels = "";
  labels += label(28, 186, "cold email · 5 domains × 3 inboxes", [[100, 191], [134, 296]]);
  labels += label(604, 232, "linkedin · keyword watch", [[602, 236], [584, 240]]);
  labels += label(1188, 336, "trade show floor", [[1120, 340], [1092, 356]], "end");
  labels += label(1186, 444, "~1 in 200 lands", null, "end", "illo-label illo-label--blue illo-label--halo");
  labels += label(318, 548, "the sea of unread", null, "middle", "illo-label illo-label--halo");
  add(el("g", { class: "labels" }, labels));

  const aria =
    "Etched illustration of a calm sea with four rocky islands, one per go-to-market channel: an Outbound Post office whose facade is a wall of 15 mailboxes (5 domains with 3 inboxes each), a radio tower pulsing blue signals for LinkedIn, a billboard of phone videos for paid social, and a trade-show pavilion with visitors. Envelopes arc out of the post office; most splash into the sea, and one reaches a mailbox on the pier, raising its flag. Pigeons perch around the scene.";

  return el(
    "svg",
    { class: "illo hero-illo", viewBox: `0 0 ${W} ${H}`, xmlns: "http://www.w3.org/2000/svg", role: "img", "aria-label": aria, "data-warm": 16 },
    parts.join(""),
  );
}
