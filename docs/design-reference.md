# Design reference: the "Compute Islands" style

Reference: <https://www.coreauto.com/hitchhikers-guide-to-training-on-compute-islands>
(Core Automation, Nov 2026). This file breaks down how that page is built, so we can
build the GTM post the same way. **We copy the system and technique, not their
assets:** every illustration, character and screenshot on our page is original.

---

## 1. What makes it feel the way it does

1. **Paper, ink, one blue.** Warm off-white page, near-black ink, a single electric
   blue accent. A muted gold (`#c49a3e`) appears *only* as an interaction state
   ("warming up" under the pointer) or a highlighted result.
2. **A narrow reading column with figures that break out of it.** Text is 720px, figures
   are 980px, the hero is 1120px, all centered on the same axis.
3. **Etched, hand-engraved illustrations made from SVG.** Thin black outlines, hatching
   patterns for shading, stippled star fields, dashed arcs. They look like a technical
   engraving, but they're vector code, so they're crisp and can move and react.
4. **Everything is a little alive.** Tiny looping SMIL animations (cats breathing and
   blinking, steam, birds, a satellite orbiting), plus pointer interactions that warm up
   fast and cool down slowly.
5. **Restraint.** No cards with shadows, no gradients, no rounded UI. Hierarchy comes from
   rules (1–2px lines), weight, uppercase letter-spaced labels and whitespace.
6. **Easter eggs that reward curiosity.** Click a cat and a tiny "mrrp?" floats up.
   Hover the globe and a soft lens reveals hidden sea life.

---

## 2. Design tokens (exact values)

```css
:root {
  --page-bg:  #f5f3ee;   /* warm paper */
  --ink:      #141414;   /* text + all illustration strokes */
  --ink-2:    #3b3a36;   /* secondary text (dek, table cells) */
  --muted:    #6d6a62;   /* dates, captions, cite */
  --rule:     #d9d4c8;   /* hairlines */
  --blue:     #2f4bff;   /* the only accent */
  --code-bg:  #ece9e1;   /* callouts + code */
  /* interaction-only */
  --gold:     #c49a3e;   /* "lit" fill */
  --gold-bg:  #f3e6c4;   /* "lit" box fill */

  --reading-width: 720px;
  --wide-width:    980px;
  --hero-width:    1120px;
  --sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
```

Secondary palette, used only inside multi-series diagrams (butterfly schedule):
`#2f4bff #c49a3e #c9746f #3f8f86 #7b62c9 #5c8a3a #d07a3a #4f6b8a`.

### Typography

| Element | Size / weight | Notes |
|---|---|---|
| Body | 20px / 1.55, 400 | `letter-spacing: -0.008em`, antialiased. 17px on mobile |
| Brand wordmark | 32px / 700, blue | `letter-spacing: -0.031em`, logo mark via CSS mask |
| Date / author | 15px, muted | Author line: "Name · 18 min read" |
| H1 title | 34px / 1.15, 700 | `letter-spacing: -0.02em`, `text-wrap: balance`. 27px on mobile |
| Dek | 22px / 1.4, ink-2 | One sentence |
| H2 section | 26px, 700 | `-0.015em`. 22px on mobile |
| H3 subsection | 20px, 700 | |
| Pull quote | 24px / 1.35 | 2px blue left rule |
| Labels | 12–13px / 700, UPPERCASE | `letter-spacing: 0.08em` (callout label, tier name, table head) |
| Captions | 15px / 1.5, muted | Kept at reading width even under wide figures |
| Illustration labels | mono, 11–13px | Lowercase, `·` separators ("sync every 50 steps") |
| Butterfly title | *italic serif* | The only serif on the page: a one-off "plate title" |

### Page chrome

- `body { border-top: 26px solid var(--blue); }`: a thick blue band at the top (14px on mobile).
- Brand centered, blue, 64px above / 72px below.
- Footer: right-aligned email + handle in grey `#a3a09a`, bold 18px.
- `::selection` is blue on white. Links underline with a 3px offset and turn blue on hover.

### Spacing rhythm

Paragraphs 24px apart · figures 48px top and bottom · sections 88px apart (64px on mobile) ·
callouts 32×36px padding · TOC 64px top.

---

## 3. Page anatomy (top to bottom)

