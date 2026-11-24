// Tiny key-value store with TTLs.
// Uses Upstash Redis (Vercel KV / Upstash marketplace integration) over its REST API
// when KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + _TOKEN) are set.
// Otherwise falls back to memory plus a JSON file in the OS temp dir, which is fine
// for local dev and survives warm serverless invocations, but is not shared.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const hasSharedStore = Boolean(REST_URL && REST_TOKEN);

async function redis(command) {
  const res = await fetch(REST_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`KV error: ${body.error || res.status}`);
  return body.result;
}

// ---- local fallback ----
const memory = new Map(); // key -> { value, expires }
const FILE_DIR = join(tmpdir(), "road-test-coach");
const FILE = join(FILE_DIR, "store.json");
let fileLoaded = false;

function loadFile() {
  if (fileLoaded) return;
  fileLoaded = true;
  try {
    const saved = JSON.parse(readFileSync(FILE, "utf8"));
    for (const [k, v] of Object.entries(saved)) memory.set(k, v);
  } catch {
    /* no file yet */
  }
}

function saveFile() {
  try {
    mkdirSync(FILE_DIR, { recursive: true });
    const now = Date.now();
    const out = {};
    // only persist long-lived entries (cache), not rate-limit counters
    for (const [k, v] of memory) if (v.expires > now && !k.startsWith("rl:")) out[k] = v;
    writeFileSync(FILE, JSON.stringify(out));
  } catch {
    /* read-only filesystem: memory only */
  }
}

function memGet(key) {
  loadFile();
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

// ---- public API ----
export async function getJSON(key) {
  if (hasSharedStore) {
    const raw = await redis(["GET", key]);
    return raw ? JSON.parse(raw) : null;
  }
  return memGet(key);
}

export async function setJSON(key, value, ttlSeconds) {
  if (hasSharedStore) {
    await redis(["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)]);
    return;
  }
  memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  saveFile();
}

/** Set only if absent. Returns true if this call took the key. */
export async function setIfAbsent(key, value, ttlSeconds) {
  if (hasSharedStore) {
    const r = await redis(["SET", key, JSON.stringify(value), "NX", "EX", String(ttlSeconds)]);
    return r === "OK";
  }
  if (memGet(key) !== null) return false;
  memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  return true;
}

export async function del(key) {
  if (hasSharedStore) {
    await redis(["DEL", key]);
    return;
  }
  memory.delete(key);
}

/** Increment a counter that expires ttlSeconds after it is first created. */
export async function incr(key, ttlSeconds) {
  if (hasSharedStore) {
    const n = await redis(["INCR", key]);
    if (n === 1) await redis(["EXPIRE", key, String(ttlSeconds)]);
    return n;
  }
  const current = memGet(key) || 0;
  const hit = memory.get(key);
  const expires = hit && hit.expires > Date.now() ? hit.expires : Date.now() + ttlSeconds * 1000;
  memory.set(key, { value: current + 1, expires });
  return current + 1;
}
