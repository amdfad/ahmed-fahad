// Builds each post in src/posts/ and each page in src/pages/ into a single
// self-contained HTML file in site/<name>/index.html.
//   /* @include css/post.css */   → inlines a file from src/
//   <!-- @include svg:hero -->     → inlines a generated illustration from illustrations/
// Usage: node build.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hero } from "./illustrations/hero.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");
const illustrations = { hero };

for (const folder of ["posts", "pages"]) {
  const dir = join(src, folder);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
    let html = readFileSync(join(dir, file), "utf8");
    // Function replacers so "$" in included files is never treated as a pattern.
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
}
