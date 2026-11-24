// POST { topic, office? } -> { questions: [...] }  fresh, sourced questions on a weak topic
import { send, readBody, sameSite, rateLimit, clip, slug } from "../server/http.js";
import { getJSON, setJSON } from "../server/store.js";
import { aiEnabled, findMoreQuestions } from "../server/claude.js";

const TTL = Number(process.env.ROAD_TEST_CACHE_DAYS || 4) * 86400;
const PER_IP_PER_HOUR = Number(process.env.ROAD_TEST_MORE_PER_HOUR || 6);
const GLOBAL_PER_DAY = Number(process.env.ROAD_TEST_MORE_PER_DAY || 60);

export const config = { maxDuration: 180 };

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  if (!sameSite(req)) return send(res, 403, { error: "Forbidden" });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: "Bad JSON" });
  }
  const topic = clip(body.topic, 120);
  const office = clip(body.office, 120);
  if (topic.length < 3) return send(res, 400, { error: "Topic required" });

  const cacheKey = slug(`${topic} ${office}`);
  const key = `more:v1:${cacheKey}`;
  const cached = await getJSON(key).catch(() => null);
  if (cached) return send(res, 200, { questions: cached, cached: true });

  if (!aiEnabled()) return send(res, 503, { error: "Question search is off" });

  const ip = await rateLimit(req, "more", PER_IP_PER_HOUR, 3600);
  const all = await rateLimit(req, "more", GLOBAL_PER_DAY, 86400, "global");
  if (!ip.ok || !all.ok) return send(res, 429, { error: "Too many requests" }, { "Retry-After": String(ip.retryAfter) });

  try {
    const questions = await findMoreQuestions(topic, office, cacheKey);
    if (questions.length) await setJSON(key, questions, TTL).catch(() => {});
    return send(res, 200, { questions, cached: false });
  } catch (err) {
    console.error("more failed", err?.status || "", err?.message);
    return send(res, 502, { error: "Could not find more questions" });
  }
}
