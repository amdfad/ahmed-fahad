// Local dev server: serves site/ and runs api/*.js the way Vercel does.
// Usage: npm run dev   (builds first)   then open http://localhost:3000/road-test
// Reads .env.local if present (ANTHROPIC_API_KEY etc.).

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const port = Number(process.env.PORT || 3000);

const envFile = join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const apiMatch = url.pathname.match(/^\/api\/([a-z-]+)\/?$/);
  if (apiMatch) {
    const file = join(root, "api", `${apiMatch[1]}.js`);
    if (!existsSync(file)) return void ((res.statusCode = 404), res.end("Not found"));
    try {
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      return res.end("Server error");
    }
  }
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(site, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!file.startsWith(site) || !existsSync(file)) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
  res.end(readFileSync(file));
}).listen(port, () => console.log(`http://localhost:${port}/road-test`));
