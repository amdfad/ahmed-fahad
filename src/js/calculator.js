/* Sending calculator: domains → inboxes → emails/day → emails/week → replies.
   The diagram is redrawn from the sliders: domain boxes hold their inbox
   mailboxes, envelopes flow faster as daily volume grows, the week becomes a
   grid of tiles and the replies are the small blue pile at the end. */
(function () {
  var root = document.getElementById("calc");
  if (!root) return;
  var NS = "http://www.w3.org/2000/svg";
  var svg = root.querySelector("svg.calc-svg");
  var layer = svg.querySelector(".dyn");
  var INK = "#141414",
    PAPER = "#f5f3ee",
    BLUE = "#2f4bff";
  var RATE_LO = 0.005,
    RATE_HI = 0.01,
    WARMUP_DAYS = 21;

  var state = { domains: 5, per: 3, sends: 45, days: 5 };
  var fmt = new Intl.NumberFormat("en-US");
  var dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

  function h(tag, a, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in a) e.setAttribute(k, a[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function pick(list, fits) {
    for (var i = 0; i < list.length; i++) if (fits(list[i])) return list[i];
    return list[list.length - 1];
  }

  var hosts = [],
    tiles = [];

  /* two layouts: side by side on wide screens, stacked on phones */
  var LAYOUT = {
    wide: {
      w: 960,
      h: 340,
      dom: { x: 24, headY: 34, y: 72, w: 286, h: 236 },
      flow: {
        paths: ["M332 190Q440 112 548 190", "M332 190L548 190", "M332 190Q440 268 548 190"],
        a: [440, 140, "middle"],
        b: [440, 254, "middle"],
      },
      week: { x: 566, cols: 24, headY: 34, y: 72, h: 236, legendY: 330 },
      arrow: { x1: 806, x2: 842, y: 190 },
      rep: { x: 852, headY: 34, y: 72, h: 236, legendY: 330 },
    },
    narrow: {
      w: 400,
      h: 660,
      dom: { x: 16, headY: 22, y: 56, w: 368, h: 176 },
      flow: {
        paths: ["M200 246Q120 296 200 346", "M200 246L200 346", "M200 246Q280 296 200 346"],
        a: [18, 300, "start"],
        b: [382, 300, "end"],
      },
      week: { x: 16, cols: 22, headY: 380, y: 414, h: 212, legendY: 650 },
      arrow: { x1: 236, x2: 264, y: 520 },
      rep: { x: 276, headY: 380, y: 414, h: 212, legendY: 650 },
    },
  };
  var narrow = false;
  function isNarrow() {
    return svg.getBoundingClientRect().width < 560;
  }

  function render() {
    var d = state.domains,
      p = state.per,
      s = state.sends,
      days = state.days;
    var inboxes = d * p,
      day = inboxes * s,
      week = day * days,
      lo = Math.round(week * RATE_LO),
      hi = Math.round(week * RATE_HI);

    var L = narrow ? LAYOUT.narrow : LAYOUT.wide;
    svg.setAttribute("viewBox", "0 0 " + L.w + " " + L.h);
    layer.replaceChildren();
    hosts = [];
    tiles = [];

    /* ---- panel 1: domains holding inboxes ---- */
    var D = L.dom;
    h("text", { x: D.x, y: D.headY, class: "c-head" }, layer, "DOMAINS");
    h("text", { x: D.x, y: D.headY + 18, class: "c-sub" }, layer, d + " × " + p + " inbox" + (p > 1 ? "es" : "") + " = " + inboxes + " senders");
    var cols = d <= 3 ? d : d <= 6 ? 3 : d <= 12 ? 4 : 5;
    var rows = Math.ceil(d / cols);
    var gx = 12,
      gy = narrow ? 10 : 14;
    var bw = Math.min(104, (D.w - (cols - 1) * gx) / cols);
    var bh = Math.min(64, (D.h - (rows - 1) * gy) / rows);
    var gridW = cols * bw + (cols - 1) * gx,
      gridH = rows * bh + (rows - 1) * gy;
    var x0 = narrow ? D.x + (D.w - gridW) / 2 : D.x,
      y0 = D.y + (D.h - gridH) / 2;
    for (var i = 0; i < d; i++) {
      var c = i % cols,
        r = Math.floor(i / cols);
      var x = x0 + c * (bw + gx),
        y = y0 + r * (bh + gy);
      var g = h("g", { class: "host" }, layer);
      h("rect", { x: x + 4, y: y + 4, width: bw, height: bh, fill: "url(#calc-h)" }, g);
      h("rect", { class: "host-box", x: x, y: y, width: bw, height: bh, fill: PAPER, stroke: INK, "stroke-width": 1.1 }, g);
      h("text", { x: x + 5, y: y + 11, class: "c-tiny" }, g, bw < 70 ? "d" + (i + 1) : "domain-" + (i + 1));
      var mw = Math.min(18, (bw - 12) / p - 4),
        mh = mw * 0.75;
      var rowW = p * mw + (p - 1) * 4;
      var mx0 = x + (bw - rowW) / 2,
        my = y + Math.max(14, bh * 0.58 - mh / 2);
      if (my + mh > y + bh - 3) my = y + bh - 3 - mh;
      for (var k = 0; k < p; k++) {
        var mx = mx0 + k * (mw + 4);
        h("rect", { class: "gpu", x: mx, y: my, width: mw, height: mh, fill: PAPER, stroke: INK, "stroke-width": 0.9 }, g);
        h("line", { x1: mx + mw * 0.2, y1: my + mh * 0.32, x2: mx + mw * 0.8, y2: my + mh * 0.32, stroke: INK, "stroke-width": 0.9 }, g);
      }
      hosts.push({ el: g, x: x, y: y, w: bw, h: bh });
    }

    /* ---- flow: envelopes along dashed arcs ---- */
    var F = L.flow;
    F.paths.forEach(function (pd) {
      h("path", { d: pd, fill: "none", stroke: INK, "stroke-width": 0.9, "stroke-dasharray": "4 4", opacity: 0.6 }, layer);
    });
    h("text", { x: F.a[0], y: F.a[1], class: "c-flow", "text-anchor": F.a[2] }, layer, s + " / inbox / day");
    h("text", { x: F.b[0], y: F.b[1], class: "c-flow c-blue", "text-anchor": F.b[2] }, layer, "= " + fmt.format(day) + " / day");
    var count = clamp(Math.ceil(inboxes / 2), 2, 12);
    var dur = clamp(7 - Math.log10(day) * 1.4, 1.6, 6);
    for (var e = 0; e < count; e++) {
      var path = F.paths[e % 3];
      var env = h("g", { opacity: 0 }, layer);
      h("path", { d: "M-5 -3.5h10v7h-10zM-5 -3.5l5 4l5 -4", fill: PAPER, stroke: INK, "stroke-width": 0.8 }, env);
      var begin = (-(e * dur) / count).toFixed(2) + "s";
      h("animateMotion", { path: path, dur: dur.toFixed(2) + "s", begin: begin, repeatCount: "indefinite" }, env);
      h("animate", { attributeName: "opacity", values: "0;1;1;0", keyTimes: "0;0.12;0.88;1", dur: dur.toFixed(2) + "s", begin: begin, repeatCount: "indefinite" }, env);
    }

    /* ---- panel 2: one week as tiles ---- */
    var Wk = L.week,
      step = 9.6,
      t = 7,
      wcols = Wk.cols,
      wmax = wcols * Math.floor(Wk.h / step);
    var per = pick([5, 10, 25, 50, 100, 250, 500], function (v) {
      return Math.ceil(week / v) <= wmax;
    });
    var nt = Math.ceil(week / per);
    h("text", { x: Wk.x, y: Wk.headY, class: "c-head" }, layer, "ONE WEEK");
    h("text", { x: Wk.x, y: Wk.headY + 18, class: "c-sub" }, layer, fmt.format(week) + " emails sent");
    var wrows = Math.ceil(nt / wcols);
    var wy0 = Wk.y + Math.max(0, (Wk.h - wrows * step) / 2);
    for (var j = 0; j < nt; j++) {
      var tx = Wk.x + (j % wcols) * step,
        ty = wy0 + Math.floor(j / wcols) * step;
      var tile = h("rect", { class: "tile", x: tx, y: ty, width: t, height: t, fill: INK }, layer);
      tiles.push({ el: tile, cx: tx + t / 2, cy: ty + t / 2 });
    }
    h("text", { x: Wk.x, y: Wk.legendY, class: "c-tiny" }, layer, "each ■ = " + per + " emails");

    /* ---- arrow to replies ---- */
    var A = L.arrow;
    h("path", { d: "M" + A.x1 + " " + A.y + "H" + A.x2 + "M" + (A.x2 - 6) + " " + (A.y - 4.5) + "L" + A.x2 + " " + A.y + "L" + (A.x2 - 6) + " " + (A.y + 4.5), fill: "none", stroke: BLUE, "stroke-width": 1.1 }, layer);
    h("text", { x: (A.x1 + A.x2) / 2, y: A.y - 10, class: "c-tiny c-blue", "text-anchor": "middle" }, layer, "0.5–1%");

    /* ---- panel 3: replies ---- */
    var Rp = L.rep,
      rcols = 10,
      rmax = rcols * Math.floor(Rp.h / step);
    var rper = pick([1, 2, 5, 10, 25], function (v) {
      return Math.ceil(hi / v) <= rmax;
    });
    var nlo = Math.round(lo / rper),
      nhi = Math.max(1, Math.ceil(hi / rper));
    h("text", { x: Rp.x, y: Rp.headY, class: "c-head" }, layer, "REPLIES");
    h("text", { x: Rp.x, y: Rp.headY + 18, class: "c-sub c-blue" }, layer, fmt.format(lo) + "–" + fmt.format(hi) + " / week");
    var rrows = Math.ceil(nhi / rcols);
    var ry0 = Rp.y + Math.max(0, (Rp.h - rrows * step) / 2);
    for (var q = 0; q < nhi; q++) {
      var qx = Rp.x + (q % rcols) * step,
        qy = ry0 + Math.floor(q / rcols) * step;
      if (q < nlo) h("rect", { x: qx, y: qy, width: t, height: t, fill: BLUE }, layer);
      else h("rect", { x: qx + 0.5, y: qy + 0.5, width: t - 1, height: t - 1, fill: PAPER, stroke: BLUE, "stroke-width": 1 }, layer);
    }
    h("text", { x: Rp.x, y: Rp.legendY, class: "c-tiny" }, layer, rper === 1 ? "■ 0.5%  □ 1%" : "each ■ = " + rper);

    /* ---- readouts ---- */
    set("inboxes", fmt.format(inboxes));
    set("day", fmt.format(day));
    set("week", fmt.format(week));
    set("replies", fmt.format(lo) + "–" + fmt.format(hi));
    set(
      "equation",
      d + " domain" + (d > 1 ? "s" : "") + " × " + p + " inbox" + (p > 1 ? "es" : "") + " × " + s + " emails × " + days + " days = " + fmt.format(week) + " emails a week",
    );
    var today = new Date(),
      ready = new Date(today.getTime() + WARMUP_DAYS * 864e5),
      firstWeek = new Date(ready.getTime() + 7 * 864e5);
    set("t-today", dateFmt.format(today).padEnd(9));
    set("t-ready", dateFmt.format(ready).padEnd(9));
    set("t-week", dateFmt.format(firstWeek).padEnd(9));
    set("t-buy", "buy " + d + " domain" + (d > 1 ? "s" : "") + ", create " + inboxes + " inbox" + (inboxes > 1 ? "es" : "") + ", start warm-up");
    set("t-send", "warm-up done · connect to Smartlead · " + fmt.format(day) + " emails / day");
    set("t-reply", "~" + fmt.format(lo) + "–" + fmt.format(hi) + " replies in (replies, not meetings)");

    hint("domains", d <= 5 ? "3–5 is typical to start" : "more domains, more to warm and watch");
    hint("per", p <= 3 ? "3 per domain is the safe default" : "5 is the ceiling; watch deliverability", p > 3);
    hint("sends", s <= 45 ? "≤ 45 a day keeps an inbox healthy" : "above 45 a day, more lands in spam", s > 45);
    hint("days", days === 5 ? "weekdays only" : days === 6 ? "skip Sundays" : "every day of the week");
  }

  function set(key, text) {
    root.querySelectorAll('[data-out="' + key + '"]').forEach(function (n) {
      n.textContent = text;
    });
  }
  function hint(key, text, warn) {
    var n = root.querySelector('[data-hint="' + key + '"]');
    if (!n) return;
    n.textContent = text;
    n.classList.toggle("warn", !!warn);
  }

  root.querySelectorAll('input[type="range"]').forEach(function (input) {
    var key = input.getAttribute("data-key");
    state[key] = +input.value;
    var out = root.querySelector('output[data-for="' + key + '"]');
    function update() {
      state[key] = +input.value;
      if (out) out.textContent = input.value;
      input.style.setProperty("--fill", ((input.value - input.min) / (input.max - input.min)) * 100 + "%");
      render();
    }
    input.addEventListener("input", update);
    input.style.setProperty("--fill", ((input.value - input.min) / (input.max - input.min)) * 100 + "%");
  });

  /* pointer: domains and week tiles warm to gold, then cool */
  function point(e) {
    var pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function light(e) {
    var p = point(e);
    hosts.forEach(function (hst) {
      hst.el.classList.toggle("lit", p.x >= hst.x - 4 && p.x <= hst.x + hst.w + 4 && p.y >= hst.y - 4 && p.y <= hst.y + hst.h + 4);
    });
    tiles.forEach(function (tl) {
      tl.el.classList.toggle("lit", Math.abs(tl.cx - p.x) < 9.6 && Math.abs(tl.cy - p.y) < 9.6);
    });
  }
  svg.addEventListener("pointermove", light);
  svg.addEventListener("pointerdown", light);
  svg.addEventListener("pointerleave", function () {
    hosts.forEach(function (hst) {
      hst.el.classList.remove("lit");
    });
    tiles.forEach(function (tl) {
      tl.el.classList.remove("lit");
    });
  });

  narrow = isNarrow();
  render();
  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var nw = isNarrow();
      if (nw !== narrow) {
        narrow = nw;
        render();
      }
    }, 120);
  });
})();
