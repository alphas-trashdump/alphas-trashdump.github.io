/* release: one build ----------------------------------------------------- */
import { fmtDate, relDays, mirrorHint } from "../lib/store.js";
import { esc, enc, letters, icon, channel } from "./shared.js";
import { personRow } from "./people.js";

export function renderRelease(rel) {
  const [primary, ...mirrors] = rel.mirrors;
  const tag = channel(rel.channel);
  /* One column, one order: downloads, screenshots, details, what changed,
     known bugs, how to flash, who made it. The old markup split this across a
     sticky sidebar and a main column, which put "Ported by" right after
     "Details" on a phone and made the reading order depend on the viewport. */
  return `
    <article class="release">
      <header class="release__head">
        <h1 class="t-headline-large notranslate" translate="no" aria-label="${esc(rel.name)}"><span aria-hidden="true" translate="no" class="notranslate">${letters(rel.name)}</span></h1>
        <p class="t-body-medium muted">${esc(rel.device_.fullName || rel.device_.name)} · ${esc(rel.maintainer_.name)}</p>
        <md-chip-set class="release__chips" aria-label="Build details">
          ${tag ? `<md-assist-chip class="tag-beta" label="${esc(tag)}"></md-assist-chip>` : ""}
          <md-assist-chip class="meta" label="Android ${esc(rel.android)}"></md-assist-chip>
          ${rel.size ? `<md-assist-chip class="meta" label="${esc(rel.size)}"></md-assist-chip>` : ""}
          <md-assist-chip class="meta" label="${fmtDate(rel.date)}"></md-assist-chip>
        </md-chip-set>
        ${noteBlock(rel)}
      </header>

      <div class="release__flow">
        <section class="block in" style="--i:1">
          <h2 class="subhead t-title-small">Download</h2>
          <md-outlined-card>
            <md-list>
              ${primary ? dlRow(primary, rel, true) : ""}
              ${mirrors.map((m) => dlRow(m, rel, false)).join("")}
            </md-list>
          </md-outlined-card>
          ${rel.extras.length ? `<h3 class="subhead t-title-small">Also flash these</h3>
            <md-outlined-card><md-list>${rel.extras.map((e) => linkRow(e, "external-link")).join("")}</md-list></md-outlined-card>` : ""}
          ${rel.recovery ? `<h3 class="subhead t-title-small">Recovery</h3>
            <md-outlined-card><md-list>${linkRow(rel.recovery, "external-link")}</md-list></md-outlined-card>` : ""}
        </section>

        ${shotsBlock(rel)}
        ${infoBlock(rel)}
        ${listBlock("What changed", rel.changelog, "bullets", 4)}
        ${listBlock("Known bugs", rel.bugs, "bullets", 5, "Nothing reported yet.")}
        ${listBlock("How to flash", rel.install, "steps", 6)}

        <section class="block in" style="--i:7">
          <h2 class="subhead t-title-small">Ported by</h2>
          <md-outlined-card><md-list>${personRow(rel.maintainer_)}</md-list></md-outlined-card>
        </section>

        <section class="block in" style="--i:8">
          <div class="block__actions">
            <md-filled-button id="share" class="block__cta">
              <md-icon slot="icon">${icon("link", "ico ico--md")}</md-icon>
              Copy Link
            </md-filled-button>
            <md-filled-button href="https://t.me/trashdumpchat" target="_blank" class="block__cta">
              <md-icon slot="icon">${icon("send", "ico ico--md")}</md-icon>
              Feedback & Chat
            </md-filled-button>
          </div>
          <p class="legal t-body-small">You flash this at your own risk. Nobody here is responsible for lost data or a bricked device.</p>
        </section>
      </div>
    </article>`;
}

/* A download row is named after the mirror it opens, not after the build file:
   "Google Drive", "Telegram", "SourceForge". The line below says which one is
   the main mirror and how big the file is, so the host is never printed twice. */
function dlRow(m, rel, isPrimary) {
  const label = m.label || mirrorHint(m.url);
  return `
    <md-list-item type="link" href="${esc(m.url)}" target="_blank"${isPrimary ? ' class="row--primary"' : ""}>
      <md-icon slot="start">${icon("download", "ico ico--md")}</md-icon>
      <span slot="headline">${esc(label)}</span>
      <span slot="supporting-text">${isPrimary ? "Main mirror" : "Mirror"}${rel.size ? ` · ${esc(rel.size)}` : ""}</span>
      <md-icon slot="end">${icon("chevron-right", "ico ico--md")}</md-icon>
    </md-list-item>`;
}

function linkRow(item, glyph) {
  return `
    <md-list-item type="link" href="${esc(item.url)}" target="_blank">
      <md-icon slot="start">${icon(glyph, "ico ico--md")}</md-icon>
      <span slot="headline">${esc(item.label)}</span>
      <span slot="supporting-text">${esc(mirrorHint(item.url))}</span>
      <md-icon slot="end">${icon("chevron-right", "ico ico--md")}</md-icon>
    </md-list-item>`;
}

