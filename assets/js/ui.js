/* rendering ---------------------------------------------------------- */
import { state, filtered, groupByDevice, fmtDate, relDays, isFresh, mirrorHint } from "./store.js";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
const enc = (s) => encodeURIComponent(String(s));

/* glyph-by-glyph; words stay unbreakable so wrapping is sane */
export function letters(text) {
  let n = 0;
  return String(text).split(/(\s+)/).map((chunk) => {
    if (!chunk) return "";
    if (!chunk.trim()) return " ";
    return `<span class="w">${[...chunk].map((ch) => `<span class="ch" style="--n:${n++}">${esc(ch)}</span>`).join("")}</span>`;
  }).join("");
}

/* word-by-word */
export function words(text, step = 40, start = 0) {
  return String(text).split(/\s+/).filter(Boolean).map((w, n) =>
    `<span class="wd" style="--n:${n};--d:${start + n * step}ms">${esc(w)}</span>`).join(" ");
}

/* number that rolls in digit by digit */
export function digits(value, start = 0) {
  return `<span class="num">${[...String(value)].map((d, n) =>
    `<span class="dg" style="--d:${start + n * 50}ms">${esc(d)}</span>`).join("")}</span>`;
}

const PATHS = {
  chevron: "M9.5 5.5 16 12l-6.5 6.5",
  back: "M14.5 5.5 8 12l6.5 6.5",
  download: "M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19h14",
  external: "M7 17 17 7M9 7h8v8",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2",
  x: "M6 6l12 12M18 6 6 18",
  info: "M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  people: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6",
  link: "M9.5 13.5 14 9m-3.2-1.8 1.4-1.4a3.3 3.3 0 0 1 4.7 4.7l-1.4 1.4m-4.6 4.6-1.4 1.4a3.3 3.3 0 0 1-4.7-4.7l1.4-1.4",
  send: "M21 4 3 11l7 2.5L12.5 21z",
  image: "M4 5h16v14H4zM4 16l4.5-4.5 3 3L15 11l5 5",
  shield: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z",
};

export function icon(name, cls = "ico") {
  const d = PATHS[name];
  return d ? `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>` : "";
}

export function spinner(cls = "spin", label = "") {
  return `<span class="${cls}" role="${label ? "status" : "presentation"}"${label ? ` aria-label="${esc(label)}"` : ' aria-hidden="true"'}>
    <svg viewBox="0 0 14 14">
      <circle class="spin__ring" cx="7" cy="7" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <circle class="spin__dot" cx="4.2" cy="7" r="1.4" fill="currentColor"/>
    </svg>
  </span>`;
}

const CHANNEL = {
  stable: { tone: "ok", text: "Stable" },
  beta: { tone: "accent", text: "Beta" },
  experimental: { tone: "warn", text: "Experimental" },
};
const channel = (ch) => CHANNEL[ch] || CHANNEL.stable;

/* ---- home ---------------------------------------------------------- */

export function renderHome() {
  const idx = state.index;
  const latest = idx.releases.reduce((a, r) => (r.date > a ? r.date : a), "");
  const tabs = [
    { key: "all", href: "#/", label: "All", n: idx.releases.length },
    ...idx.devices.map((d) => ({
      key: d.codename, href: `#/d/${enc(d.codename)}`, label: d.codename,
      n: idx.releases.filter((r) => r.device === d.codename).length,
    })),
  ];

  return `
    <div class="home">
      <div class="home__top">
        <section class="hero">
          <h1 aria-label="alpha's trashdump"><span aria-hidden="true">${letters("alpha's trashdump")}</span></h1>
          <p class="meta">
            <span>${digits(idx.releases.length, 350)} builds</span>
            <span>${digits(idx.devices.length, 450)} device families</span>
            ${latest ? `<span>${words(`updated ${fmtDate(latest)}`, 40, 500)}</span>` : ""}
          </p>
        </section>
        <div class="tools in" style="--i:2">
          <label class="search" data-filled="${state.query ? 1 : 0}">
            ${icon("search", "ico ico--sm")}
            <input id="q" type="search" inputmode="search" autocomplete="off" spellcheck="false"
                   placeholder="Search builds" value="${esc(state.query)}" aria-label="Search builds">
            <button type="button" id="q-clear" aria-label="Clear search">${icon("x", "ico")}</button>
          </label>
          <div class="seg" id="seg" role="tablist" aria-label="Device">
            <span class="seg__thumb" aria-hidden="true"></span>
            ${tabs.map((t) => `
              <a class="seg__it" role="tab" href="${t.href}" data-key="${esc(t.key)}"
                 aria-selected="${state.device === t.key}">${esc(t.label)}<span>${t.n}</span></a>`).join("")}
          </div>
        </div>
      </div>
      <div class="home__list" id="list">${renderList()}</div>
    </div>`;
}

