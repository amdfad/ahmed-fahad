/* California Road Test Coach. Vanilla JS, no build step beyond inlining. */
(() => {
  "use strict";

  // ======================================================================
  // Data
  // ======================================================================
  const BANK = JSON.parse(document.getElementById("bank-data").textContent);
  const OFFICES = JSON.parse(document.getElementById("office-data").textContent);
  const STORE_KEY = "rtc:v1";
  const RESEARCH_TTL = 4 * 86400e3;
  const ARM_IDS = ["pd-arm-left", "pd-arm-right", "pd-arm-stop"];

  const PHASES = {
    checkin: { label: "Check-in", say: "Hi, I'm your examiner today. Before we start, a couple of quick questions." },
    predrive: { label: "Pre-drive check", say: "Before we drive, I'll ask you to show me some controls." },
    exit: { label: "Leaving the lot", say: "Okay. When you're ready, let's leave the lot." },
    drive: { label: "On the road", say: "Follow my directions. I'll tell you where to turn." },
    pullover: { label: "Pull-over", say: "Now I'd like you to pull over." },
    backing: { label: "Backing", say: "Next, some backing." },
    return: { label: "Back to the DMV", say: "Good. Let's head back to the DMV." },
  };

  const TOPIC_HINTS = {
    "four-way": "more four-way stop scenarios",
    signals: "flashing lights and turn arrows",
    pedestrians: "pedestrians, crosswalks and cyclists",
    observation: "head checks and mirror checks",
    lanes: "lane position, turns and spacing",
    speed: "speed limits and following distance",
    railroad: "railroad crossings",
    special: "emergency vehicles, school buses and rain",
    maneuvers: "pulling over, backing and the DMV lot",
    "test-day": "test day rules and the examiner",
  };

  // ======================================================================
  // Storage
  // ======================================================================
  const store = {
    get(k, fallback) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : fallback;
      } catch {
        return fallback;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* private mode or full: keep going in memory */
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch {}
    },
  };
  const defaults = () => ({
    office: null,
    testDate: "",
    hasCar: null,
    hasDriver: null,
    voice: false,
    stats: {},
    review: {},
    mocks: [],
    extra: [],
    predrive: {},
    expectDone: false,
  });
  let S = Object.assign(defaults(), store.get(STORE_KEY, {}));
  const save = () => store.set(STORE_KEY, S);

  // Research state for the chosen office
  let R = { state: "idle", data: null };
  let researchToken = 0;

  // Claude availability (grading + research). Checked once at load.
  const AI = { on: false, failures: 0 };
  AI.ready = fetchWithTimeout("/api/health", {}, 4000)
    .then((r) => (r.ok ? r.json() : { ai: false }))
    .then((j) => (AI.on = Boolean(j.ai)))
    .catch(() => (AI.on = false));

  // ======================================================================
  // Utilities
  // ======================================================================
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const plain = (s) => String(s).replace(/\*\*/g, "");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const slug = (t) =>
    String(t)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const sourceUrl = (s) => (s && BANK.sources[s]) || s || BANK.sources.handbook;
  const sourceLabel = (url) => {
    try {
      const u = new URL(url);
      if (u.hostname.endsWith("dmv.ca.gov")) return u.pathname.includes("handbook") ? "CA Driver Handbook" : "dmv.ca.gov";
      return u.hostname.replace(/^www\./, "");
    } catch {
      return "Source";
    }
  };

  function fetchWithTimeout(url, opts, ms) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
  }
  const postJSON = (url, body, ms) =>
    fetchWithTimeout(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, ms);

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  /** replaceChildren / append that skip null and false (the DOM would print "null"). */
  const clean = (nodes) => nodes.flat(Infinity).filter((n) => n != null && n !== false);
  const fill = (el, ...nodes) => el.replaceChildren(...clean(nodes));
  const add = (el, ...nodes) => el.append(...clean(nodes));
  const btn = (label, onclick, cls = "", extra = {}) =>
    h("button", { type: "button", class: `btn ${cls}`.trim(), onclick, ...extra }, label);

  const ICON_SPEAK =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const ICON_MIC =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

  function toast(msg) {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    const t = h("div", { class: "toast", role: "status" }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 2800);
  }

  function openSheet(...content) {
    closeSheet();
    const close = () => closeSheet();
    const backdrop = h(
      "div",
      { class: "sheet-backdrop", onclick: (e) => e.target === backdrop && close() },
      h("div", { class: "sheet", role: "dialog", "aria-modal": "true" }, ...content, h("div", { class: "rule" }), btn("Close", close)),
    );
    document.body.append(backdrop);
    $(".sheet button", backdrop)?.focus();
  }
  function closeSheet() {
    document.querySelectorAll(".sheet-backdrop").forEach((b) => b.remove());
  }
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeSheet());

  // ======================================================================
  // Voice
  // ======================================================================
  const synth = window.speechSynthesis;
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let chosenVoice = null;
  function pickVoice() {
    const vs = synth ? synth.getVoices() : [];
    chosenVoice =
      vs.find((v) => /^en-US/i.test(v.lang) && /Samantha|Google US English|Aria|Jenny|Natural/i.test(v.name)) ||
      vs.find((v) => /^en-US/i.test(v.lang)) ||
      vs.find((v) => /^en/i.test(v.lang)) ||
      null;
  }
  if (synth) {
    pickVoice();
    synth.onvoiceschanged = pickVoice;
  }

  let speakToken = 0;
  /** Speak text. Only when voice mode is on, unless force (explicit "say that again"). */
  function speak(text, { force = false, onend } = {}) {
    const token = ++speakToken;
    if (!synth || (!S.voice && !force)) return;
    synth.cancel();
    setTimeout(() => {
      if (token !== speakToken) return;
      const u = new SpeechSynthesisUtterance(plain(text));
      if (chosenVoice) u.voice = chosenVoice;
      u.lang = "en-US";
      u.rate = 0.95;
      if (onend) u.onend = () => token === speakToken && onend();
      synth.speak(u);
    }, 80);
  }
  function stopSpeaking() {
    speakToken++;
    if (synth) synth.cancel();
  }

  let rec = null;
  /** Start speech recognition. onState(state, text) with state listening|hearing|idle|error. */
  function listen(onText, onState) {
    if (!Rec) return false;
    stopListening();
    const r = new Rec();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      onState("hearing", (finalText + " " + interim).trim());
    };
    r.onerror = (e) => onState("error", e.error);
    r.onend = () => {
      if (rec !== r) return;
      rec = null;
      onState("idle");
      const t = finalText.trim();
      if (t) onText(t);
    };
    try {
      r.start();
      rec = r;
      onState("listening");
      return true;
    } catch {
      return false;
    }
  }
  function stopListening() {
    const r = rec;
    rec = null;
    if (r) {
      try {
        r.abort();
      } catch {}
    }
  }

  function voiceCommand(text) {
    const s = text
      .toLowerCase()
      .replace(/[^a-z' ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (/^(please )?(say (that|it) again|repeat( that| it| the question)?|again|say again|what was the question|come again)( please)?$/.test(s))
      return "again";
    if (/^(explain( that| it)?|explain (the )?last( answer)?|why|explain please)$/.test(s)) return "explain";
    if (s.split(" ").length <= 6 && /^(i (don'?t|do not) know|tell me|no idea|i'?m not sure|not sure|skip)/.test(s)) return "dontknow";
    if (/^(ok(ay)? )?(next|next question|continue|go on|move on)( please)?$/.test(s)) return "next";
    return null;
  }

  // ======================================================================
  // Grading
  // ======================================================================
  const STOP = new Set(
    "a an the to of and or in on at for is are be it its you your i my me we they them their that this then if as by with from do does did so just will would should can could must am was were been being has have had very really".split(
      " ",
    ),
  );
  const NUM = { one: "1", two: "2", three: "3", four: "4", five: "5", ten: "10", fifteen: "15", eighteen: "18", twenty: "20", hundred: "100" };
  const SYN = {
    vehicle: "car", automobile: "car", halt: "stop", ped: "person", pedestrian: "person", people: "person",
    walker: "person", someone: "person", somebody: "person", look: "check", glance: "check", scan: "check",
    blinker: "signal", indicator: "signal", indicate: "signal", proceed: "go", continu: "go", slowly: "slow",
    slower: "slow", let: "yield", allow: "yield", wait: "yield", gap: "gap", stationary: "stop", complete: "full",
    behind: "before", back: "behind", mph: "mph", miles: "mph", feet: "ft", foot: "ft", rearview: "mirror",
  };
  function stem(w) {
    w = NUM[w] || w;
    if (SYN[w]) return SYN[w];
    if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
    else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
    return SYN[w] || w;
  }
  function words(s) {
    return String(s)
      .toLowerCase()
      .replace(/twenty[- ]five/g, "25")
      .replace(/[^a-z0-9' ]+/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/'/g, ""))
      .filter((w) => w && !STOP.has(w))
      .map(stem);
  }
  function localGrade(item, answer) {
    const have = new Set(words(answer));
    const hits = item.keyPoints.map((kp) => {
      const ws = words(kp);
      if (!ws.length) return true;
      return ws.filter((w) => have.has(w)).length / ws.length >= 0.5;
    });
    const got = hits.filter(Boolean).length;
    const verdict = got === hits.length ? "correct" : got > 0 ? "partly" : "incorrect";
    const missing = item.keyPoints.filter((_, i) => !hits[i]);
    const feedback =
      verdict === "correct"
        ? "That covers the key points."
        : verdict === "partly"
          ? `Good start. Missing: ${missing.join("; ")}.`
          : `Key points: ${item.keyPoints.join("; ")}.`;
    return { verdict, feedback, offline: true };
  }
  async function grade(item, answer) {
    if (AI.on && AI.failures < 3) {
      try {
        const r = await postJSON(
          "/api/grade",
          { prompt: item.prompt, modelAnswer: item.modelAnswer, keyPoints: item.keyPoints, answer },
          15000,
        );
        if (r.ok) {
          AI.failures = 0;
          const j = await r.json();
          if (["correct", "partly", "incorrect"].includes(j.verdict)) return { ...j, offline: false };
        }
        AI.failures++;
      } catch {
        AI.failures++;
      }
    }
    return localGrade(item, answer);
  }

  // ======================================================================
  // Items and progress
  // ======================================================================
  const PREDRIVE_ITEMS = BANK.predrive.map((p) => ({ ...p, phase: "predrive" }));
  const localQuestions = () => (R.state === "ready" && R.data?.questions) || [];
  const allItems = () => [...BANK.items, ...PREDRIVE_ITEMS, ...localQuestions(), ...S.extra];
  const byId = (id) => allItems().find((i) => i.id === id) || S.review[id]?.item || null;
  const usableItems = (list) => list.filter((i) => i && i.prompt && i.modelAnswer && i.keyPoints?.length);

  function choicesFor(item) {
    let wrong = (item.distractors || []).filter(Boolean).slice(0, 2);
    if (wrong.length < 2) {
      const others = shuffle(
        allItems()
          .filter((i) => i.id !== item.id && i.category === item.category && i.modelAnswer !== item.modelAnswer)
          .map((i) => i.modelAnswer),
      );
      wrong = wrong.concat(others).slice(0, 2);
    }
    return shuffle([{ text: item.modelAnswer, right: true }, ...wrong.map((text) => ({ text, right: false }))]);
  }

  /** Save the outcome of one answer: stats, plus the weak-spot review set. */
  function record(item, verdict) {
    const st = (S.stats[item.id] ||= { seen: 0, right: 0, last: null, cat: item.category });
    st.seen++;
    if (verdict === "correct") st.right++;
    st.last = verdict;
    const snapshot = BANK.items.some((i) => i.id === item.id) || PREDRIVE_ITEMS.some((i) => i.id === item.id) ? undefined : item;
    if (verdict === "correct") {
      const r = S.review[item.id];
      if (r) {
        r.streak++;
        if (r.streak >= 2) delete S.review[item.id];
      }
    } else {
      S.review[item.id] = { streak: 0, item: snapshot };
    }
    save();
  }

  function weight(i) {
    let w = 1;
    if (i.highRisk) w += 2;
    if (i.severity === "critical") w += 1;
    if (i.officeSpecific) w += 2;
    if (S.review[i.id]) w += 2;
    return w;
  }
  function weightedPick(pool, n) {
    const p = pool.slice();
    const out = [];
    while (out.length < n && p.length) {
      const total = p.reduce((s, i) => s + weight(i), 0);
      let r = Math.random() * total;
      let k = 0;
      for (; k < p.length - 1; k++) {
        r -= weight(p[k]);
        if (r <= 0) break;
      }
      out.push(p.splice(k, 1)[0]);
    }
    return out;
  }

  function categoryStats() {
    const out = {};
    for (const key of Object.keys(BANK.categories)) out[key] = { seen: 0, right: 0, total: 0 };
    for (const i of allItems()) if (out[i.category]) out[i.category].total++;
    for (const [id, st] of Object.entries(S.stats)) {
      const cat = byId(id)?.category || st.cat;
      if (out[cat]) {
        out[cat].seen += st.seen;
        out[cat].right += st.right;
      }
    }
    return out;
  }
  function weakestCategory() {
    const cs = categoryStats();
    let worst = null;
    for (const [k, v] of Object.entries(cs)) {
      if (k === "pre-drive" || !v.seen) continue;
      const rate = v.right / v.seen;
      if (!worst || rate < worst.rate) worst = { k, rate };
    }
    return worst?.k || "four-way";
  }

  // ======================================================================
  // Research (background)
  // ======================================================================
  const officeKey = (o) => slug(`${o.name} ${o.address || ""}`);

  async function startResearch(force = false) {
    const o = S.office;
    if (!o) return;
    const key = "rtc:research:" + officeKey(o);
    const token = ++researchToken;
    const cached = store.get(key);
    if (!force && cached && Date.now() - cached.at < RESEARCH_TTL) {
      R = { state: "ready", data: cached.data };
      updateChip();
      return;
    }
    R = { state: "working", data: null };
    updateChip();
    for (let attempt = 0; attempt < 20; attempt++) {
      let r;
      try {
        r = await postJSON("/api/research", { office: { name: o.name, address: o.address || "" } }, 295000);
      } catch {
        break;
      }
      if (token !== researchToken) return;
      if (r.status === 202) {
        await sleep(15000);
        if (token !== researchToken) return;
        continue;
      }
      if (!r.ok) break;
      const j = await r.json().catch(() => null);
      if (j?.status === "unavailable") {
        R = { state: "off", data: null };
        updateChip();
        refreshScreens();
        return;
      }
      if (!j?.data) break;
      store.set(key, { at: Date.now(), data: j.data });
      R = { state: "ready", data: j.data };
      updateChip();
      toast(j.data.questions?.length ? `Local tips ready: ${plural(j.data.questions.length, "local question")} added` : "Local tips ready");
      refreshScreens();
      return;
    }
    if (token === researchToken) {
      R = { state: "failed", data: null };
      updateChip();
      refreshScreens();
    }
  }
  function refreshScreens() {
    if (["home", "local", "drills"].includes(current.name)) render(current.name, current.arg, false);
  }

  const chip = $("#status");
  function updateChip() {
    if (!S.office) {
      chip.hidden = true;
      return;
    }
    const text = {
      working: "Researching your test area...",
      ready: "Local tips ready",
      failed: "Using general content",
      off: "Built-in content",
      idle: "",
    }[R.state];
    chip.hidden = !text;
    chip.textContent = text;
    chip.dataset.state = R.state;
    chip.setAttribute("aria-label", R.state === "ready" ? "Local tips ready. Open them." : text);
  }
  chip.addEventListener("click", () => {
    if (R.state === "ready" || R.state === "failed" || R.state === "off") go("local");
  });

  // ======================================================================
  // Router
  // ======================================================================
  const main = $("#main");
  let current = { name: "", arg: null };
  const screens = {};

  function mount(...nodes) {
    stopSpeaking();
    stopListening();
    closeSheet();
    main.replaceChildren(h("section", { class: "screen" }, ...nodes));
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  function render(name, arg, push = true) {
    if (!S.office && name !== "setup") name = "setup";
    current = { name, arg };
    if (push) history.pushState({ name }, "", name === "home" ? location.pathname : `#${name}`);
    screens[name](arg);
  }
  const go = (name, arg) => render(name, arg, true);
  window.addEventListener("popstate", (e) => {
    const name = e.state?.name || (location.hash.slice(1) in screens ? location.hash.slice(1) : "home");
    // Never resume half a session from history; sessions restart from their menu.
    render(["session"].includes(name) ? "home" : name, null, false);
  });
  $("#brand").addEventListener("click", () => go(S.office ? "home" : "setup"));

  const voiceBtn = $("#voice");
  function updateVoiceBtn() {
    voiceBtn.setAttribute("aria-pressed", String(S.voice));
    voiceBtn.textContent = S.voice ? "Voice on" : "Voice off";
  }
  voiceBtn.addEventListener("click", () => {
    S.voice = !S.voice;
    save();
    updateVoiceBtn();
    if (S.voice) {
      if (!synth) toast("This browser cannot speak. Text still works.");
      else speak(Rec ? "Voice on. Tap the microphone to answer out loud." : "Voice on. I'll read the questions. Type your answers.");
    } else {
      stopSpeaking();
      stopListening();
    }
  });

  // ======================================================================
  // Screen: setup
  // ======================================================================
  screens.setup = () => {
    let picked = S.office;
    const draft = { testDate: S.testDate, hasCar: S.hasCar, hasDriver: S.hasDriver };

    const search = h("input", {
      class: "input",
      id: "office-search",
      type: "search",
      autocomplete: "off",
      placeholder: "Type a city or office, e.g. San Mateo",
      "aria-controls": "office-results",
    });
    const results = h("ul", { class: "results", id: "office-results", hidden: true });
    const pickedBox = h("div");
    const startBtn = btn("Start learning", start, "primary", { disabled: !picked });

    function showPicked() {
      fill(pickedBox, );
      if (!picked) {
        search.hidden = false;
        startBtn.disabled = true;
        return;
      }
      search.hidden = true;
      results.hidden = true;
      startBtn.disabled = false;
      add(pickedBox, 
        h(
          "div",
          { class: "picked" },
          h("strong", {}, picked.name + (picked.custom ? "" : " DMV")),
          h("div", { class: "small muted" }, picked.address || "Address not listed"),
        ),
        h("button", {
          type: "button",
          class: "btn quiet",
          onclick: () => {
            picked = null;
            showPicked();
            search.focus();
          },
        }, "Change office"),
      );
    }

    function filter() {
      const q = search.value.trim().toLowerCase();
      fill(results, );
      if (!q) {
        results.hidden = true;
        return;
      }
      const terms = q.split(/\s+/);
      const hits = OFFICES.filter((o) => {
        const hay = `${o.name} ${o.address}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
        .sort((a, b) => (a.name.toLowerCase().startsWith(q) ? -1 : 0) - (b.name.toLowerCase().startsWith(q) ? -1 : 0))
        .slice(0, 8);
      for (const o of hits) {
        add(results, 
          h("li", {}, h("button", { type: "button", onclick: () => ((picked = o), showPicked(), startBtn.focus()) }, h("strong", {}, o.name), h("span", {}, o.address))),
        );
      }
      add(results, 
        h(
          "li",
          {},
          h(
            "button",
            {
              type: "button",
              onclick: () => {
                picked = { id: "custom-" + slug(search.value), name: search.value.trim(), address: "", custom: true };
                showPicked();
              },
            },
            h("strong", {}, `Use "${search.value.trim()}"`),
            h("span", {}, hits.length ? "Not in the list? Use what I typed." : "No match in the list. Use what I typed."),
          ),
        ),
      );
      results.hidden = false;
    }
    search.addEventListener("input", filter);
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        $("button", results)?.click();
      }
    });

    const date = h("input", { class: "input", type: "date", id: "test-date", value: draft.testDate || "" });
    date.addEventListener("change", () => (draft.testDate = date.value));

    function yesNo(key, label) {
      const group = h("div", { class: "choice-group", role: "group", "aria-label": label });
      const mk = (val, text) =>
        h(
          "button",
          {
            type: "button",
            "aria-pressed": String(draft[key] === val),
            onclick: (e) => {
              draft[key] = val;
              group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
              e.currentTarget.setAttribute("aria-pressed", "true");
            },
          },
          text,
        );
      group.append(mk(true, "Yes"), mk(false, "Not yet"));
      return h("div", {}, h("p", { class: "field" , style: "font-weight:700;margin-bottom:6px" }, label), group);
    }

    function start() {
      if (!picked) return;
      const changed = !S.office || officeKey(S.office) !== officeKey(picked);
      S.office = { id: picked.id, name: picked.name, address: picked.address || "", custom: Boolean(picked.custom) };
      Object.assign(S, draft);
      save();
      if (changed || R.state === "idle" || R.state === "failed") startResearch();
      go(S.expectDone ? "home" : "expect");
    }

    mount(
      h("span", { class: "kicker" }, "California DMV drive test"),
      h("h1", { class: "title" }, "Which DMV office is your road test at?"),
      h("p", { class: "lede" }, "Pick it and start. I'll look up your local test area in the background."),
      h("label", { class: "field", for: "office-search" }, "DMV office"),
      search,
      results,
      pickedBox,
      h("div", { class: "rule" }),
      h("div", { class: "stack" },
        h("div", {}, h("label", { class: "field", for: "test-date" }, "Test date ", h("span", { class: "muted small" }, "(optional)")), date),
        yesNo("hasCar", "Do you have a car for the test?"),
        yesNo("hasDriver", "Do you have a licensed driver (18+) to bring you?"),
      ),
      h("div", { class: "rule" }),
      startBtn,
    );
    showPicked();
    if (!picked) search.focus();
  };

  // ======================================================================
  // Screen: home
  // ======================================================================
  screens.home = () => {
    const reviewN = Object.keys(S.review).length;
    const days = S.testDate ? Math.ceil((new Date(S.testDate + "T09:00") - new Date()) / 86400e3) : null;
    const last = S.mocks[S.mocks.length - 1];

    const notes = [];
    if (S.hasCar === false)
      notes.push("You need a safe, insured, registered car for the test. A driving school car is one option.");
    if (S.hasDriver === false)
      notes.push("You need a licensed driver, 18 or older, to bring you. A permit holder cannot drive there alone.");

    const item = (n, label, sub, meta, to) =>
      h(
        "li",
        {},
        h(
          "button",
          { type: "button", onclick: to },
          h("span", { class: "menu-num" }, n),
          h("span", {}, h("span", { class: "menu-label" }, label), h("span", { class: "menu-sub" }, sub)),
          h("span", { class: "menu-meta" }, meta || ""),
        ),
      );

    mount(
      h("span", { class: "kicker" }, S.office.name + (S.office.custom ? "" : " DMV")),
      h(
        "h1",
        { class: "title" },
        days != null && days >= 0 ? (days === 0 ? "Test day. You've got this." : `${days} day${days === 1 ? "" : "s"} to your test`) : "Let's practise",
      ),
      h("p", { class: "lede" }, "Mocks work best: one question at a time, like the examiner."),
      notes.length ? h("div", { class: "stack", style: "margin-bottom:20px" }, notes.map((n) => h("p", { class: "note" }, n))) : null,
      h(
        "ul",
        { class: "menu" },
        item("01", "What to expect", "Test day, step by step", S.expectDone ? "Done" : "Start here", () => go("expect")),
        item("02", "Pre-drive drill", "Show me your hazard lights...", predriveMeta(), () => go("predrive")),
        item("03", "Rule drills", "Scenario questions by topic", "", () => go("drills")),
        item("04", "Full mock test", "The examiner, start to finish", last ? (last.pass ? "Last: pass" : "Last: fail") : "", () => go("mock")),
        item("05", "Weak-spot review", "Until right twice in a row", reviewN ? `${reviewN} to fix` : "", () => go("review")),
        item("06", "Readiness", "Your summary", "", () => go("summary")),
        item("07", "Local tips", localSub(), R.state === "ready" ? "Ready" : "", () => go("local")),
      ),
      h("div", { class: "rule" }),
      h("button", { type: "button", class: "btn quiet", onclick: () => go("setup") }, "Change office or test details"),
    );
  };
  function predriveMeta() {
    const fast = BANK.predrive.filter((p) => S.predrive[p.id] === "fast").length;
    return fast ? `${fast}/${BANK.predrive.length} fast` : "";
  }
  function localSub() {
    return {
      working: "Researching your area now...",
      ready: "Routes, hazards and sources",
      failed: "Not available right now",
      off: "Not available right now",
      idle: "Routes, hazards and sources",
    }[R.state];
  }

  // ======================================================================
  // Screen: what to expect
  // ======================================================================
  screens.expect = () => {
    const cards = [
      ...BANK.expect.map((c) => ({ ...c, kicker: "What to expect" })),
      ...BANK.mistakes.map((c) => ({ ...c, kicker: "Mistakes other people made" })),
    ];
    let i = 0;
    const host = h("div");

    function show() {
      const c = cards[i];
      const sayText = c.title + ". " + c.lines.join(" ");
      fill(host, 
        h("div", { class: "progress" }, `${i + 1} / ${cards.length}`, h("div", { class: "progress-bar" }, h("span", { style: `width:${((i + 1) / cards.length) * 100}%` }))),
        h("span", { class: "kicker" }, c.kicker),
        h(
          "div",
          { class: "card" },
          h("h2", { class: "card-title", id: "card-title", tabindex: "-1" }, c.title),
          c.lines.map((l) => h("p", { html: md(l) })),
          c.source ? h("a", { class: "source", href: sourceUrl(c.source), target: "_blank", rel: "noopener" }, "Source: " + sourceLabel(sourceUrl(c.source))) : null,
        ),
        h("div", { style: "height:14px" }),
        h("button", { type: "button", class: "btn again", onclick: () => speak(sayText, { force: true }), html: ICON_SPEAK + "<span>Say that again</span>" }),
        h("div", { style: "height:10px" }),
        i < cards.length - 1
          ? h("div", { class: "row" }, i > 0 ? btn("Back", () => (i--, show()), "ghost") : null, btn("Next", () => (i++, show()), "primary"))
          : h(
              "div",
              { class: "stack" },
              btn("Start the pre-drive drill", () => go("predrive"), "primary"),
              btn("Back to menu", () => go("home"), "ghost"),
            ),
      );
      if (i === cards.length - 1 && !S.expectDone) {
        S.expectDone = true;
        save();
      }
      $("#card-title", host)?.focus();
      speak(sayText);
    }
    mount(h("h1", { class: "sr-only" }, "What to expect"), host);
    show();
  };

  // ======================================================================
  // Screen: pre-drive drill
  // ======================================================================
  screens.predrive = () => {
    const host = h("div");
    const items = BANK.predrive;
    let i = -1;
    const results = {};

    function intro() {
      fill(host, 
        h("span", { class: "kicker" }, "Pre-drive drill"),
        h("h1", { class: "title" }, "Show me the controls"),
        h("p", { class: "lede" }, "Do this sitting in the car you will test in. Each prompt: find it, use it, say how fast you were."),
        h("div", { class: "card stack" }, BANK.predriveTips.map((t) => h("p", { html: md(t) }))),
        h("div", { style: "height:14px" }),
        h(
          "details",
          { class: "fold" },
          h("summary", {}, "Vehicle checks the examiner does first"),
          h("div", {}, h("p", { class: "small muted", style: "margin-bottom:8px" }, "If the car fails these, the test is rescheduled."), h("ul", { class: "plain" }, BANK.vehicleCheck.map((v) => h("li", {}, v)))),
        ),
        h("div", { style: "height:14px" }),
        btn("Start", () => ((i = 0), step()), "primary"),
      );
      speak("Pre-drive drill. Sit in the car you will test in. I'll ask you to find each control.");
    }

    function step() {
      if (i >= items.length) return done();
      const p = items[i];
      const answer = h("div");
      const rate = (val) => {
        results[p.id] = val;
        S.predrive[p.id] = val;
        save();
        const msg = val === "fast" ? "Good." : val === "slow" ? "Practise this one until it's under two seconds." : "Here's how.";
        fill(answer, 
          h(
            "div",
            { class: "verdict", "data-v": val === "fast" ? "correct" : val === "slow" ? "partly" : "dontknow" },
            h("p", { class: "verdict-head" }, val === "fast" ? "Good" : val === "slow" ? "Keep practising" : "Here's how"),
            h("p", {}, p.howTo),
          ),
          h("div", { style: "height:12px" }),
          btn(i < items.length - 1 ? "Next" : "Finish", () => (i++, step()), "primary"),
        );
        $(".btn.primary", answer).focus();
        speak(`${msg} ${p.howTo}`);
      };
      fill(host, 
        h("div", { class: "progress" }, `Item ${p.item}  ·  ${i + 1} / ${items.length}`, h("div", { class: "progress-bar" }, h("span", { style: `width:${((i + 1) / items.length) * 100}%` }))),
        h("span", { class: "kicker" }, p.label),
        h("p", { class: "q-prompt", id: "q-prompt", tabindex: "-1" }, p.locate),
        h("div", { style: "height:16px" }),
        h("button", { type: "button", class: "btn again", onclick: () => sayAgain(p.locate), html: ICON_SPEAK + "<span>Say that again</span>" }),
        h("div", { style: "height:16px" }),
        answer,
      );
      add(answer, 
        h(
          "div",
          { class: "stack" },
          btn("Done in under 2 seconds", () => rate("fast"), "primary"),
          btn("Done, but slow", () => rate("slow")),
          btn("Not sure, tell me", () => rate("unsure"), "ghost"),
        ),
      );
      $("#q-prompt", host).focus();
      speak(p.locate);
    }

    function done() {
      const slow = items.filter((p) => results[p.id] && results[p.id] !== "fast");
      fill(host, 
        h("span", { class: "kicker" }, "Pre-drive drill"),
        h("h1", { class: "title" }, slow.length ? `${items.length - slow.length} of ${items.length} were quick` : "All quick. Nice."),
        slow.length
          ? h("div", { class: "card" }, h("p", { style: "font-weight:700;margin-bottom:8px" }, "Practise these in the car:"), h("ul", { class: "plain" }, slow.map((p) => h("li", {}, p.label))))
          : h("p", { class: "lede" }, "Do it once more on test day morning."),
        h("div", { style: "height:16px" }),
        h(
          "div",
          { class: "stack" },
          btn("Quiz me on arm signals", () => startDrill(ARM_IDS.map(byId), "Arm signals"), "primary"),
          btn("Run the drill again", () => ((i = 0), step())),
          btn("Back to menu", () => go("home"), "ghost"),
        ),
      );
      speak(slow.length ? `Practise these: ${slow.map((p) => p.label).join(", ")}.` : "All quick. Nice.");
    }

    mount(host);
    intro();
  };

  // ======================================================================
  // Screen: drills menu
  // ======================================================================
  screens.drills = () => {
    const cs = categoryStats();
    const rows = [];
    const row = (label, sub, meta, onclick) =>
      h("li", {}, h("button", { type: "button", onclick }, h("span", { class: "menu-num" }, ""), h("span", {}, h("span", { class: "menu-label" }, label), h("span", { class: "menu-sub" }, sub)), h("span", { class: "menu-meta" }, meta)));

    rows.push(row("Mixed, high-risk first", "10 questions, weighted to what fails people", "", () => startDrill(weightedPick(usableItems(allItems().filter((i) => i.phase !== "predrive")), 10), "Mixed drill")));
    if (localQuestions().length)
      rows.push(row("Your test area", plural(localQuestions().length, "local question"), "Local", () => startDrill(shuffle(usableItems(localQuestions().slice())), "Local questions")));
    if (S.extra.length) rows.push(row("Extra questions", `${S.extra.length} you pulled in`, "", () => startDrill(shuffle(usableItems(S.extra.slice())), "Extra questions")));
    for (const [key, label] of Object.entries(BANK.categories)) {
      const items = usableItems(allItems().filter((i) => i.category === key));
      if (!items.length) continue;
      const c = cs[key];
      const meta = c.seen ? `${Math.round((c.right / c.seen) * 100)}%` : "";
      rows.push(row(label, plural(items.length, "question"), meta, () => startDrill(shuffle(items.slice()).slice(0, 10), label)));
    }

    mount(
      h("span", { class: "kicker" }, "Rule drills"),
      h("h1", { class: "title" }, "Pick a topic"),
      h("p", { class: "lede" }, "One scenario at a time. Answer in your own words, out loud or typed."),
      h("ul", { class: "menu" }, rows),
      h("div", { class: "rule" }),
      findMorePanel(),
    );
  };

  function findMorePanel() {
    const input = h("input", { class: "input", id: "more-topic", value: TOPIC_HINTS[weakestCategory()] || "" });
    const status = h("p", { class: "small muted", "aria-live": "polite" });
    const go_ = btn("Find more questions", run);
    async function run() {
      const topic = input.value.trim();
      if (topic.length < 3) return input.focus();
      go_.disabled = true;
      status.textContent = "Searching for sourced questions. This can take a minute.";
      try {
        const r = await postJSON("/api/more", { topic, office: S.office?.name || "" }, 175000);
        if (r.status === 503) throw new Error("off");
        if (r.status === 429) throw new Error("limit");
        if (!r.ok) throw new Error("fail");
        const j = await r.json();
        const seen = new Set(allItems().map((i) => i.prompt.toLowerCase()));
        const fresh = usableItems(j.questions || []).filter((q) => !seen.has(q.prompt.toLowerCase()));
        if (!fresh.length) {
          status.textContent = "Nothing new found for that topic. Try wording it differently.";
          return;
        }
        S.extra.push(...fresh);
        save();
        fill(status, `Added ${plural(fresh.length, "question")}. `, h("button", { type: "button", class: "btn quiet", style: "display:inline;min-height:0;padding:0", onclick: () => startDrill(fresh, "New questions") }, "Drill them now"));
      } catch (e) {
        status.textContent =
          e.message === "off"
            ? "Finding new questions needs the online helper, which is off. The built-in questions still work."
            : e.message === "limit"
              ? "That's the limit for now. Try again in an hour."
              : "Could not reach the question finder. The built-in questions still work.";
      } finally {
        go_.disabled = false;
      }
    }
    return h(
      "div",
      { class: "stack" },
      h("label", { class: "field", for: "more-topic" }, "Want more on a weak topic?"),
      input,
      go_,
      status,
    );
  }

  // ======================================================================
  // Question engine (drills, mock, review)
  // ======================================================================
  let lastExplain = null; // { prompt, head, feedback, modelAnswer, source }

  function sayAgain(text) {
    const el = $("#q-prompt");
    if (el) {
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }
    speak(text, { force: true });
  }

  function explainLast() {
    if (!lastExplain) return;
    const e = lastExplain;
    openSheet(
      h("span", { class: "kicker" }, "Last answer"),
      h("p", { style: "font-weight:700;margin-bottom:10px" }, e.prompt),
      h("p", { class: "verdict-head", style: "font-size:20px" }, e.head),
      e.feedback ? h("p", {}, e.feedback) : null,
      h("div", { class: "model" }, h("p", { class: "model-label" }, "Model answer"), h("p", {}, e.modelAnswer)),
      e.source ? h("a", { class: "source", href: sourceUrl(e.source), target: "_blank", rel: "noopener" }, "Source: " + sourceLabel(sourceUrl(e.source))) : null,
    );
    speak(`${e.head}. ${e.feedback || ""} ${e.modelAnswer}`, { force: true });
  }

  /**
   * cfg: {
   *   kicker, items, mode: "drill" | "mock" | "review",
   *   header(ctx) -> node|null      shown above each question (tally, progress)
   *   intro(item, prev) -> string   examiner line before the question (mock phases)
   *   commit(item, verdict, ctx)    called when the learner moves on
   *   done(ctx)
   * }
   */
  function runSession(cfg) {
    const ctx = { queue: usableItems(cfg.items.slice()), results: [], asked: 0, total: 0, prev: null };
    ctx.total = ctx.queue.length;
    // Free text when Claude grading is up, multiple choice when it is not.
    // choicePref remembers the learner's own switch for the rest of the session.
    let choicePref = null;

    mount(h("div", { id: "session" }));
    next();

    function next() {
      const item = ctx.queue.shift();
      if (!item) return cfg.done(ctx);
      ask(item, {});
    }

    function ask(item, opts) {
      stopListening();
      const host = $("#session");
      const quick = Boolean(opts.quick);
      const introLine = !quick && cfg.intro ? cfg.intro(item, ctx.prev) : null;
      const answerBox = h("div", { class: "stack" });
      const explainBtn = btn("Explain the last answer", explainLast, "ghost", { disabled: !lastExplain });
      const tags = [
        quick ? h("span", { class: "tag" }, "Quick check") : null,
        h("span", { class: "tag" }, BANK.categories[item.category] || item.category),
        item.severity === "critical" ? h("span", { class: "tag critical" }, "Automatic fail") : null,
        item.officeSpecific ? h("span", { class: "tag local" }, "Your test area") : null,
      ];

      fill(host, 
        cfg.header ? cfg.header(ctx, item) : null,
        introLine ? h("p", { class: "note", style: "margin-bottom:14px" }, "Examiner: ", h("em", {}, introLine)) : null,
        h("div", { class: "q-meta" }, tags),
        h("p", { class: "q-prompt", id: "q-prompt", tabindex: "-1" }, item.prompt),
        h("div", { style: "height:16px" }),
        h("button", { type: "button", class: "btn again", onclick: () => sayAgain(spoken()), html: ICON_SPEAK + "<span>Say that again</span>" }),
        h("div", { style: "height:10px" }),
        explainBtn,
        h("div", { style: "height:18px" }),
        answerBox,
      );
      $("#q-prompt", host).focus({ preventScroll: true });

      let choices = null;
      function spoken() {
        if (!choices) return item.prompt;
        return `${item.prompt} ${choices.map((c, i) => `${"ABC"[i]}. ${c.text}`).join(" ")}`;
      }

      function renderAnswer() {
        fill(answerBox, );
        if (useChoicesNow()) {
          choices ||= choicesFor(item);
          const list = h(
            "ol",
            { class: "choices", "aria-label": "Choices" },
            choices.map((c, i) =>
              h("li", {}, h("button", { type: "button", onclick: (e) => pick(c, e.currentTarget, list) }, h("b", {}, "ABC"[i]), h("span", {}, c.text))),
            ),
          );
          add(answerBox, 
            list,
            h("button", { type: "button", class: "btn quiet", onclick: dontKnow }, "I don't know, tell me"),
            quick && opts.forceChoices ? null : h("button", { type: "button", class: "btn quiet", onclick: () => ((choicePref = false), renderAnswer()) }, "Type my answer instead"),
          );
        } else {
          choices = null;
          const ta = h("textarea", { class: "input", id: "answer", rows: "3", placeholder: "Say it how you'd explain it to the examiner", "aria-label": "Your answer" });
          ta.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
              e.preventDefault();
              submit(ta.value);
            }
          });
          const mic = Rec
            ? h("button", { type: "button", class: "btn mic", "aria-pressed": "false", onclick: () => toggleMic(ta, mic), html: ICON_MIC + "<span>Speak</span>" })
            : null;
          add(answerBox, 
            ta,
            h("div", { class: "row" }, mic, btn("Check answer", () => submit(ta.value), "primary")),
            h("button", { type: "button", class: "btn quiet", onclick: dontKnow }, "I don't know, tell me"),
            h("button", { type: "button", class: "btn quiet", onclick: () => ((choicePref = true), renderAnswer()) }, "Show choices instead"),
          );
        }
      }
      function useChoicesNow() {
        if (quick && opts.forceChoices) return true;
        if (choicePref !== null) return choicePref;
        return !(AI.on && AI.failures < 3);
      }

      function toggleMic(ta, mic) {
        if (rec) {
          stopListening();
          mic.setAttribute("aria-pressed", "false");
          mic.lastElementChild.textContent = "Speak";
          return;
        }
        stopSpeaking();
        const ok = listen(
          (text) => handleSpoken(text, ta),
          (state, text) => {
            if (!mic.isConnected) return;
            if (state === "listening") {
              mic.setAttribute("aria-pressed", "true");
              mic.lastElementChild.textContent = "Listening";
            } else if (state === "hearing") ta.value = text;
            else if (state === "idle" || state === "error") {
              mic.setAttribute("aria-pressed", "false");
              mic.lastElementChild.textContent = "Speak";
              if (state === "error" && text === "not-allowed") toast("Microphone blocked. Type instead, or allow the mic.");
            }
          },
        );
        if (!ok) toast("Voice answers are not supported here. Type instead.");
      }

      function handleSpoken(text, ta) {
        const cmd = voiceCommand(text);
        if (cmd === "again") return sayAgain(spoken());
        if (cmd === "explain") return explainLast();
        if (cmd === "dontknow") return dontKnow();
        if (choices) {
          const m = text.toLowerCase().match(/\b(a|b|c|one|two|three|first|second|third)\b/);
          const idx = m ? { a: 0, one: 0, first: 0, b: 1, two: 1, second: 1, c: 2, three: 2, third: 2 }[m[1]] : -1;
          const buttons = answerBox.querySelectorAll(".choices button");
          if (idx >= 0 && buttons[idx]) return buttons[idx].click();
          return toast(`Heard "${text}". Say A, B or C.`);
        }
        if (ta) ta.value = text;
        submit(text);
      }

      async function submit(text) {
        text = (text || "").trim();
        if (!text) return $("#answer")?.focus();
        if (voiceCommand(text) === "dontknow") return dontKnow();
        stopListening();
        fill(answerBox, h("p", { class: "muted", "aria-live": "polite" }, "Checking..."));
        const result = await grade(item, text);
        feedback(result.verdict, result.feedback, { answer: text, offline: result.offline });
      }

      function pick(choice, el, list) {
        list.querySelectorAll("button").forEach((b) => (b.disabled = true));
        el.classList.add(choice.right ? "right" : "wrong");
        if (!choice.right) {
          const idx = choices.findIndex((c) => c.right);
          list.querySelectorAll("button")[idx]?.classList.add("right");
        }
        setTimeout(() => feedback(choice.right ? "correct" : "incorrect", choice.right ? "" : "That one would cost you on the test."), 350);
      }

      function dontKnow() {
        stopListening();
        feedback("dontknow", "No problem. Here it is. Then a quick check.");
      }

      function feedback(verdict, text, extra = {}) {
        let finalVerdict = verdict;
        const heads = { correct: "Correct", partly: "Partly right", incorrect: "Not quite", dontknow: "Here's the answer" };
        const head = h("p", { class: "verdict-head" }, heads[verdict]);
        const box = h(
          "div",
          { class: "verdict", "data-v": verdict, role: "status" },
          head,
          text ? h("p", {}, text) : null,
          extra.offline ? h("p", { class: "small muted", style: "margin-top:6px" }, "Offline check. Compare with the model answer.") : null,
          h("div", { class: "model" }, h("p", { class: "model-label" }, "Model answer"), h("p", {}, item.modelAnswer)),
          h("a", { class: "source", href: sourceUrl(item.source), target: "_blank", rel: "noopener" }, "Source: " + sourceLabel(sourceUrl(item.source))),
        );
        const override =
          verdict === "partly" || verdict === "incorrect"
            ? h("button", {
                type: "button",
                class: "btn quiet",
                onclick: (e) => {
                  finalVerdict = "correct";
                  box.dataset.v = "correct";
                  head.textContent = "Marked correct";
                  e.currentTarget.remove();
                  if (lastExplain) lastExplain.head = "Marked correct";
                },
              }, "I had it. Mark me correct")
            : null;
        const nextBtn = btn(verdict === "dontknow" ? "Quick check" : "Next", proceed, "primary");
        fill(answerBox, box, override, nextBtn);
        explainBtn.disabled = false;
        lastExplain = { prompt: item.prompt, head: heads[verdict], feedback: text, modelAnswer: item.modelAnswer, source: item.source };
        nextBtn.focus({ preventScroll: true });
        box.scrollIntoView({ block: "nearest", behavior: "smooth" });

        const say = verdict === "correct" ? `Correct. ${text || ""}` : `${heads[verdict]}. ${text || ""} ${verdict === "partly" && !extra.offline ? "" : "The answer: " + item.modelAnswer}`;
        speak(say, { onend: () => listenForNext() });

        function listenForNext() {
          if (!S.voice || !Rec || !nextBtn.isConnected) return;
          listen(
            (t) => {
              const cmd = voiceCommand(t);
              if (!nextBtn.isConnected) return;
              if (cmd === "next") proceed();
              else if (cmd === "again" || cmd === "explain") explainLast();
            },
            () => {},
          );
        }

        function proceed() {
          stopListening();
          stopSpeaking();
          if (!quick) {
            ctx.asked++;
            ctx.results.push({ item, verdict: finalVerdict });
            ctx.prev = item;
          }
          record(item, finalVerdict === "dontknow" ? "incorrect" : finalVerdict);
          if (cfg.commit) cfg.commit(item, finalVerdict, ctx, quick);
          if (verdict === "dontknow" && !quick) {
            const follow = item.followUp && byId(item.followUp);
            if (follow && follow.id !== item.id) return ask(follow, { quick: true });
            return ask(item, { quick: true, forceChoices: true });
          }
          next();
        }
      }

      renderAnswer();
      const line = (introLine ? introLine + " " : "") + spoken();
      speak(line, {
        onend: () => {
          // Hands-free: in voice mode, start listening once the question has been read.
          if (!S.voice || !Rec || rec) return;
          if (useChoicesNow()) {
            if (answerBox.querySelector(".choices button:not([disabled])")) listen((t) => handleSpoken(t, null), () => {});
            return;
          }
          const mic = answerBox.querySelector(".btn.mic");
          const ta = $("#answer");
          if (mic && ta && !rec) toggleMic(ta, mic);
        },
      });
    }
  }

  function startDrill(items, title) {
    items = usableItems(items);
    if (!items.length) return toast("No questions here yet.");
    current = { name: "session", arg: null };
    history.pushState({ name: "session" }, "", "#drill");
    const total = items.length;
    runSession({
      mode: "drill",
      items,
      header: (ctx) =>
        h(
          "div",
          {},
          h("span", { class: "kicker" }, title),
          h("div", { class: "progress" }, `${Math.min(ctx.asked + 1, total)} / ${total}`, h("div", { class: "progress-bar" }, h("span", { style: `width:${(Math.min(ctx.asked + 1, total) / total) * 100}%` }))),
        ),
      done: (ctx) => {
        const right = ctx.results.filter((r) => r.verdict === "correct").length;
        const missed = ctx.results.filter((r) => r.verdict !== "correct");
        mount(
          h("span", { class: "kicker" }, title),
          h("h1", { class: "title" }, `${right} of ${ctx.results.length} right`),
          missed.length
            ? h("p", { class: "lede" }, `${missed.length} added to your weak-spot review. You'll see them until you get each right twice in a row.`)
            : h("p", { class: "lede" }, "Clean sweep."),
          h(
            "div",
            { class: "stack" },
            missed.length ? btn("Review the misses now", () => go("review"), "primary") : null,
            btn("Another drill", () => go("drills"), missed.length ? "" : "primary"),
            btn("Back to menu", () => go("home"), "ghost"),
          ),
        );
        speak(`${right} of ${ctx.results.length} right.`);
      },
    });
  }

  // ======================================================================
  // Screen: mock test
  // ======================================================================
  screens.mock = () => {
    let length = 16;
    const group = h("div", { class: "choice-group", role: "group", "aria-label": "Mock length" });
    for (const [n, label] of [
      [12, "Short"],
      [16, "Standard"],
      [20, "Long"],
    ]) {
      group.append(
        h(
          "button",
          {
            type: "button",
            "aria-pressed": String(n === length),
            onclick: (e) => {
              length = n;
              group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
              e.currentTarget.setAttribute("aria-pressed", "true");
            },
          },
          `${label} (${n})`,
        ),
      );
    }
    const localN = localQuestions().length;
    mount(
      h("span", { class: "kicker" }, "Full mock test"),
      h("h1", { class: "title" }, "I'll be your examiner"),
      h("p", { class: "lede" }, "Check-in, the pre-drive check, leaving the lot, the drive, pulling over, backing and the return. One question at a time."),
      h(
        "div",
        { class: "card stack" },
        h("p", { html: md("Scored like the real sheet: **any critical error fails**, more than **15 errors** fails, and **4 or more** pre-drive misses fails.") }),
        h("p", { class: "small muted" }, "Error counts are scaled so a practice run feels like the real thing."),
        localN ? h("p", { class: "small" }, `Includes questions from your test area (${localN} available).`) : R.state === "working" ? h("p", { class: "small muted" }, "Local questions will join once research finishes.") : null,
        !AI.on ? h("p", { class: "small muted" }, "Answers are multiple choice right now. Type-in grading needs the online helper.") : null,
      ),
      h("div", { style: "height:16px" }),
      h("p", { style: "font-weight:700;margin-bottom:6px" }, "Number of driving scenarios"),
      group,
      h("div", { style: "height:16px" }),
      !S.voice && synth ? h("p", { class: "small muted", style: "margin-bottom:10px" }, "Tip: turn Voice on (top right) to hear the examiner.") : null,
      btn("Start mock test", () => runMock(length), "primary"),
    );
  };

  function buildMock(nDrive) {
    const pick = (phase, n) => shuffle(BANK.items.filter((i) => i.phase === phase)).slice(0, n);
    const arm = byId(ARM_IDS[Math.floor(Math.random() * ARM_IDS.length)]);
    const predrive = shuffle(PREDRIVE_ITEMS.filter((p) => !ARM_IDS.includes(p.id)).concat([{ ...arm, phase: "predrive" }]));
    const local = usableItems(localQuestions()).map((q) => ({ ...q, phase: "drive" }));
    const localPick = weightedPick(local, Math.min(5, local.length, Math.floor(nDrive / 3)));
    const drivePool = usableItems(BANK.items.filter((i) => !i.phase));
    const drive = shuffle([...localPick, ...weightedPick(drivePool, nDrive - localPick.length)]);
    return [
      ...pick("checkin", 2),
      ...predrive,
      ...pick("exit", 1),
      ...drive,
      byId("pull-over"),
      byId("pull-out"),
      byId("backing"),
      byId("return-dmv"),
    ]
      .filter(Boolean)
      .map((i) => ({ ...i, phase: i.phase || "drive" }));
  }

  function mockTally(results) {
    const t = { critical: 0, points: 0, predrive: 0, criticalItems: [], fix: [] };
    for (const { item, verdict } of results) {
      if (verdict === "correct") continue;
      const miss = verdict === "incorrect" || verdict === "dontknow";
      if (item.phase === "predrive") {
        t.predrive++;
        t.fix.push(item);
        continue;
      }
      if (item.severity === "critical") {
        if (miss) {
          t.critical++;
          t.criticalItems.push(item);
        } else t.points += 1;
      } else if (item.severity === "tip") t.points += miss ? 1 : 0;
      else t.points += miss ? 2 : 1;
      t.fix.push(item);
    }
    t.pass = t.critical === 0 && t.points <= 15 && t.predrive <= 3;
    return t;
  }

  function runMock(nDrive) {
    const items = buildMock(nDrive);
    const total = items.length;
    let warnedPredrive = false;
    current = { name: "session", arg: null };
    history.pushState({ name: "session" }, "", "#mock");
    runSession({
      mode: "mock",
      items,
      intro: (item, prev) => (!prev || prev.phase !== item.phase ? PHASES[item.phase]?.say : null),
      header: (ctx, item) => {
        const t = mockTally(ctx.results);
        const nodes = [
          h("div", { class: "progress" }, `${Math.min(ctx.asked + 1, total)} / ${total}`, h("div", { class: "progress-bar" }, h("span", { style: `width:${(Math.min(ctx.asked + 1, total) / total) * 100}%` }))),
          h("p", { class: "phase" }, PHASES[item.phase]?.label || "On the road"),
          h(
            "div",
            { class: "tally", "aria-label": "Score so far" },
            h("span", { class: t.critical ? "hot" : "" }, `Critical ${t.critical}`),
            h("span", { class: t.points > 15 ? "hot" : "" }, `Errors ${t.points}/15`),
            h("span", { class: t.predrive > 3 ? "hot" : "" }, `Pre-drive ${t.predrive}/3`),
          ),
        ];
        if (t.predrive > 3 && !warnedPredrive && item.phase !== "predrive") {
          warnedPredrive = true;
          nodes.push(h("p", { class: "note bad", style: "margin-bottom:12px" }, "In a real test, 4 pre-drive misses would end it here. Keep going for practice."));
        }
        return h("div", {}, nodes);
      },
      done: (ctx) => {
        const t = mockTally(ctx.results);
        const fixIds = [...new Set(t.fix.map((i) => i.id))];
        S.mocks.push({ at: Date.now(), pass: t.pass, critical: t.critical, points: t.points, predrive: t.predrive, total: ctx.results.length, missed: fixIds });
        save();
        const reasons = [];
        if (t.critical) reasons.push(`${t.critical} critical error${t.critical > 1 ? "s" : ""}`);
        if (t.points > 15) reasons.push(`${t.points} errors (15 allowed)`);
        if (t.predrive > 3) reasons.push(`${t.predrive} pre-drive misses (3 allowed)`);
        const fixItems = fixIds.map(byId).filter(Boolean);
        mount(
          h("span", { class: "kicker" }, "Mock test result"),
          h("p", { class: `big-verdict ${t.pass ? "pass" : "fail"}` }, t.pass ? "Pass" : "Fail"),
          h("p", { class: "lede", style: "margin-top:8px" }, t.pass ? `${t.points} errors, no critical errors.` : `Because of ${reasons.join(", ")}.`),
          h(
            "div",
            { class: "tally" },
            h("span", { class: t.critical ? "hot" : "" }, `Critical ${t.critical}`),
            h("span", { class: t.points > 15 ? "hot" : "" }, `Errors ${t.points}/15`),
            h("span", { class: t.predrive > 3 ? "hot" : "" }, `Pre-drive ${t.predrive}/3`),
          ),
          fixItems.length
            ? h(
                "div",
                { class: "card" },
                h("p", { style: "font-weight:700;margin-bottom:8px" }, "Fix these"),
                h(
                  "ol",
                  { class: "plain" },
                  fixItems.map((i) => h("li", {}, t.criticalItems.includes(i) ? h("strong", {}, "Critical: ") : null, i.prompt)),
                ),
              )
            : h("p", { class: "lede" }, "Nothing missed. Run another to be sure."),
          h("div", { style: "height:16px" }),
          h(
            "div",
            { class: "stack" },
            fixItems.length ? btn(`Review these ${fixItems.length} now`, () => startReview(fixIds), "primary") : null,
            btn("Take another mock", () => go("mock"), fixItems.length ? "" : "primary"),
            btn("Back to menu", () => go("home"), "ghost"),
          ),
        );
        speak(t.pass ? `You passed, with ${t.points} errors.` : `That would be a fail, because of ${reasons.join(", ")}. Let's review what you missed.`);
      },
    });
  }

  // ======================================================================
  // Screen: weak-spot review
  // ======================================================================
  screens.review = () => {
    const ids = Object.keys(S.review).filter((id) => byId(id));
    if (!ids.length) {
      mount(
        h("span", { class: "kicker" }, "Weak-spot review"),
        h("h1", { class: "title" }, "Nothing to review"),
        h("p", { class: "lede" }, "Anything you miss in drills or mocks lands here. It stays until you get it right twice in a row."),
        h("div", { class: "stack" }, btn("Take a mock test", () => go("mock"), "primary"), btn("Back to menu", () => go("home"), "ghost")),
      );
      return;
    }
    mount(
      h("span", { class: "kicker" }, "Weak-spot review"),
      h("h1", { class: "title" }, `${ids.length} to fix`),
      h("p", { class: "lede" }, "Each one comes back until you get it right twice in a row."),
      h("div", { class: "card" }, h("ul", { class: "plain" }, ids.slice(0, 12).map((id) => h("li", {}, byId(id).prompt, " ", h("span", { class: "muted small" }, `(${S.review[id].streak}/2)`)))), ids.length > 12 ? h("p", { class: "small muted", style: "margin-top:8px" }, `and ${ids.length - 12} more`) : null),
      h("div", { style: "height:16px" }),
      h("div", { class: "stack" }, btn("Start review", () => startReview(ids), "primary"), btn("Back to menu", () => go("home"), "ghost")),
      h("div", { class: "rule" }),
      findMorePanel(),
    );
  };

  function startReview(ids) {
    const items = usableItems(shuffle(ids.slice()).map(byId));
    if (!items.length) return go("review");
    current = { name: "session", arg: null };
    history.pushState({ name: "session" }, "", "#review");
    runSession({
      mode: "review",
      items,
      header: () => {
        const left = Object.keys(S.review).length;
        return h(
          "div",
          {},
          h("span", { class: "kicker" }, "Weak-spot review"),
          h("p", { class: "small muted", style: "margin-bottom:12px" }, `${left} left to master. Right twice in a row clears one.`),
        );
      },
      commit: (item, verdict, ctx, quick) => {
        if (quick) return;
        // Not mastered yet: bring it back after a couple of other questions.
        if (S.review[item.id] && !ctx.queue.some((q) => q.id === item.id)) {
          ctx.queue.splice(Math.min(2, ctx.queue.length), 0, item);
        }
      },
      done: () => {
        const left = Object.keys(S.review).length;
        mount(
          h("span", { class: "kicker" }, "Weak-spot review"),
          h("h1", { class: "title" }, left ? `${left} still to fix` : "All cleared"),
          h("p", { class: "lede" }, left ? "Come back to these later today." : "Every missed question is now right twice in a row."),
          h("div", { class: "stack" }, btn("See readiness", () => go("summary"), "primary"), btn("Back to menu", () => go("home"), "ghost")),
        );
        speak(left ? `${left} still to fix.` : "All cleared. Nice work.");
      },
    });
  }

  // ======================================================================
  // Screen: readiness summary
  // ======================================================================
  screens.summary = () => {
    const last = S.mocks[S.mocks.length - 1];
    const reviewN = Object.keys(S.review).length;
    const pdFast = BANK.predrive.filter((p) => S.predrive[p.id] === "fast").length;
    const pdTotal = BANK.predrive.length;
    const passes = S.mocks.filter((m) => m.pass).length;
    const cs = categoryStats();

    let level, cls;
    if (!S.mocks.length) (level = "No mock yet"), (cls = "");
    else if (last.pass && reviewN === 0 && pdFast === pdTotal) (level = "Ready"), (cls = "pass");
    else if (last.pass) (level = "Almost there"), (cls = "");
    else (level = "Not yet"), (cls = "fail");

    const todo = [];
    if (!S.mocks.length) todo.push(["Take a full mock test", () => go("mock")]);
    if (reviewN) todo.push([`Clear ${reviewN} weak spot${reviewN > 1 ? "s" : ""}`, () => go("review")]);
    if (pdFast < pdTotal) todo.push([`Get all ${pdTotal} pre-drive items under 2 seconds (${pdFast} now)`, () => go("predrive")]);
    const weak = Object.entries(cs).filter(([k, v]) => k !== "pre-drive" && v.seen >= 3 && v.right / v.seen < 0.7);
    for (const [k] of weak) todo.push([`Drill ${BANK.categories[k].toLowerCase()}`, () => startDrill(shuffle(usableItems(allItems().filter((i) => i.category === k))).slice(0, 10), BANK.categories[k])]);
    if (S.mocks.length && last.pass && passes < 2) todo.push(["Pass one more mock to be sure", () => go("mock")]);

    mount(
      h("span", { class: "kicker" }, "Readiness"),
      h("p", { class: `big-verdict ${cls}` }, level),
      h(
        "p",
        { class: "lede", style: "margin-top:8px" },
        S.mocks.length ? `${S.mocks.length} mock${S.mocks.length > 1 ? "s" : ""}, ${passes} passed. Last: ${last.pass ? "pass" : "fail"}, ${last.points} errors, ${last.critical} critical.` : "Take a mock test to see where you stand.",
      ),
      todo.length
        ? h("div", { class: "stack" }, h("p", { style: "font-weight:700" }, "Next steps"), todo.map(([label, fn], i) => btn(label, fn, i === 0 ? "primary" : "")))
        : h("p", { class: "note" }, "Nothing left on the list. Rest well and arrive early."),
      h("div", { class: "rule" }),
      h("p", { style: "font-weight:700" }, "By topic"),
      h(
        "ul",
        { class: "bars" },
        Object.entries(cs)
          .filter(([, v]) => v.total)
          .map(([k, v]) => {
            const pct = v.seen ? Math.round((v.right / v.seen) * 100) : 0;
            return h(
              "li",
              {},
              h("div", { class: "bar-top" }, h("span", {}, BANK.categories[k]), h("span", { class: "muted" }, v.seen ? `${v.right}/${v.seen} right` : "not tried")),
              h("div", { class: "bar" }, h("span", { class: pct < 70 && v.seen ? "low" : "", style: `width:${pct}%` })),
            );
          }),
      ),
      h("div", { class: "rule" }),
      h(
        "button",
        {
          type: "button",
          class: "btn quiet",
          onclick: () => {
            if (!confirm("Clear all progress on this device? Your office stays.")) return;
            const keep = { office: S.office, testDate: S.testDate, hasCar: S.hasCar, hasDriver: S.hasDriver, voice: S.voice };
            S = Object.assign(defaults(), keep);
            save();
            go("home");
          },
        },
        "Reset progress",
      ),
    );
    speak(`Readiness: ${level}.`);
  };

  // ======================================================================
  // Screen: local tips (research)
  // ======================================================================
  screens.local = () => {
    if (R.state !== "ready") {
      const msg = {
        working: ["Still researching", "Looking up sample routes and hazards near your office. It can take a minute or two. Keep practising; I'll tell you when it's ready."],
        failed: ["Local research didn't work this time", "Everything else still works with the built-in questions."],
        off: ["Local research is off", "The online helper isn't set up here, so the app uses its built-in content. Everything else works."],
        idle: ["No research yet", "Pick an office to start."],
      }[R.state];
      mount(
        h("span", { class: "kicker" }, "Local tips"),
        h("h1", { class: "title" }, msg[0]),
        h("p", { class: "lede" }, msg[1]),
        h(
          "div",
          { class: "stack" },
          R.state === "failed" ? btn("Try again", () => (startResearch(true), go("local")), "primary") : null,
          btn("Back to menu", () => go("home"), R.state === "failed" ? "" : "primary"),
        ),
      );
      return;
    }
    const d = R.data;
    const link = (url) => h("a", { class: "source", href: url, target: "_blank", rel: "noopener" }, sourceLabel(url));
    const featureNames = {
      "railroad-crossing": "Railroad crossing",
      "flashing-signal": "Flashing signal",
      "flashing-yellow-arrow": "Flashing yellow arrow",
      "pedestrian-beacon": "Pedestrian beacon",
      "school-zone": "School zone",
      "one-way-street": "One-way street",
      "bike-lane": "Bike lane",
      "sharp-turn": "Sharp turn",
      "multi-lane-road": "Multi-lane road",
      freeway: "Freeway",
      "downtown-grid": "Downtown grid",
      "four-way-stop": "Four-way stop",
      other: "Other",
    };
    const nothing = !d.routes.length && !d.features.length && !d.failPoints.length;

    mount(
      h("span", { class: "kicker" }, "Local tips"),
      h("h1", { class: "title" }, d.office.name),
      d.office.address ? h("p", { class: "muted", style: "margin-bottom:12px" }, d.office.address) : null,
      h("p", { class: "note", style: "margin-bottom:16px" }, "Unofficial. Gathered from public pages. The examiner picks the route on the day."),
      d.summary ? h("p", { class: "lede" }, d.summary) : null,
      nothing ? h("p", { class: "lede" }, "No reliable local details were found for this office. Use the built-in questions; they cover what examiners mark everywhere.") : null,
      d.routes.length
        ? h(
            "section",
            {},
            h("h2", { class: "card-title", style: "margin-top:12px" }, "Sample routes"),
            d.routes.map((r) =>
              h("div", { class: "card", style: "margin-bottom:10px" }, h("p", { style: "font-weight:700" }, r.name), h("p", { class: "small" }, r.streets.join(" → ")), r.notes ? h("p", { class: "small muted", style: "margin-top:6px" }, r.notes) : null, link(r.source)),
            ),
          )
        : null,
      d.features.length
        ? h(
            "section",
            {},
            h("h2", { class: "card-title", style: "margin-top:20px" }, "Watch for"),
            h(
              "ul",
              { class: "bars" },
              d.features.map((f) => h("li", {}, h("p", {}, h("strong", {}, featureNames[f.type] || "Note"), ": ", f.name), f.detail ? h("p", { class: "small muted" }, f.detail) : null, link(f.source))),
            ),
          )
        : null,
      d.failPoints.length
        ? h(
            "section",
            {},
            h("h2", { class: "card-title", style: "margin-top:20px" }, "Where people lose points here"),
            h("ul", { class: "bars" }, d.failPoints.map((f) => h("li", {}, h("p", {}, f.detail), link(f.source)))),
          )
        : null,
      d.notFound?.length
        ? h("details", { class: "fold", style: "margin-top:20px" }, h("summary", {}, "Not found"), h("div", {}, h("ul", { class: "plain small" }, d.notFound.map((n) => h("li", {}, n)))))
        : null,
      d.sources.length
        ? h(
            "details",
            { class: "fold" },
            h("summary", {}, `Sources (${d.sources.length})`),
            h("div", {}, h("ol", { class: "plain small" }, d.sources.map((s) => h("li", {}, h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.title || s.url))))),
          )
        : null,
      h("div", { style: "height:18px" }),
      h(
        "div",
        { class: "stack" },
        localQuestions().length ? btn(`Drill ${plural(localQuestions().length, "local question")}`, () => startDrill(shuffle(localQuestions().slice()), "Local questions"), "primary") : null,
        btn("Back to menu", () => go("home"), "ghost"),
      ),
      h("p", { class: "small muted", style: "margin-top:12px" }, `Researched ${new Date(d.researchedAt).toLocaleDateString()}.`),
    );
  };

  // ======================================================================
  // Boot
  // ======================================================================
  updateVoiceBtn();
  if (S.office) startResearch();
  updateChip();
  const initial = location.hash.slice(1);
  const startScreen = S.office ? (initial in screens && initial !== "setup" ? initial : "home") : "setup";
  history.replaceState({ name: startScreen }, "", location.href);
  render(startScreen, null, false);
})();