function noteBlock(rel) {
  if (!rel.notes) return "";
  const raw = Array.isArray(rel.notes) ? rel.notes.join("\n") : String(rel.notes);
  return `
    <md-outlined-card class="note${rel.noteStyle === "quiet" ? " note--quiet" : ""}">
      <div class="note__body">
        <md-icon>${icon("info", "ico ico--md")}</md-icon>
        <p class="t-body-medium">${linkify(raw)}</p>
      </div>
    </md-outlined-card>`;
}

/* Linkify the raw text and escape each piece on its own. Escaping first and
   then matching URLs would let `&quot;` and friends end up inside the href. */
function linkify(raw) {
  const url = /https?:\/\/[^\s<>"']+/g;
  let html = "", at = 0, m;
  while ((m = url.exec(raw))) {
    const href = m[0].replace(/[.,;:!?)\]]+$/, "");
    html += esc(raw.slice(at, m.index));
    if (href) html += `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(href)}</a>`;
    at = m.index + href.length;
  }
  return (html + esc(raw.slice(at))).replace(/\n/g, "<br>");
}

function shotsBlock(rel) {
  const album = rel.screenshotsAlbum;
  if (!rel.screenshots.length) {
    if (!album) return "";
    return `<section class="block in" style="--i:2">
      <h2 class="subhead t-title-small">Screenshots</h2>
      <md-outlined-card><md-list>${linkRow({ label: "Open album", url: album }, "image")}</md-list></md-outlined-card>
      <p class="shots__hint t-body-small muted">Not mirrored here yet.</p></section>`;
  }
  const thumbs = rel.screenshots.map((src, i) => `
    <button type="button" class="thumb" data-shot="${i}" aria-label="Open screenshot ${i + 1} of ${esc(rel.name)}">
      <img src="${esc(src)}" alt="" loading="lazy" decoding="async" data-shot-img>
    </button>`).join("");
  return `
    <section class="block in" style="--i:2" data-shots-section>
      <h2 class="subhead t-title-small">Screenshots</h2>
      <div class="shots">${thumbs}</div>
      <p class="shots__hint t-body-small muted" data-shots-hint>Tap to open</p>
      ${album ? `<md-outlined-card><md-list>${linkRow({ label: "Full album", url: album }, "image")}</md-list></md-outlined-card>
      <template data-shots-fallback-tpl>
        <md-outlined-card><md-list>${linkRow({ label: "Open album", url: album }, "image")}</md-list></md-outlined-card>
        <p class="shots__hint t-body-small muted">Screenshots did not load, use the album instead.</p>
      </template>` : ""}
    </section>`;
}

function listBlock(title, items, kind, i, empty) {
  if (!items?.length && !empty) return "";
  const body = items?.length
    ? items.map((x, n) => `
        <md-list-item type="text">
          ${kind === "steps" ? `<span slot="start" class="step">${n + 1}</span>` : '<span slot="start" class="dot"></span>'}
          <span slot="headline">${esc(x)}</span>
        </md-list-item>`).join("")
    : `<md-list-item type="text"><span slot="headline" class="muted">${esc(empty)}</span></md-list-item>`;
  return `<section class="block in" style="--i:${i}">
    <h2 class="subhead t-title-small">${esc(title)}</h2>
    <md-outlined-card><md-list>${body}</md-list></md-outlined-card></section>`;
}

function infoBlock(rel) {
  /* hits.sh bakes the colours into the SVG, and the old pair was dark text on a
     dark fill - unreadable in both schemes. Ship one badge per scheme instead. */
  const hits = `https://hits.sh/alphas-trashdump.github.io/r/${enc(rel.device)}/${enc(rel.id)}.svg?style=flat-square&label=views`;
  const badgeDark = `${hits}&color=e2e0df&labelColor=2c2a29`;
  const badgeLight = `${hits}&color=1d1b1a&labelColor=eeeceb`;
  const rows = [
    ["Device", esc(rel.device_.name)],
    ["Codename", esc(rel.device)],
    rel.supports?.length ? ["Also supports", rel.supports.map(esc).join(", ")] : null,
    ["Android", esc(rel.android)],
    ["Build date", `${fmtDate(rel.date)} · ${relDays(rel.date)}`],
    ["Views", `<span class="kv__views">
        <img class="kv__badge kv__badge--on-dark" src="${badgeDark}" alt="View count" height="18" loading="lazy">
        <img class="kv__badge kv__badge--on-light" src="${badgeLight}" alt="View count" height="18" loading="lazy">
      </span>`],
  ].filter(Boolean);
  return `
    <section class="block block--details in" style="--i:5">
      <h2 class="subhead t-title-small">Details</h2>
      <md-outlined-card>
        <md-list>${rows.map(([k, v]) => `
          <md-list-item type="text">
            <span slot="headline">${k}</span>
            <span slot="trailing-supporting-text" class="kv__v">${v}</span>
          </md-list-item>`).join("")}</md-list>
      </md-outlined-card>
    </section>`;
}