1. Blue top band → centered brand wordmark
2. **Header:** date → H1 → dek → "Author · N min read"
3. **Hero illustration:** full 1120px, etched, animated, interactive
4. **tl;dr lead paragraph** (bold "tl;dr:")
5. **Result card:** the headline chart on a black background (`.result-card`)
6. **Table of contents:** "Sections", numbered blue markers, hairline rules above and below
7. **Sections:** each with an H2, prose and at least one figure
8. **CTA paragraph** with a rule above it ("write to hello@…")
9. **Notes:** footnotes with ↩ back-links. **BibTeX** block (we'd swap it for "Tools mentioned")
10. Footer contact

---

## 4. Component catalog

### 4.1 Pull quote with screenshot hover preview (the "tweet" effect)

This isn't a Twitter embed. It's a **screenshot of the post** in a tooltip:

```html
<blockquote class="quote has-preview" cite="https://x.com/…">
  <p><a class="quote-link" href="https://x.com/…" aria-describedby="p1">“Quote text.”</a></p>
  <cite><a href="https://x.com/…">Name on X, Oct 25, 2026</a></cite>
  <a class="quote-preview" id="p1" role="tooltip" href="https://x.com/…" tabindex="-1">
    <img src="post-screenshot.jpg" alt="…" loading="lazy">
    <span class="quote-preview-open">Open on X ↗</span>
  </a>
</blockquote>
```

- The quote text has a 1px blue underline (`background-size: 100% 1px`). On hover, the
  underline grows into a full 14%-blue highlight (`background-size: 100% 100%`, 200ms).
- The preview is absolutely positioned **above** the quote (`bottom: calc(100% + 12px)`),
  440px wide, on a black 6px frame with 14px radius and a two-layer shadow. It fades and
  slides up 6px over 180ms. `visibility` is delayed so the fade-out finishes first.
- It also opens on `:focus-within`, so it works from the keyboard.
- **Touch:** first tap opens the preview (the "Open on X ↗" label appears), a second tap
  follows the link, and tapping elsewhere closes it. This takes about 15 lines of JS.
- The screenshot is dark mode, which makes it pop against the paper.

### 4.2 Callout ("Our position")

`--code-bg` fill, 1px rule border, **3px blue top border**, uppercase blue label, a bold
22px lead sentence, then a numbered list with bold blue markers.

### 4.3 Marker rows

A big blue marker (`1`, `A`, `i.`) floated left, a bold row title, then a plain paragraph.
It's used for "two problems", "two families" and "four strategies". It's more editorial
than a bullet list.

### 4.4 Tier cards (three columns)

Each column has a 2px ink top rule, a small interactive SVG, an UPPERCASE name, a bold
lead and a justified, hyphenated description. Rows line up across columns using CSS
`subgrid`. They stack on mobile.

### 4.5 Collapsible table

- Shows the first 4 rows. Rows 5 and 6 fade to 45% and 16% opacity and are clickable.
- A pill button reads "Show all 16 entries ↓" / "Show fewer ↑".
- Table head is 12px uppercase muted. The "work" column is bold ink, dates are tabular
  muted, and the "type" column turns blue for one category.

### 4.6 Result card

A chart image on a solid `--ink` background, used for the single most important number.
The chart uses a dark theme with white lines, a gold star and a zoom-inset box.

### 4.7 Code / schedule block

`--code-bg`, a 1px rule border, mono 14px/1.65. Comments are blue. They use it for
pseudo-schedules, not real code. For us it fits **sending math, timelines and sequences**.

### 4.8 Footnotes

A superscript blue number links to `#note-n`, and each note ends with a ↩ link back.

### 4.9 Unused components that are already in their CSS

- `.margin-anim`: a small 150px animation in the **left margin** beside a section heading.
  It sits inline on screens narrower than 1120px.
- `.case-card`: a black inverted card with a small animation on the left and a title and
  text on the right. Good for "Case study: Eddie at NAB".

---

## 5. The illustration system

### 5.1 How the etched look is built

Everything is inline SVG, drawn in `#141414` on the paper colour. There are no images
except the one GIF and the charts.

**Hatching uses `<pattern>` fills**, defined per illustration:

```svg
<pattern id="h"  width="5.5" height="5.5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
  <line x1="0" y1="0" x2="0" y2="5.5" stroke="#141414" stroke-width="0.75"/>
</pattern>
<pattern id="x"  …same + a horizontal line at 0.7× weight…/>   <!-- cross-hatch: darkest -->
<pattern id="hd" width="3.3" … rotate(48)>…</pattern>          <!-- dense hatch: mid-dark -->
```

So the tonal scale is **paper → hatch → dense hatch → cross-hatch → solid ink**.

- **Shading uses masks.** A circle minus an offset circle gives a crescent shadow on a
  planet or globe, which is then filled with hatch.
- **Water / ground:** many thin horizontal wavy lines whose spacing tightens toward the
  viewer.
- **Skies:** random dots, small `+` crosses, and blue "m" birds (`〰`) that bob.
- **Connections:** dashed arcs, 1px. Blue arcs mean "fast/good"; dotted means "intermittent".
- **Accent use:** blue appears only on small things like satellite panels, server LEDs,
  birds and highlighted links. The illustration stays about 95% black and white.
- **Labels:** mono, lowercase, with leader lines to the object. Section-style labels are
  UPPERCASE, letter-spaced and bold.
- **Line weight:** 0.75–1.2px main strokes, 0.3–0.5 for detail. Nothing heavy except
  solid black accents (doors, the crane counterweight).

**The SVGs are clearly generated by a script, not drawn by hand.** Stroke widths like
`0.5249999999999999` (= 0.75 × 0.7) and keyTimes like `0.3639;0.4471` give it away. The
page weighs ~800KB, almost all of it SVG (749 circles, 642 paths, 450 rects). **We should
do the same:** write small generator scripts that emit the SVG (hatch helpers, a star
field, a wave field, reusable "props"), then inline the output.

### 5.2 How it moves

All ambient motion is **SMIL** (`<animate>`, `<animateTransform>`, `<animateMotion>`),
with no JS and no animation library:

- Breathing: translate `0 0 → 0 -0.8 → 0` over 2.2s, with spline easing `0.45 0 0.55 1`.
- Tail swish and head tilt: small rotate loops of 7–9s around a pivot.
- Blinking: `ry` of an eye ellipse squashes for about 5% of an 8s loop.
- Pose changes: several poses stacked, toggled with discrete `opacity` keyTimes over a
  59–132s loop. Negative `begin` desynchronises them, so it never looks like a loop.
- Travel: `animateMotion` along a dashed path (a satellite, a packet).
- Steam and twinkles: opacity pulses.
- Accessibility: `svg.pauseAnimations()` runs when `prefers-reduced-motion` is on, and is
  watched live.

### 5.3 How it reacts to the pointer

One shared pattern runs through all of it: **convert the pointer to SVG coordinates and
toggle a class**:

```js
const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
const pt = p.matrixTransform(svg.getScreenCTM().inverse());
```

- **Warm-up tiles:** a 2×2 patch of squares under the cursor turns gold and scales 1.08.
  **It warms fast (160ms) and cools slowly (900ms)**, so the pointer leaves a fading
  trail. That asymmetric transition is the signature feel.
- **Cluster hosts:** the server box under the pointer fills pale gold and its "GPU dots"
  scale 1.35.
- **Schedule diagram:** hovering a column recolours the groups that have mixed by that
  stage. Hovering a start node traces that node's path in its own colour. Each state
  stores the original colours and resets them on `pointerleave`.
- **Reveal lens:** a hidden layer is masked by a circle with a radial gradient. On hover
  the circle eases (`cur += (goal-cur)*0.12` per frame) to r≈95–120 and follows the
  cursor. On leave it shrinks back to 0, revealing hidden sea life.
- **Clickable characters:** a click spawns an SVG `<text>` with a random tilt that pops,
  floats up 20px and fades out over 1.8s. Each character type has its own word list and
  never repeats twice in a row.
- **Touch:** `pointerdown` mirrors `pointermove`, and `touch-action: manipulation` is set.
  The cursor is `crosshair` over interactive figures.

### 5.4 Figure types they used

| Figure | Type | Interaction |
|---|---|---|
| Hero: floating server islands over the sea, crane, planet, satellite, cats | Etched scene | Ambient animation + clickable cats |
| Committed / Reservable / Spot | Tiny tile grids (3 cards) | Warm-up tiles |
| US ↔ Asia clusters | Technical diagram (boxes, dot GPUs, dashed arcs, mono labels) | Hosts warm under the pointer |
| Butterfly mixing globe | GIF plus an SVG overlay | Reveal lens (hidden sea life) |
| Butterfly schedule | Node-link diagram | Hover a stage or a cell to recolour or trace |
| Orbit | Etched Earth, satellite formations, sun | Ambient + reveal lens |
| Training results | Chart PNG in a dark result card | none |

---

## 6. Applying it to our GTM post

Our version: **same paper, ink and single-blue system; our own wordmark (Ahmed Fahad); our
own world and characters.** Proposed figure for each section:

| Section | Figure | Interaction | Component |
|---|---|---|---|
| **Hero** | Etched "GTM town": a post-office island with rows of mailboxes, a LinkedIn radio tower, a billboard island showing phone screens, a trade-show tent with bunting. Dashed arcs carry envelopes between islands, and most envelopes drop into the sea | Ambient (envelopes on `animateMotion`, flags, smoke, birds). **Characters: carrier pigeons** (click → "coo", "reply?", "unsubscribe", "…seen") | Hero |
| **Hook: the odds** | 1,000 tiny envelope tiles; about 5 are blue (replies) and 1 is gold (a meeting) | Warm-up tiles | Wide figure |
| **ICP** | Two tier cards: ICP 1 (etched NLE timeline) and ICP 2 (etched phone on a tripod) | Warm-up on the icon | Tier cards |
| **Email infrastructure** | **The calculator.** An etched diagram: domain buildings → mailbox inboxes → stacks of envelopes. Sliders for domains / inboxes per domain / sends per inbox / days per week. The output (sends/week, expected replies) updates live, and the diagram redraws with the counts | Sliders + hosts-style warm-up | Wide figure + mono readout |
| **Warm-up timeline** | Mono schedule block: `week 0 buy domains · weeks 1–3 warm-up · week 4 first send` | none | Code block |
| **Email copy rules** | Callout: "The rules" (plain text / short / first person / relevant). Optional: two etched envelopes, "HTML promo" landing in a spam bin and "plain text" landing in the inbox | Click to flip | Callout |
| **Leads** | Marker rows **A. Managed** (Unify on Exa) / **B. DIY** (Clay / Exa + your own infrastructure) and a collapsible tool table | Show-all toggle | Rows + table |
| **LinkedIn** | Schedule-style flow: keyword → connection request + note → accepted → follow-up → reply → meeting, with funnel counts | Hover a stage to light it and its survivors | Node-link diagram |
| **LinkedIn proof** | Dashboard screenshot ("12 today") | none | Dark result card |
| **Paid social** | Quote from Hector (Wispr Flow) **with a hover preview of the post**. Then a grid of 30 phone-shaped tiles (one creator's month); a "run ads" pass lights the winners gold | Warm-up + click | Quote preview + tile grid |
| **Events** | Etched trade-show booth (banner, iPad kiosk, tiny crowd, coffee steam) as a `.case-card`. Then a before / during / after marker row, a cost table, and an etched map with pins for NAB Vegas, NAB NY, IBC Amsterdam and Cine Gear LA | Hover a pin for the show name | Case card + rows + map |
| **Closing** | "If you're starting from zero" numbered callout, then a CTA, Notes (tool links, "not affiliated") and the footer | none | Callout + notes |

**Screenshots we'll need from you (for the hover previews / result cards):**
Hector's playbook post, the LinkedIn automation dashboard, and optionally a Smartlead
campaign stats view and a booth photo. A photo could be traced into an etched illustration.

---

## 7. Build approach

- **One static HTML page per post**, like the reference: inline CSS, inline SVG, a few
  small vanilla JS modules (≤15KB total). No framework.
- `illustrations/` holds the generator scripts (Node) that emit each SVG. They share
  helpers: `hatch(id, angle, gap, weight)`, `crossHatch`, `stars(n, seed)`,
  `waves(y0, y1)`, `dashedArc(a, b)`, and prop builders (`mailbox`, `server`, `tent`,
  `pigeon`, …). A seeded RNG keeps the output stable between builds.
- Accessibility parity with the reference: `role="img"` and a descriptive `aria-label` on
  every SVG, `prefers-reduced-motion` support, keyboard-reachable quote previews, and
  print styles.
- Responsive: 760px and 1120px breakpoints, figures scale through `viewBox`, and
  touch-tap fallbacks for every hover.
