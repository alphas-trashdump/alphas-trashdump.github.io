/* Renders every view against the real data/index.json outside a browser.
   Catches template crashes, undefined interpolation and unescaped junk.
   Run with:  qjs --std --module tools/test/render_check.js
         or:  node tools/test/render_check.js                */

async function readIndex() {
  if (typeof std !== "undefined" && std.loadFile) return std.loadFile("data/index.json");
  const fs = await import("node:fs");
  return fs.readFileSync("data/index.json", "utf8");
}

function bail(code) {
  if (typeof std !== "undefined" && std.exit) std.exit(code);
  else if (typeof process !== "undefined") process.exit(code);
}

const raw = await readIndex();
if (!raw) throw new Error("data/index.json missing - run tools/build_index.py");

globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => JSON.parse(raw) });

const store = await import("../../assets/js/store.js");
const ui = await import("../../assets/js/ui.js");

await store.loadIndex();

let failures = 0;
function check(name, html) {
  const problems = [];
  if (!html || html.length < 40) problems.push("suspiciously short");
  if (/undefined|\[object Object\]|NaN/.test(html)) problems.push("contains undefined/NaN/[object Object]");
  const open = (html.match(/<(?!\/)(?!br|img|input|meta|link|hr|path|svg\b)[a-z]/gi) || []).length;
  if (problems.length) {
    failures++;
    console.log(`FAIL ${name}: ${problems.join(", ")}`);
  } else {
    console.log(`ok   ${name} (${html.length} chars, ~${open} elements)`);
  }
}

check("home", ui.renderHome());

store.state.query = "hyperos";
check("home+query", ui.renderHome());
store.state.query = "zzzz-nothing";
const empty = ui.renderHome();
if (!/nothing here/.test(empty)) { failures++; console.log("FAIL empty state missing"); }
else console.log("ok   empty state");
store.state.query = "";

store.state.device = "santoni";
check("home+device", ui.renderHome());
store.state.device = "all";

for (const rel of store.state.index.releases) {
  check(`release ${rel.device}/${rel.id}`, ui.renderRelease(rel));
}

/* gallery path: no release ships screenshots yet, so synthesise one */
const withShots = {
  ...store.state.index.releases[0],
  screenshots: ["res/shots/x/1.webp", "res/shots/x/2.webp", "res/shots/x/3.webp"],
};
const galleryHtml = ui.renderRelease(withShots);
const thumbs = (galleryHtml.match(/data-shot="/g) || []).length;
if (thumbs !== 3) { failures++; console.log(`FAIL gallery rendered ${thumbs} thumbs, expected 3`); }
else console.log("ok   gallery (3 thumbs + lightbox hooks)");

/* album fallback when there are no local screenshots */
const albumOnly = { ...store.state.index.releases[0], screenshots: [], screenshotsAlbum: "https://t.me/x/1" };
const albumHtml = ui.renderRelease(albumOnly);
if (!/Open album/.test(albumHtml) || !/data-shots-fallback/.test(albumHtml)) { failures++; console.log("FAIL album-only fallback missing"); }
else console.log("ok   album-only fallback");

/* local shots AND an album: keep the album as a secondary link plus a runtime
   fallback template for when the images fail to load */
const both = { ...withShots, screenshotsAlbum: "https://t.me/x/1" };
const bothHtml = ui.renderRelease(both);
const checks = [
  [/data-shot="0"/, "thumbs still rendered"],
  [/Full album/, "secondary album link"],
  [/data-shots-fallback-tpl/, "runtime fallback template"],
  [/data-shots-section/, "section hook for the failure watcher"],
];
for (const [re, what] of checks) {
  if (!re.test(bothHtml)) { failures++; console.log(`FAIL missing ${what}`); }
}
if (checks.every(([re]) => re.test(bothHtml))) console.log("ok   shots + album fallback");

/* externally hosted screenshots are allowed as plain urls */
const extShots = { ...store.state.index.releases[0], screenshots: ["https://i.imgur.com/a.png"] };
if (!/src="https:\/\/i\.imgur\.com\/a\.png"/.test(ui.renderRelease(extShots))) {
  failures++; console.log("FAIL external screenshot url not rendered");
} else console.log("ok   external screenshot url");

/* release notes are optional, and opt-in loud vs quiet */
const base0 = store.state.index.releases[0];
const noNote = ui.renderRelease({ ...base0, notes: null });
if (/class="note"|quiet-note/.test(noNote)) { failures++; console.log("FAIL note rendered with no note set"); }
else console.log("ok   no note -> nothing rendered");

const loud = ui.renderRelease({ ...base0, notes: "watch out", noteStyle: "callout" });
if (!/class="note"/.test(loud)) { failures++; console.log("FAIL callout note missing"); }
else console.log("ok   callout note");

const quiet = ui.renderRelease({ ...base0, notes: "watch out", noteStyle: "quiet" });
if (!/quiet-note/.test(quiet) || /class="note"/.test(quiet)) { failures++; console.log("FAIL quiet note missing"); }
else console.log("ok   quiet note");

/* the ported-from field is gone for good */
const withBase = ui.renderRelease({ ...base0, base: "Redmi K70 (vermeer)" });
if (/Ported from|Redmi K70/.test(withBase)) { failures++; console.log("FAIL base still rendered"); }
else console.log("ok   base not rendered");

/* every view must ship a spinner for the loading state */
if (!/spin__dot/.test(ui.renderLoading())) { failures++; console.log("FAIL loading spinner missing"); }
else console.log("ok   loading spinner");
const shotSpinners = (ui.renderRelease(withShots).match(/spin__dot/g) || []).length;
if (shotSpinners !== 3) { failures++; console.log(`FAIL ${shotSpinners} thumb spinners, expected 3`); }
else console.log("ok   thumbnail spinners");

check("people", ui.renderPeople());
check("error", ui.renderError("boom"));

/* escaping must actually escape */
const evil = ui.esc('<script>alert("x")</script>');
if (evil.includes("<script")) { failures++; console.log("FAIL esc() does not escape"); }
else console.log("ok   esc()");

/* a release with hostile content must not emit raw html */
const hostile = {
  ...store.state.index.releases[0],
  name: '<img src=x onerror=alert(1)>',
  notes: '"><script>bad()</script>',
  bugs: ['<b>bold</b>'],
};
const hostileHtml = ui.renderRelease(hostile);
if (/<img src=x|<script>bad/.test(hostileHtml)) { failures++; console.log("FAIL hostile data leaked into html"); }
else console.log("ok   hostile data escaped");

console.log(failures ? `\n${failures} failure(s)` : "\nall render checks passed");
if (failures) bail(1);
