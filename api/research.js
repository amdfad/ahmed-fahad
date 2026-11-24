// POST { office: { id?, name, address? }, refresh? }
// 200 { status: "ready", data, cached }   research JSON (cached for a few days)
// 202 { status: "pending" }               another request is already researching this office; poll again
// 200 { status: "unavailable" }          no cached result and the API key is not set
// 429 / 502                               rate limited / research failed (client uses built-in content)

import { send, readBody, sameSite, rateLimit, clip, slug } from "../server/http.js";
import { getJSON, setJSON, setIfAbsent, del } from "../server/store.js";
import { aiEnabled, researchOffice } from "../server/claude.js";

const TTL = Number(process.env.ROAD_TEST_CACHE_DAYS || 4) * 86400;
const PER_IP_PER_HOUR = Number(process.env.ROAD_TEST_RESEARCH_PER_HOUR || 4);
const GLOBAL_PER_DAY = Number(process.env.ROAD_TEST_RESEARCH_PER_DAY || 40);

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  if (!sameSite(req)) return send(res, 403, { error: "Forbidden" });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: "Bad JSON" });
  }
  const name = clip(body.office?.name, 120);
  const address = clip(body.office?.address, 200);
  if (name.length < 2) return send(res, 400, { error: "Office name required" });

  const officeKey = slug(`${name} ${address}`) || "office";
  const key = `research:v1:${officeKey}`;

  const cached = await getJSON(key).catch(() => null);
  if (cached) return send(res, 200, { status: "ready", cached: true, data: cached });

  if (!aiEnabled()) return send(res, 200, { status: "unavailable" });

  const lockKey = `lock:${key}`;
  if (!(await setIfAbsent(lockKey, 1, 280).catch(() => true))) {
    return send(res, 202, { status: "pending" });
  }

  const ip = await rateLimit(req, "research", PER_IP_PER_HOUR, 3600);
  const all = await rateLimit(req, "research", GLOBAL_PER_DAY, 86400, "global");
  if (!ip.ok || !all.ok) {
    await del(lockKey).catch(() => {});
    const retryAfter = !ip.ok ? ip.retryAfter : all.retryAfter;
    return send(res, 429, { status: "limited", error: "Too many research requests" }, { "Retry-After": String(retryAfter) });
  }

  try {
    const data = await researchOffice({ name, address }, officeKey);
    await setJSON(key, data, TTL).catch(() => {});
    return send(res, 200, { status: "ready", cached: false, data });
  } catch (err) {
    console.error("research failed", officeKey, err?.status || "", err?.message);
    return send(res, 502, { status: "failed", error: "Research failed" });
  } finally {
    await del(lockKey).catch(() => {});
  }
}
