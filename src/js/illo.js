/* Shared illustration behaviour:
   1. pause SMIL loops for prefers-reduced-motion
   2. "warm" elements: anything with .w inside an svg[data-warm] glows gold near the pointer
   3. pigeons: click one and a little word floats up */
(function () {
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function apply() {
    document.querySelectorAll("svg.illo").forEach(function (svg) {
      if (!svg.pauseAnimations) return;
      if (mq && mq.matches) svg.pauseAnimations();
      else svg.unpauseAnimations();
    });
  }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener("change", apply);
})();

(function () {
  document.querySelectorAll("svg[data-warm]").forEach(function (svg) {
    var R = +svg.getAttribute("data-warm") || 16;
    var items = Array.prototype.map.call(svg.querySelectorAll(".w"), function (g) {
      return { el: g, cx: +g.getAttribute("data-cx"), cy: +g.getAttribute("data-cy") };
    });
    function light(e) {
      var pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      var p = pt.matrixTransform(svg.getScreenCTM().inverse());
      items.forEach(function (it) {
        it.el.classList.toggle("lit", Math.abs(it.cx - p.x) < R && Math.abs(it.cy - p.y) < R);
      });
    }
    svg.addEventListener("pointermove", light);
    svg.addEventListener("pointerdown", light);
    svg.addEventListener("pointerleave", function () {
      items.forEach(function (it) {
        it.el.classList.remove("lit");
      });
    });
  });
})();

(function () {
  var WORDS = {
    rock: ["coo", "coo coo", "reply?", "prrr"],
    city: ["circling back", "quick question", "coo!", "bump"],
    hungry: ["any leads?", "peck", "crumbs?", "coo"],
    young: ["coo?", "is this spam?", "eep", "first send!"],
    old: ["…seen", "per my last email", "unsubscribe", "zzz"],
  };
  var NS = "http://www.w3.org/2000/svg";
  var last = {};
  document.querySelectorAll("svg.illo").forEach(function (svg) {
    var birds = svg.querySelectorAll(".bird");
    if (!birds.length) return;
    var layer = document.createElementNS(NS, "g");
    layer.setAttribute("aria-hidden", "true");
    svg.appendChild(layer);
    birds.forEach(function (bird) {
      bird.addEventListener("click", function (e) {
        e.stopPropagation();
        var kind = bird.getAttribute("data-kind");
        var list = WORDS[kind] || WORDS.rock;
        var i;
        do {
          i = Math.floor(Math.random() * list.length);
        } while (list.length > 1 && i === last[kind]);
        last[kind] = i;
        var r = bird.getBoundingClientRect();
        var pt = svg.createSVGPoint();
        pt.x = r.left + r.width / 2;
        pt.y = r.top;
        var p = pt.matrixTransform(svg.getScreenCTM().inverse());
        var t = document.createElementNS(NS, "text");
        t.setAttribute("x", p.x.toFixed(1));
        t.setAttribute("y", (p.y - 3).toFixed(1));
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("class", "bird-word");
        t.textContent = list[i];
        t.style.setProperty("--tilt", ((Math.random() - 0.5) * 14).toFixed(1) + "deg");
        layer.appendChild(t);
        setTimeout(function () {
          layer.removeChild(t);
        }, 1900);
      });
    });
  });
})();
