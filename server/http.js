// Small helpers shared by the API routes (plain Node req/res, as Vercel provides).

import { incr } from "./store.js";

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") return JSON.parse(req.body || "{}");
    return req.body || {};
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Body too large");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

/** Reject obvious cross-site use so the routes are not an open proxy. */
export function sameSite(req) {
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/**
 * Fixed-window rate limit. Returns { ok, retryAfter }.
 * scope "ip" keys by client IP; scope "global" caps total use across everyone.
 */
export async function rateLimit(req, bucket, max, windowSeconds, scope = "ip") {
  const windowIndex = Math.floor(Date.now() / 1000 / windowSeconds);
  const who = scope === "global" ? "all" : clientIp(req);
  const key = `rl:${bucket}:${who}:${windowIndex}`;
  try {
    const n = await incr(key, windowSeconds);
    const retryAfter = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
    return { ok: n <= max, retryAfter };
  } catch {
    return { ok: true, retryAfter: 0 }; // store down: fail open, the global cap still protects
  }
}

export function clip(value, max) {
  return String(value ?? "").slice(0, max).trim();
}

export function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
