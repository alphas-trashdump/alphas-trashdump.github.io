/* rendering ---------------------------------------------------------- */
import { state, filtered, groupByDevice, fmtDate, relDays, isFresh, mirrorHint } from "./store.js";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
const enc = (s) => encodeURIComponent(String(s));

const PATHS = {
  chevron: "M9.5 5.5 16 12l-6.5 6.5",
  back: "M14.5 5.5 8 12l6.5 6.5",
  down: "M12 4v12m0 0 5-5m-5 5-5-5M5 20h14",
  external: "M7 17 17 7M9 7h8v8",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2",
  x: "M6 6l12 12M18 6 6 18",
  people: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6",
  link: "M9.5 13.5 14 9m-3.2-1.8 1.4-1.4a3.3 3.3 0 0 1 4.7 4.7l-1.4 1.4m-4.6 4.6-1.4 1.4a3.3 3.3 0 0 1-4.7-4.7l1.4-1.4",
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
  stable: { cls: "tag--ok", text: "stable" },
  beta: { cls: "tag--accent", text: "beta" },
  experimental: { cls: "tag--warn", text: "experimental" },
};
const tag = (ch) => {
  const c = CHANNEL[ch] || CHANNEL.stable;
  return `<span class="tag ${c.cls}"><i></i>${c.text}</span>`;
};
const meta = (parts) => parts.filter(Boolean).map((p) => `<span>${p}</span>`).join("");

/* ---- home ---------------------------------------------------------- */

export function renderHome() {
  const idx = state.index;
  const rows = filtered();
  const groups = groupByDevice(rows);
  const latest = idx.releases.reduce((a, r) => (r.date > a ? r.date : a), "");

  const chips = [
    { key: "all", href: "#/", label: "All", n: idx.releases.length },
    ...idx.devices.map((d) => ({
      key: d.codename,
      href: `#/d/${enc(d.codename)}`,
      label: d.codename,
      n: idx.releases.filter((r) => r.device === d.codename).length,
    })),
  ];

  const list = rows.length
    ? groups.map(groupBlock).join("")
    : `<div class="empty">
         <p class="empty__t">Nothing matches.</p>
         <p>Try the codename or the Android version.</p>
       </div>`;

  return `
    <div class="home">
      <div class="home__top">
        <section class="hero">
          <h1 class="display">ROM ports for <em>msm8937</em> Redmis.</h1>
          <p class="hero__meta meta mono">${meta([
            `${idx.releases.length} builds`,
            `${idx.devices.length} devices`,
            latest ? `last drop ${fmtDate(latest)}` : null,
          ])}</p>
        </section>
        <div class="tools">
          <label class="search" data-filled="${state.query ? 1 : 0}">
            ${icon("search", "ico ico--sm")}
            <input id="q" type="search" inputmode="search" autocomplete="off" spellcheck="false"
                   placeholder="Search builds" value="${esc(state.query)}" aria-label="Search builds">
            <button type="button" id="q-clear" aria-label="Clear search">${icon("x", "ico ico--sm")}</button>
          </label>
          <nav class="filter" aria-label="Filter by device">
            ${chips.map((c) => `
              <a class="chip" href="${c.href}"${state.device === c.key ? ' aria-current="page"' : ""}>
                ${esc(c.label)}<span>${c.n}</span>
              </a>`).join("")}
          </nav>
        </div>
      </div>
      <div class="home__list">${list}</div>
    </div>`;
}

function groupBlock({ device, list }) {
  return `
    <section class="group">
      <header class="group__head">
        <h2>${esc(device.codename)}</h2>
        <span>${esc(device.fullName || device.name || "")}</span>
      </header>
      <ul class="list">${list.map(row).join("")}</ul>
    </section>`;
}

function row(rel) {
  return `
    <li>
      <a class="row" href="#/r/${enc(rel.device)}/${enc(rel.id)}">
        <div class="row__main">
          <div class="row__title">${esc(rel.name)}${isFresh(rel.date) ? '<span class="new">new</span>' : ""}</div>
          <div class="row__meta meta mono">${meta([
            tag(rel.channel),
            `Android ${esc(rel.android)}`,
            esc(rel.size),
            fmtDate(rel.date),
          ])}</div>
        </div>
        ${icon("chevron", "ico ico--sm row__chev")}
      </a>
    </li>`;
}