/* only the list re-renders on search / tab change */
export function renderList() {
  const rows = filtered();
  if (!rows.length) {
    return `<div class="empty in">
      <h3>Nothing matches</h3>
      <p>Try the codename or the Android version.</p>
    </div>`;
  }
  return groupByDevice(rows).map((g, i) => groupBlock(g, i)).join("");
}

function groupBlock({ device, list }, i) {
  return `
    <section class="group in" style="--i:${i + 2}">
      <div class="cap"><b>${esc(device.codename)}</b><span>${esc(device.fullName || device.name || "")}</span></div>
      <div class="card">${list.map(row).join("")}</div>
    </section>`;
}

function row(rel) {
  const c = channel(rel.channel);
  return `
    <a class="cell" href="#/r/${enc(rel.device)}/${enc(rel.id)}">
      <div class="cell__body">
        <div class="cell__t"><span>${esc(rel.name)}</span>${isFresh(rel.date) ? '<i class="badge">New</i>' : ""}</div>
        <div class="cell__s">Android ${esc(rel.android)} · ${esc(rel.size)} · ${fmtDate(rel.date)}</div>
      </div>
      <span class="cell__v cell__v--${c.tone}">${c.text}</span>
      ${icon("chevron", "ico ico--sm cell__chev")}
    </a>`;
}

/* ---- release ------------------------------------------------------- */

export function renderRelease(rel) {
  const c = channel(rel.channel);
  const [primary, ...mirrors] = rel.mirrors;

  return `
    <article class="release">
      <header class="release__head">
        <h1 class="title" aria-label="${esc(rel.name)}"><span aria-hidden="true">${letters(rel.name)}</span></h1>
        <p class="release__sub">${words(`${rel.device_.fullName || rel.device_.name} · ${rel.maintainer_.name}`)}</p>
        <div class="release__pills">
          <span class="pill pill--${c.tone} in" style="--i:0">${c.text}</span>
          <span class="pill in" style="--i:1">Android ${esc(rel.android)}</span>
          ${rel.size ? `<span class="pill in" style="--i:2">${esc(rel.size)}</span>` : ""}
          <span class="pill in" style="--i:3">${fmtDate(rel.date)}</span>
        </div>
        ${noteBlock(rel)}
      </header>

      <div class="release__side">
        <section class="block block--dl in" style="--i:1">
          <div class="card">
            ${primary ? dlRow(primary, rel) : ""}
            ${mirrors.map((m) => linkCell(m, "download")).join("")}
          </div>
          ${rel.extras.length ? `<div class="cap">Also flash these</div><div class="card">${rel.extras.map((e) => linkCell(e, "external")).join("")}</div>` : ""}
          ${rel.recovery ? `<div class="cap">Recovery</div><div class="card">${linkCell(rel.recovery, "external")}</div>` : ""}
        </section>
        ${infoBlock(rel)}
        <section class="block block--who in" style="--i:6">
          <div class="cap">Ported by</div>
          <div class="card">${person(rel.maintainer_)}</div>
        </section>
      </div>

      <div class="release__main">
        ${shotsBlock(rel)}
        ${listBlock("How to flash", rel.install, "steps", "block--install", 3)}
        ${listBlock("Known bugs", rel.bugs, "bullets bullets--bad", "block--bugs", 4, "Nothing reported yet.")}
        ${listBlock("What changed", rel.changelog, "bullets", "block--log", 5)}
        <section class="block block--end in" style="--i:7">
          <button class="btn btn--block press" id="share">${icon("link", "ico ico--sm")}Copy link</button>
          <p class="legal">You flash this at your own risk. Nobody here is responsible for lost data or a bricked device.</p>
        </section>
      </div>
    </article>`;
}

function dlRow(m, rel) {
  return `
    <a class="cell dl" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">
      <span class="cell__ico">${icon("download", "ico ico--lg")}</span>
      <span class="cell__body">
        <span class="cell__t"><span>Download</span></span>
        <span class="cell__s">${esc(mirrorHint(m.url))}${rel.size ? ` · ${esc(rel.size)}` : ""}</span>
      </span>
      <span class="dl__go">Get</span>
    </a>`;
}

function linkCell(item, ic) {
  return `
    <a class="cell" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">
      <span class="cell__ico cell__ico--dim">${icon(ic, "ico")}</span>
      <span class="cell__body">
        <span class="cell__t"><span>${esc(item.label)}</span></span>
        <span class="cell__s">${esc(mirrorHint(item.url))}</span>
      </span>
      ${icon("chevron", "ico ico--sm cell__chev")}
    </a>`;
}

function noteBlock(rel) {
  if (!rel.notes) return "";
  const raw = Array.isArray(rel.notes) ? rel.notes.join("\n") : String(rel.notes);
  const html = esc(raw)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, "<br>");
  const quiet = rel.noteStyle === "quiet";
  return `<div class="callout${quiet ? " callout--quiet" : ""}">${icon("info", "ico")}<div>${html}</div></div>`;
}

