# ahmed-fahad

Personal site. Posts are single, self-contained HTML pages: inline CSS, inline
generated SVG illustrations and a little vanilla JS.

```
src/posts/*.html      post templates
src/pages/*.html      standalone pages (apps), built the same way
src/css, src/js       styles and behaviour, inlined at build time
src/road-test/        Road Test Coach data (question bank, DMV offices)
illustrations/*.mjs   generators for the etched SVG illustrations
api/*.js              serverless API routes (Vercel)
server/*.js           shared server code for the API routes
scripts/              dev server, bank checker, office list refresh
site/<name>/index.html   built output (deploy this folder)
docs/design-reference.md design system notes
```

Build with `npm run build` (Node 18+). It validates the question bank, then
writes `site/`.

---

## Road Test Coach (`/road-test`)

A mobile-first practice app for the California DMV behind-the-wheel test:
what to expect, the pre-drive controls drill, scenario drills, a full mock
test with an examiner voice, and a weak-spot review.

### How it fits the site

The site was static HTML with no hosting config, so rather than move it to
Next.js the app follows the same pattern as the posts: one self-contained page
(`src/pages/road-test.html` -> `site/road-test/index.html`) with the question
bank and office list inlined. The few things that need a server are plain
Vercel functions in `api/`. `vercel.json` sets `site/` as the output folder,
so the post stays at `/gtm-playbook` and the app is at `/road-test`.

Everything works with no API key: the built-in bank, offline grading
(keyword check with a "mark me correct" override, or multiple choice), the
mock, review and readiness summary. Progress is stored in the browser's
localStorage only.

### Run locally

```
npm install
npm run dev            # builds, then serves http://localhost:3000/road-test
```

`scripts/dev-server.mjs` serves `site/` and runs `api/*.js` the way Vercel
does. Put keys in `.env.local` (git-ignored). Without a key, it runs in
built-in-content mode.

### Deploy (Vercel)

1. Import the repo in Vercel. `vercel.json` already sets the build command
   (`npm run build`) and output directory (`site`).
2. Add the environment variables below.
3. Optional but recommended: add an Upstash Redis store from the Vercel
   Marketplace (Storage -> Upstash for Redis). It sets `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` automatically. Without it, cache and rate limits are
   per function instance only.

Research can take one to three minutes, so `api/research.js` is allowed
300 seconds. That needs Fluid Compute, which is on by default for new
projects (including Hobby).

### Environment variables

| Name | Required | Default | What it does |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | for AI features | - | Grading, office research, "Find more questions". Server-side only. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | recommended | - | Shared cache + rate limits (Upstash Redis). `UPSTASH_REDIS_REST_URL` / `_TOKEN` also work. |
| `ROAD_TEST_AI` | no | on | Set to `off` to disable all Claude calls. |
| `ROAD_TEST_RESEARCH_MODEL` | no | `claude-sonnet-5-5` | Model for research and "find more". |
| `ROAD_TEST_GRADE_MODEL` | no | `claude-haiku-5-5` | Model for grading answers. |
| `ROAD_TEST_CACHE_DAYS` | no | 4 | How long office research and "find more" results are cached. |
| `ROAD_TEST_RESEARCH_PER_HOUR` | no | 4 | New research runs per IP per hour (cache hits are free). |
| `ROAD_TEST_RESEARCH_PER_DAY` | no | 40 | New research runs per day across everyone. |
| `ROAD_TEST_MORE_PER_HOUR` / `_PER_DAY` | no | 6 / 60 | Same, for "Find more questions". |
| `ROAD_TEST_GRADES_PER_HOUR` / `_PER_DAY` | no | 150 / 3000 | Same, for grading. |

### API routes

| Route | Does |
|---|---|
| `GET /api/health` | `{ ai, sharedCache }`. The page uses it to choose typed answers or multiple choice. |
| `POST /api/research` | Researches an office (cached). Returns `ready` data, `pending` (someone else is researching it; poll), or `unavailable`. |
| `POST /api/grade` | Grades one free-text answer: `{ verdict: correct/partly/incorrect, feedback }`. |
| `POST /api/more` | Fresh, sourced questions on a topic, merged into the learner's session. |

All POST routes refuse cross-site requests and are rate-limited per IP plus a
global daily cap, so a shared link cannot run up the bill.

**Research** is two calls. First, Sonnet uses the `web_search_20260209` and
`web_fetch_20260209` server tools to gather notes with URLs. Second, it turns
those notes into JSON with structured outputs. Every route, hazard, fail point
and question must cite a URL that the search actually returned; anything else
is dropped. If nothing reliable turns up, the page says so and uses the
built-in content. Sonnet calls use the server-side refusal fallback
(`fallbacks: "default"`), so a false-positive safety decline does not fail
the request. Grading uses Haiku with structured output and low effort.

### Adding questions

Edit `src/road-test/bank.json`, then run `npm run check` (also run by the
build). One question looks like this:

```json
{
  "id": "four-way-same-time-right",
  "category": "four-way",
  "severity": "critical",
  "highRisk": true,
  "prompt": "You and another car stop at a four-way stop at the same moment. They are on your right. Who goes?",
  "modelAnswer": "The car on the right goes first, so they go. Then I look left, right, left and go.",
  "keyPoints": ["car on the right goes first", "they go, then you"],
  "distractors": ["You go first because you are on their left.", "Whoever is bigger goes first."],
  "followUp": "four-way-same-time-left",
  "source": "laws"
}
```

- `category`: a key from `categories` in the same file.
- `severity`: `critical` (automatic fail), `points` (scored error) or `tip`.
- `keyPoints`: what an answer must contain for full credit. Keep them short;
  the offline grader matches their words.
- `distractors`: two plausible wrong answers, used for multiple choice.
- `followUp`: optional id asked as a "quick check" after "I don't know".
- `source`: a key from `sources` or a full URL. Paraphrase; don't copy the handbook.
- `phase`: leave it out for ordinary driving scenarios. Use `checkin`, `exit`,
  `pullover`, `backing` or `return` for the fixed parts of the mock.
- `highRisk`: true weights it up in mocks and mixed drills.

"What to expect" cards live in `expect` and `mistakes`; pre-drive items
(9 to 14) live in `predrive`.

### Mock scoring

The mock follows the real score sheet: any critical error fails, more than
15 errors fails, 4 or more pre-drive misses fails. A practice mock has fewer
items than a real drive, so errors are scaled: a missed `points` question
counts 2, a partly-right one 1; a partly-right `critical` question counts 1
error; a missed `tip` counts 1.

### Office list

`src/road-test/offices.json` comes from the DMV's public field-office feed,
minus business-only centres, commercial test centres and closed offices.
Refresh it with `npm run offices`.
