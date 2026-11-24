// Validates src/road-test/bank.json. Runs as part of `npm run build`.
// Usage: node scripts/check-bank.mjs

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bank = JSON.parse(readFileSync(join(root, "src/road-test/bank.json"), "utf8"));
const offices = JSON.parse(readFileSync(join(root, "src/road-test/offices.json"), "utf8"));

const errors = [];
const SEVERITIES = ["critical", "points", "tip"];
const PHASES = [undefined, "checkin", "exit", "drive", "pullover", "backing", "return"];
const all = [...bank.items, ...bank.predrive];
const ids = new Set();

for (const it of all) {
  const where = `item "${it.id}"`;
  if (!it.id || ids.has(it.id)) errors.push(`${where}: missing or duplicate id`);
  ids.add(it.id);
  for (const f of ["category", "severity", "prompt", "modelAnswer", "source"]) if (!it[f]) errors.push(`${where}: missing ${f}`);
  if (!bank.categories[it.category]) errors.push(`${where}: unknown category "${it.category}"`);
  if (!SEVERITIES.includes(it.severity)) errors.push(`${where}: bad severity "${it.severity}"`);
  if (!Array.isArray(it.keyPoints) || !it.keyPoints.length) errors.push(`${where}: needs keyPoints`);
  if (!Array.isArray(it.distractors) || it.distractors.length < 2) errors.push(`${where}: needs 2 distractors`);
  if (it.source && !bank.sources[it.source] && !/^https:\/\//.test(it.source)) errors.push(`${where}: unknown source "${it.source}"`);
  if (bank.items.includes(it) && !PHASES.includes(it.phase)) errors.push(`${where}: bad phase "${it.phase}"`);
  if (/[\u{1F300}-\u{1FAFF}]/u.test(JSON.stringify(it))) errors.push(`${where}: no emojis please`);
}
for (const it of all) if (it.followUp && !ids.has(it.followUp)) errors.push(`item "${it.id}": followUp "${it.followUp}" not found`);
for (const id of ["pull-over", "pull-out", "backing", "return-dmv", "exit-lot"]) if (!ids.has(id)) errors.push(`mock needs item "${id}"`);
if (bank.items.filter((i) => i.phase === "checkin").length < 2) errors.push("mock needs at least 2 checkin items");
for (const c of [...bank.expect, ...bank.mistakes]) if (!c.title || !c.lines?.length) errors.push(`card "${c.id}": needs title and lines`);
if (!Array.isArray(offices) || offices.length < 100) errors.push("offices.json looks empty; run node scripts/fetch-offices.mjs");

if (errors.length) {
  console.error(`bank.json has ${errors.length} problem(s):\n- ` + errors.join("\n- "));
  process.exit(1);
}
console.log(`bank ok: ${bank.items.length} questions, ${bank.predrive.length} pre-drive items, ${offices.length} offices`);
