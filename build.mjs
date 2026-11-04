// Builds each post in src/posts/ into a single self-contained HTML file in site/.
//   /* @include css/post.css */   → inlines a file from src/
//   <!-- @include svg:hero -->     → inlines a generated illustration from illustrations/
// Usage: node build.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hero } from "./illustrations/hero.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");
const illustrations = { hero };

for (const file of readdirSync(join(src, "posts")).filter((f) => f.endsWith(".html"))) {
  let html = readFileSync(join(src, "posts", file), "utf8");
  html = html.replace(/\/\* @include ([\w./-]+) \*\//g, (_, p) => readFileSync(join(src, p), "utf8"));
  html = html.replace(/<!-- @include svg:(\w+) -->/g, (_, name) => {
    if (!illustrations[name]) throw new Error(`Unknown illustration: ${name}`);
    return illustrations[name]();
  });
  const outDir = join(root, "site", basename(file, ".html"));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html);
  console.log(`built site/${basename(file, ".html")}/index.html (${(html.length / 1024).toFixed(0)} KB)`);
}
