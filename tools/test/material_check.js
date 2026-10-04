/* Checks the Material Web wiring without a browser.
   1. every <md-*> tag the site renders is actually defined by a module we import
   2. every bare specifier those modules import is resolvable by the import map
   3. the @material/web version in the import map's sibling file is consistent
   Run with: node tools/test/material_check.js          */

import { readFile } from "node:fs/promises";
import { state, loadIndex } from "../../assets/js/lib/store.js";
import * as ui from "../../assets/js/views/index.js";

const INDEX = new URL("../../index.html", import.meta.url);
const MATERIAL = new URL("../../assets/js/lib/material.js", import.meta.url);

let failures = 0;
const fail = (msg) => { failures++; console.log(`FAIL ${msg}`); };
const ok = (msg) => console.log(`ok   ${msg}`);

/* ---- index.html: import map + markup ------------------------------ */

const html = await readFile(INDEX, "utf8");
const mapMatch = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
if (!mapMatch) throw new Error("no <script type=\"importmap\"> in index.html - Material Web cannot load");
const importMap = JSON.parse(mapMatch[1]).imports;

const materialSrc = await readFile(MATERIAL, "utf8");
const entryUrls = [...new Set([...materialSrc.matchAll(/["'](https:\/\/[^"']+\.js)["']/g)].map((m) => m[1]))];
if (!entryUrls.length) throw new Error("assets/js/lib/material.js imports nothing");

/* every @material/web URL must pin the same version */
const versions = new Set(entryUrls.map((u) => /\/npm\/@material\/web@([^/]+)\//.exec(u)?.[1]));
if (versions.size > 1) fail(`assets/js/lib/material.js mixes @material/web versions: ${[...versions].join(", ")}`);
else ok(`@material/web pinned at ${[...versions][0]} across ${entryUrls.length} entry points`);

/* ---- walk the module graph ---------------------------------------- */

const seen = new Map();
const bare = new Map();          // specifier -> importer
const defined = new Set();       // md-* tag names

function resolveBare(spec) {
  if (importMap[spec]) return importMap[spec];
  for (const [key, value] of Object.entries(importMap)) {
    if (key.endsWith("/") && spec.startsWith(key)) return value + spec.slice(key.length);
  }
  return null;
}

async function load(url) {
  if (seen.has(url)) return seen.get(url);
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const entry = { ok: true, body, bytes: body.length };
  seen.set(url, entry);
  return entry;
}

const queue = [...entryUrls];
const missing = [];

while (queue.length) {
  const url = queue.pop();
  let entry;
  try {
    entry = await load(url);
  } catch (err) {
    missing.push(String(err.message));
    continue;
  }
  for (const m of entry.body.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (spec.startsWith(".") || spec.startsWith("/")) {
      queue.push(new URL(spec, url).href);
      continue;
    }
    if (bare.has(spec)) continue;
    bare.set(spec, url);
    const mapped = resolveBare(spec);
    if (!mapped) missing.push(`import map has no entry for "${spec}" (imported by ${url})`);
    else queue.push(mapped);
  }
  for (const m of entry.body.matchAll(/customElement\(['"](md-[a-z-]+)['"]\)/g)) defined.add(m[1]);
}

if (missing.length) for (const m of missing.slice(0, 20)) fail(m);
else ok(`import map covers all ${bare.size} bare specifiers (${[...bare.keys()].join(", ")})`);

const bytes = [...seen.values()].reduce((n, e) => n + e.bytes, 0);
ok(`${seen.size} modules, ${(bytes / 1024).toFixed(0)} KB of Material Web + lit, fetched over the graph`);
if (missing.length) { console.log(`\n${failures} failure(s)`); process.exit(1); }

/* ---- every md-* the site renders must be defined ------------------- */

/* store.js fetches data/index.json relatively; serve that from disk */
const raw = JSON.parse(await readFile(new URL("../../data/index.json", import.meta.url), "utf8"));
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) =>
  String(url).startsWith("data/") ? { ok: true, status: 200, json: async () => raw } : realFetch(url, opts);

await loadIndex();
const pages = {
  index: html,
  "home": ui.renderHome(),
  "people": ui.renderPeople(),
  settings: ui.renderSettings(),
  loading: ui.renderLoading(),
  error: ui.renderError("boom"),
};
for (const rel of state.index.releases) pages[`release ${rel.device}/${rel.id}`] = ui.renderRelease(rel);
pages["release+shots"] = ui.renderRelease({
  ...state.index.releases[0],
  screenshots: ["res/shots/x/1.webp", "res/shots/x/2.webp"],
});

const used = new Set();
for (const [name, markup] of Object.entries(pages)) {
  for (const m of markup.matchAll(/<(md-[a-z0-9-]+)/g)) {
    used.add(m[1]);
    if (!defined.has(m[1])) fail(`${name} renders <${m[1]}>, which nothing in material.js defines`);
  }
}
if (!failures) ok(`all ${used.size} components used are defined: ${[...used].sort().join(", ")}`);

/* nothing should still reach for the old hand-rolled lookalikes */
const PENDING = new Set();
for (const [name, markup] of Object.entries(pages)) {
  if (name === "index" || PENDING.has(name)) continue;
  if (/class="[^"]*\b(cell|cell__|pill|badge|btn|cap|search|seg__|dl__go)\b/.test(markup)) {
    fail(`${name} still emits pre-M3 class names`);
  }
}
if (!failures) ok("no pre-M3 component class names left anywhere");

/* ---- the pre-paint theme script must agree with settings.js ---------- */
/* index.html inlines a copy so the first paint is already in the right
   colours. Two copies drift, and a drifted first paint is a flash of the wrong
   scheme, so pin them to each other here. */
const { BOOT_SNIPPET } = await import("../../assets/js/lib/settings.js");
const inlined = /<script>\s*(try\{var s=JSON\.parse[\s\S]*?catch\(e\)\{\})\s*<\/script>/.exec(html);
if (!inlined) {
  fail("index.html has no pre-paint theme script (first paint would flash the defaults)");
} else {
  const norm = (s) => s.replace(/\s+/g, "");
  if (norm(inlined[1]) !== norm(BOOT_SNIPPET)) {
    fail("the inline theme script in index.html no longer matches BOOT_SNIPPET in lib/settings.js");
  } else {
    ok("pre-paint theme script matches BOOT_SNIPPET (no colour flash on reload)");
  }
}

/* ---- the splash must exist and be dismissible ---------------------- */
if (!/id="boot"/.test(html)) fail("index.html has no boot splash to cover the module load");
else if (!/<noscript><style>\.boot\{display:none!important\}<\/style><\/noscript>/.test(html)) {
  fail("the boot splash has no <noscript> escape: with JS off it would cover the page forever");
} else ok("boot splash present, with a <noscript> escape");

/* ---- 404.html carries the same defaults by hand -------------------- */
/* It has to repeat the pre-paint script (no module graph on that page), so at
   least pin that it still picks the same theme and accent keys. */
const notFound = await readFile(new URL("../../404.html", import.meta.url), "utf8");
if (!/dataset\.theme\s*=/.test(notFound)) fail("404.html does not set data-theme: it would render light on a dark site");
else if (!/dataset\.accent\s*=/.test(notFound)) fail("404.html does not set data-accent");
else if (!/@material\/web@2\.5\.0\/button\/filled-button\.js/.test(notFound)) fail("404.html lost its Material Web button");
else ok("404.html sets the same scheme defaults and loads the button");

console.log(failures ? `\n${failures} failure(s)` : "\nall material checks passed");
if (failures) process.exit(1);