/* ---- release ------------------------------------------------------- */

export function renderRelease(rel) {
  const [primary, ...mirrors] = rel.mirrors;
  return `
    <article class="release">
      <header class="release__head">
        <p class="crumb mono">
          <a href="#/d/${enc(rel.device)}">${esc(rel.device)}</a><span>/</span>${esc(rel.id)}
        </p>
        <h1 class="display">${esc(rel.name)}</h1>
        <p class="release__meta meta mono">${meta([
          tag(rel.channel),
          `Android ${esc(rel.android)}`,
          esc(rel.size),
          fmtDate(rel.date),
          relDays(rel.date),
        ])}</p>
        ${noteBlock(rel)}
      </header>

      <div class="release__side">
        <section class="sec sec--dl">
          ${primary ? cta(primary, rel) : ""}
          ${mirrors.length ? `<h2 class="sec__h">Mirrors</h2><ul class="list">${mirrors.map(linkRow).join("")}</ul>` : ""}
          ${rel.extras.length ? `<h2 class="sec__h">Also flash</h2><ul class="list">${rel.extras.map(linkRow).join("")}</ul>` : ""}
          ${rel.recovery ? `<h2 class="sec__h">Recovery</h2><ul class="list">${linkRow(rel.recovery)}</ul>` : ""}
        </section>
        ${infoBlock(rel)}
        <section class="sec sec--who">
          <h2 class="sec__h">Ported by</h2>
          ${person(rel.maintainer_)}
        </section>
      </div>

      <div class="release__main">
        ${shotsBlock(rel)}
        ${listBlock("How to flash", rel.install, "steps", "sec--install")}
        ${listBlock("Known bugs", rel.bugs, "bullets bullets--bad", "sec--bugs", "Nothing reported yet.")}
        ${listBlock("Changelog", rel.changelog, "bullets", "sec--log")}
        <section class="sec sec--legal">
          <button class="btn btn--block" id="share">${icon("link", "ico ico--sm")}Copy link</button>
          <p class="legal mono">You flash this at your own risk. Nobody here is responsible for lost data or a bricked device.</p>
        </section>
      </div>
    </article>`;
}

function cta(m, rel) {
  return `
    <a class="cta" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">
      <b>Download</b>
      <small class="mono">${esc(mirrorHint(m.url))}${rel.size ? ` · ${esc(rel.size)}` : ""}</small>
      ${icon("down")}
    </a>`;
}

function linkRow(item) {
  return `
    <li>
      <a class="row row--link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">
        <div class="row__main">
          <div class="row__title">${esc(item.label)}</div>
          <div class="row__meta mono" style="color:var(--fg-3)">${esc(mirrorHint(item.url))}</div>
        </div>
        ${icon("external", "ico ico--sm row__chev")}
      </a>
    </li>`;
}

function noteBlock(rel) {
  if (!rel.notes) return "";
  const raw = Array.isArray(rel.notes) ? rel.notes.join("\n") : String(rel.notes);
  const html = esc(raw)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, "<br>");
  return `<div class="callout${rel.noteStyle === "quiet" ? " callout--quiet" : ""}">${html}</div>`;
}

function shotsBlock(rel) {
  const album = rel.screenshotsAlbum;
  const albumRow = album ? `<ul class="list shots__album">${linkRow({ label: "Full album", url: album })}</ul>` : "";

  if (!rel.screenshots.length) {
    if (!album) return "";
    return `
      <section class="sec sec--shots">
        <h2 class="sec__h">Screenshots</h2>
        <ul class="list">${linkRow({ label: "Open album", url: album })}</ul>
        <p class="shots__hint mono">Not mirrored here yet.</p>
      </section>`;
  }

  const thumbs = rel.screenshots.map((src, i) => `
    <button type="button" data-shot="${i}" aria-label="Open screenshot ${i + 1}">
      ${spinner("spin spin--sm")}
      <img src="${esc(src)}" alt="Screenshot ${i + 1} of ${esc(rel.name)}" loading="lazy" decoding="async" data-shot-img>
    </button>`).join("");

  return `
    <section class="sec sec--shots" data-shots-section>
      <h2 class="sec__h">Screenshots · ${rel.screenshots.length}</h2>
      <div class="shots">${thumbs}</div>
      <p class="shots__hint mono" data-shots-hint>Swipe · tap to open</p>
      ${albumRow}
      ${album ? `<template data-shots-fallback-tpl>
        <ul class="list">${linkRow({ label: "Open album", url: album })}</ul>
        <p class="shots__hint mono">Screenshots did not load, use the album instead.</p>
      </template>` : ""}
    </section>`;
}

