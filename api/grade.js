// POST { prompt, modelAnswer, keyPoints[], answer } -> { verdict, feedback }
import { send, readBody, sameSite, rateLimit, clip } from "../server/http.js";
import { aiEnabled, gradeAnswer } from "../server/claude.js";

const PER_IP_PER_HOUR = Number(process.env.ROAD_TEST_GRADES_PER_HOUR || 150);
const GLOBAL_PER_DAY = Number(process.env.ROAD_TEST_GRADES_PER_DAY || 3000);

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  if (!sameSite(req)) return send(res, 403, { error: "Forbidden" });
  if (!aiEnabled()) return send(res, 503, { error: "Grading is off" });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: "Bad JSON" });
  }
  const prompt = clip(body.prompt, 600);
  const modelAnswer = clip(body.modelAnswer, 800);
  const answer = clip(body.answer, 600);
  const keyPoints = (Array.isArray(body.keyPoints) ? body.keyPoints : []).slice(0, 6).map((k) => clip(k, 160));
  if (!prompt || !modelAnswer || !answer || !keyPoints.length) return send(res, 400, { error: "Missing fields" });

  const ip = await rateLimit(req, "grade", PER_IP_PER_HOUR, 3600);
  const all = await rateLimit(req, "grade", GLOBAL_PER_DAY, 86400, "global");
  if (!ip.ok || !all.ok) return send(res, 429, { error: "Too many requests" }, { "Retry-After": String(ip.retryAfter) });

  try {
    const result = await gradeAnswer({ prompt, modelAnswer, keyPoints, answer });
    return send(res, 200, { verdict: result.verdict, feedback: clip(result.feedback, 400) });
  } catch (err) {
    console.error("grade failed", err?.status || "", err?.message);
    return send(res, 502, { error: "Grading failed" });
  }
}