function shotsBlock(rel) {
  const album = rel.screenshotsAlbum;
  if (!rel.screenshots.length) {
    if (!album) return "";
    return `
      <section class="block block--shots in" style="--i:2">
        <div class="cap">Screenshots</div>
        <div class="card">${linkCell({ label: "Open album", url: album }, "image")}</div>
        <p class="shots__hint">Not mirrored here yet.</p>
      </section>`;
  }
  const thumbs = rel.screenshots.map((src, i) => `
    <button type="button" class="press" data-shot="${i}" aria-label="Open screenshot ${i + 1}">
      ${spinner("spin spin--sm")}
      <img src="${esc(src)}" alt="Screenshot ${i + 1} of ${esc(rel.name)}" loading="lazy" decoding="async" data-shot-img>
    </button>`).join("");

  return `
    <section class="block block--shots in" style="--i:2" data-shots-section>
      <div class="cap"><b>Screenshots</b><span>${rel.screenshots.length}</span></div>
      <div class="shots">${thumbs}</div>
      <p class="shots__hint" data-shots-hint>Swipe · tap to open</p>
      ${album ? `<div class="card shots__album">${linkCell({ label: "Full album", url: album }, "image")}</div>` : ""}
      ${album ? `<template data-shots-fallback-tpl>
        <div class="card">${linkCell({ label: "Open album", url: album }, "image")}</div>
        <p class="shots__hint">Screenshots did not load, use the album instead.</p>
      </template>` : ""}
    </section>`;
}

function listBlock(title, items, cls, blockCls, i, empty) {
  if (!items?.length && !empty) return "";
  const t = cls.startsWith("steps") ? "ol" : "ul";
  const body = items?.length
    ? `<${t} class="${cls}">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</${t}>`
    : `<p class="muted">${esc(empty)}</p>`;
  return `<section class="block ${blockCls} in" style="--i:${i}"><div class="cap">${esc(title)}</div><div class="card">${body}</div></section>`;
}

function infoBlock(rel) {
  const badge = `https://hits.sh/alphas-trashdump.github.io/r/${enc(rel.device)}/${enc(rel.id)}.svg?style=flat-square&label=views&color=252529&labelColor=1a1a1d`;
  const rows = [
    ["Device", esc(rel.device_.name)],
    ["Codename", esc(rel.device)],
    rel.supports?.length ? ["Also supports", rel.supports.map(esc).join(", ")] : null,
    ["Android", esc(rel.android)],
    ["Build date", `${fmtDate(rel.date)} · ${relDays(rel.date)}`],
    ["Views", `<img class="kv__badge" src="${badge}" alt="" height="18" loading="lazy">`],
  ].filter(Boolean);

  return `
    <section class="block block--details in" style="--i:5">
      <div class="cap">Details</div>
      <dl class="card kv">
        ${rows.map(([k, v]) => `<div class="cell"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}
      </dl>
    </section>`;
}

/* ---- people -------------------------------------------------------- */

export function person(m, count) {
  const links = (m.links || []).map((l) =>
    `<a class="pill press" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}${icon("external", "ico ico--sm")}</a>`).join("");
  const badges = (m.badges || []).map((b) =>
    `<span class="pill ${b === "owner" ? "pill--accent" : ""}">${esc(b)}</span>`).join("");

  return `
    <div class="person">
      <img class="person__pic" src="${esc(m.avatar || "")}" alt="" width="48" height="48" loading="lazy" decoding="async">
      <div class="person__body">
        <div class="person__name">
          <b>${esc(m.name)}</b>
          ${count != null ? `<span>${count} build${count === 1 ? "" : "s"}</span>` : ""}
        </div>
        <p class="person__tag">${esc(m.tag || "")}${m.pronouns ? ` · ${esc(m.pronouns)}` : ""}</p>
        ${m.bio ? `<p class="person__bio">${esc(m.bio)}</p>` : ""}
        <div class="person__links">${badges}${links}</div>
      </div>
    </div>`;
}

export function renderPeople() {
  const idx = state.index;
  const counts = new Map();
  for (const r of idx.releases) counts.set(r.maintainer, (counts.get(r.maintainer) || 0) + 1);
  const people = Object.values(idx.maintainers).sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));

  return `
    <section class="hero">
      <h1 aria-label="Maintainers"><span aria-hidden="true">${letters("Maintainers")}</span></h1>
      <p>${words("They port the ROMs. They also decide which bugs you learn to live with.", 30, 250)}</p>
    </section>
    <div class="card in" style="--i:3">${people.map((m) => person(m, counts.get(m.id) || 0)).join("")}</div>`;
}

export function renderLoading(text = "Loading builds") {
  return `<div class="loading">${spinner("spin spin--lg", text)}<span>${esc(text)}</span></div>`;
}

export function renderError(message) {
  return `
    <div class="empty">
      <h3>Could not load the builds</h3>
      <p>${esc(message)}</p>
      <p style="margin-top:20px"><a class="btn press" href="">Try again</a></p>
    </div>`;
}