function listBlock(title, items, cls, secCls, empty) {
  if (!items?.length && !empty) return "";
  const t = cls.startsWith("steps") ? "ol" : "ul";
  const body = items?.length
    ? `<${t} class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</${t}>`
    : `<p class="sec__empty">${esc(empty)}</p>`;
  return `<section class="sec ${secCls}"><h2 class="sec__h">${esc(title)}</h2>${body}</section>`;
}

function infoBlock(rel) {
  const badge = `https://hits.sh/alphas-trashdump.github.io/r/${enc(rel.device)}/${enc(rel.id)}.svg?style=flat-square&label=views&color=1b2128&labelColor=14181d`;
  const rows = [
    ["Device", esc(rel.device_.name)],
    ["Codename", `<span class="mono">${esc(rel.device)}</span>`],
    rel.supports?.length ? ["Also for", rel.supports.map((s) => `<span class="mono">${esc(s)}</span>`).join(", ")] : null,
    ["Android", esc(rel.android)],
    ["Built", fmtDate(rel.date)],
    ["Size", esc(rel.size || "—")],
    ["Views", `<img class="kv__badge" src="${badge}" alt="" height="18" loading="lazy">`],
  ].filter(Boolean);

  return `
    <section class="sec sec--details">
      <h2 class="sec__h">Details</h2>
      <dl class="kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    </section>`;
}

/* ---- people -------------------------------------------------------- */

export function person(m, count) {
  const links = (m.links || []).map((l) => `
    <a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
      ${esc(l.label)}${icon("external", "ico")}
    </a>`).join("");
  const badges = (m.badges || []).map((b) => `<span class="chip chip--flat">${esc(b)}</span>`).join("");

  return `
    <div class="person">
      <img class="person__pic" src="${esc(m.avatar || "")}" alt="" width="44" height="44" loading="lazy" decoding="async">
      <div class="person__body">
        <div class="person__name">
          <b>${esc(m.name)}</b>
          ${count != null ? `<span class="mono">${count} build${count === 1 ? "" : "s"}</span>` : ""}
        </div>
        <p class="person__tag mono">${esc(m.tag || "")}${m.pronouns ? ` · ${esc(m.pronouns)}` : ""}</p>
        ${m.bio ? `<p class="person__bio">${esc(m.bio)}</p>` : ""}
        <div class="person__links">${badges}${links}</div>
      </div>
    </div>`;
}

export function renderPeople() {
  const idx = state.index;
  const counts = new Map();
  for (const r of idx.releases) counts.set(r.maintainer, (counts.get(r.maintainer) || 0) + 1);
  const people = Object.values(idx.maintainers)
    .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));

  return `
    <section class="hero">
      <h1 class="display">The <em>culprits</em>.</h1>
      <p class="hero__sub">They port the ROMs. They also decide which bugs you learn to live with.</p>
    </section>
    <ul class="list list--people">
      ${people.map((m) => `<li>${person(m, counts.get(m.id) || 0)}</li>`).join("")}
    </ul>`;
}

export function renderLoading(text = "Loading builds") {
  return `<div class="loading">${spinner("spin spin--lg", text)}<span class="mono">${esc(text)}</span></div>`;
}

export function renderError(message) {
  return `
    <div class="empty">
      <p class="empty__t">Could not load the builds.</p>
      <p class="mono">${esc(message)}</p>
      <p style="margin-top:20px"><a class="btn" href="">Try again</a></p>
    </div>`;
}
