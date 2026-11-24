// Refreshes src/road-test/offices.json from the DMV's public field-office feed.
// Keeps regular field offices only (drops business centres, commercial test
// centres, express kiosks and offices marked closed).
// Usage: node scripts/fetch-offices.mjs

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FEED = "https://www.dmv.ca.gov/portal/wp-json/dmv/v1/field-offices";
const SKIP = /\b(IBC|Industry Business Center|Commercial Drive Test Center|Express|Stoneridge)\b/i;

const decode = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&#8217;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const res = await fetch(FEED);
if (!res.ok) throw new Error(`DMV feed returned ${res.status}`);
const raw = await res.json();

const offices = raw
  .filter((o) => o.is_open !== false && !SKIP.test(o.title.rendered))
  .map((o) => {
    const m = o.meta;
    const street = decode(m.dmv_field_office_street).replace(/\s*\(.*\)$/, "");
    return {
      id: o.slug,
      name: decode(o.title.rendered),
      address: `${street}, ${decode(m.dmv_field_office_city)}, CA ${m.dmv_field_office_zipcode}`,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "road-test", "offices.json");
writeFileSync(out, JSON.stringify(offices) + "\n");
console.log(`wrote ${offices.length} offices to ${out}`);
