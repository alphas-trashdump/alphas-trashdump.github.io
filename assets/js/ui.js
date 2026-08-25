/* rendering ---------------------------------------------------------- */
import { state, filtered, groupByDevice, fmtDate, relDays, isFresh, mirrorHint } from "./store.js";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const PATHS = {
  chevron: "M9.5 5.5 16 12l-6.5 6.5",
  back: "M14.5 5.5 8 12l6.5 6.5",
  download: "M12 4v11m0 0 4-4m-4 4-4-4M5 19h14",
  external: "M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2",
  x: "M6 6l12 12M18 6 6 18",
  info: "M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  alert: "M12 9v5m0 3h.01M10.3 4.3 2.6 17.5A1.6 1.6 0 0 0 4 20h16a1.6 1.6 0 0 0 1.4-2.5L13.7 4.3a1.6 1.6 0 0 0-2.8 0z",
  people: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6",
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z",
  link: "M9.5 13.5 14 9m-3.2-1.8 1.4-1.4a3.3 3.3 0 0 1 4.7 4.7l-1.4 1.4m-4.6 4.6-1.4 1.4a3.3 3.3 0 0 1-4.7-4.7l1.4-1.4",
  image: "M4 5h16v14H4zM4 16l4.5-4.5 3 3L15 11l5 5",
  send: "M21 4 3 11l7 2.5L12.5 21z",
  code: "M9 8l-4 4 4 4m6-8 4 4-4 4",
};

export function icon(name, cls = "ico") {
  const d = PATHS[name];
  return d ? `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>` : "";
}

/* HyperOS-style spinner: faint ring, one dot orbiting inside it */
export function spinner(cls = "spin", label = "") {
  return `<span class="${cls}" role="${label ? "status" : "presentation"}"${label ? ` aria-label="${esc(label)}"` : ' aria-hidden="true"'}>
    <svg viewBox="0 0 14 14">
      <circle class="spin__ring" cx="7" cy="7" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <circle class="spin__dot" cx="4.2" cy="7" r="1.4" fill="currentColor"/>
    </svg>
  </span>`;
}

const CHANNEL = {
  stable: { cls: "pill--ok", text: "stable" },
  beta: { cls: "pill--accent", text: "beta" },
  experimental: { cls: "pill--warn", text: "experimental" },
};

/* ---- home ---------------------------------------------------------- */

export function renderHome() {
  const rows = filtered();
  const groups = groupByDevice(rows);

  const body = rows.length
    ? groups.map(groupBlock).join("")
    : `<div class="empty">
         <h3>nothing here</h3>
         <p>No build matches that. Try the codename instead.</p>
       </div>`;

  return `
    <section class="hero">
      <h1>alpha's <em>trashdump</em></h1>
    </section>

    <div class="search" data-filled="${state.query ? 1 : 0}">
      ${icon("search", "ico")}
      <input id="q" type="search" inputmode="search" autocomplete="off" spellcheck="false"
             placeholder="Search builds" value="${esc(state.query)}">
      <button type="button" id="q-clear" aria-label="clear search">${icon("x", "ico")}</button>
    </div>

    ${body}
  `;
}

function groupBlock({ device, list }) {
  return `
    <section class="group">
      <div class="cap group__cap">
        <b>${esc(device.codename)}</b>
        <span>${list.length} build${list.length === 1 ? "" : "s"}</span>
      </div>
      <div class="card">${list.map(row).join("")}</div>
    </section>`;
}

function row(rel) {
  const meta = [
    `Android ${esc(rel.android)}`,
    rel.channel !== "stable" ? esc(rel.channel) : null,
    esc(rel.size || ""),
    fmtDate(rel.date),
  ].filter(Boolean).join(" &middot; ");

  return `
    <a class="row" href="#/r/${esc(rel.device)}/${esc(rel.id)}">
      <div class="row__body">
        <div class="row__title">
          ${isFresh(rel.date) ? '<i class="dot" title="recent"></i>' : ""}
          <span>${esc(rel.name)}</span>
        </div>
        <div class="row__meta">${meta}</div>
      </div>
      ${icon("chevron", "ico row__chev")}
    </a>`;
}

/* ---- release ------------------------------------------------------- */

export function renderRelease(rel) {
  const c = CHANNEL[rel.channel] || CHANNEL.stable;
  return `
    <article class="detail">
      <header class="detail__head">
        <h1>${esc(rel.name)}</h1>
        <div class="detail__pills">
          <span class="pill pill--accent">Android ${esc(rel.android)}</span>
          <span class="pill ${c.cls}">${c.text}</span>
          ${rel.size ? `<span class="pill">${esc(rel.size)}</span>` : ""}
          <span class="pill">${fmtDate(rel.date)}</span>
        </div>
      </header>

      ${noteBlock(rel)}

      ${downloadBlock(rel)}
      ${shotsBlock(rel)}
      ${listBlock("How to flash", rel.install, "steps")}
      ${listBlock("Known bugs", rel.bugs, "bullets bullets--bad")}
      ${listBlock("What changed", rel.changelog, "bullets")}
      ${infoBlock(rel)}

      <div class="block">
        <div class="cap">Maintainer</div>
        <div class="card">${person(rel.maintainer_)}</div>
      </div>

      <div class="note note--bad">
        ${icon("alert", "ico")}
        <span>Flashing wipes everything and can brick the phone. Keep a working recovery
        nearby and read the bugs first.</span>
      </div>

      <div class="block">
        <button class="btn btn--block" id="share">${icon("link", "ico ico--sm")} Copy link</button>
      </div>
    </article>`;
}

/* A release note is optional, and when present it can be loud (highlighted
   callout) or quiet (plain line under the title). */
function noteBlock(rel) {
  if (!rel.notes) return "";
  if (rel.noteStyle === "quiet") {
    return `<p class="quiet-note">${esc(rel.notes)}</p>`;
  }
  return `<div class="note">${icon("info", "ico")}<span>${esc(rel.notes)}</span></div>`;
}

function dlRow(item, kind) {
  return `
    <a class="dlrow ${kind === "primary" ? "" : "dlrow--extra"}" href="${esc(item.url)}"
       target="_blank" rel="noopener noreferrer">
      <span class="dlrow__ico">${icon(kind === "primary" ? "download" : "external", "ico")}</span>
      <span class="dlrow__txt">
        <b>${esc(item.label)}</b>
        <small>${esc(mirrorHint(item.url))}</small>
      </span>
      ${icon("chevron", "ico ico--sm")}
    </a>`;
}

function downloadBlock(rel) {
  const mirrors = rel.mirrors.map((m, i) => dlRow(m, i === 0 ? "primary" : "mirror")).join("");
  const extras = rel.extras.length ? `
      <div class="cap" style="margin-top:18px">Also flash these</div>
      <div class="card">${rel.extras.map((e) => dlRow(e, "extra")).join("")}</div>` : "";
  const recovery = rel.recovery ? `
      <div class="cap" style="margin-top:18px">Recovery</div>
      <div class="card">${dlRow(rel.recovery, "extra")}</div>` : "";

  return `
    <div class="block">
      <div class="cap">Download${rel.mirrors.length > 1 ? ` &middot; ${rel.mirrors.length} mirrors` : ""}</div>
      <div class="card">${mirrors}</div>
      ${extras}
      ${recovery}
    </div>`;
}

function shotsBlock(rel) {
  const album = rel.screenshotsAlbum;

  if (!rel.screenshots.length) {
    if (!album) return "";
    return `
      <div class="block" data-shots-fallback>
        <div class="cap">Screenshots</div>
        <div class="card">${dlRow({ label: "Open album", url: album }, "extra")}</div>
        <p class="shots__hint">Not mirrored here yet.</p>
      </div>`;
  }

  const thumbs = rel.screenshots.map((src, i) => `
    <button type="button" data-shot="${i}" aria-label="open screenshot ${i + 1}">
      ${spinner("spin spin--sm")}
      <img src="${esc(src)}" alt="Screenshot ${i + 1} of ${esc(rel.name)}"
           loading="lazy" decoding="async" data-shot-img>
    </button>`).join("");

  return `
    <div class="block" data-shots-section>
      <div class="cap">Screenshots &middot; ${rel.screenshots.length}</div>
      <div class="shots">${thumbs}</div>
      <p class="shots__hint" data-shots-hint>Swipe, tap to open</p>
      ${album ? `<div class="card" style="margin-top:12px">${dlRow({ label: "Full album", url: album }, "extra")}</div>` : ""}
      ${album ? `<template data-shots-fallback-tpl>
        <div class="card">${dlRow({ label: "Open album", url: album }, "extra")}</div>
        <p class="shots__hint">Screenshots did not load, use the album instead.</p>
      </template>` : ""}
    </div>`;
}

function listBlock(title, items, cls) {
  if (!items?.length) return "";
  const tag = cls.startsWith("steps") ? "ol" : "ul";
  return `
    <div class="block">
      <div class="cap">${esc(title)}</div>
      <div class="card"><${tag} class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}></div>
    </div>`;
}

function infoBlock(rel) {
  const m = rel.maintainer_;
  const rows = [
    ["Device", `${esc(rel.device_.name)} (${esc(rel.device_.codename)})`],
    rel.supports?.length ? ["Also supports", rel.supports.map(esc).join(", ")] : null,
    ["Build date", `${fmtDate(rel.date)} <span class="dim">&middot; ${relDays(rel.date)}</span>`],
    ["Ported by", esc(m.name)],
  ].filter(Boolean);

  return `
    <div class="block">
      <div class="cap">Details</div>
      <dl class="card">
        ${rows.map(([k, v]) => `<div class="kv"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}
      </dl>
    </div>`;
}

/* ---- people -------------------------------------------------------- */

export function person(m) {
  const links = (m.links || []).map((l) => `
    <a class="pill" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
      ${esc(l.label)}
    </a>`).join("");
  const badges = (m.badges || []).map((b) =>
    `<span class="pill ${b === "owner" ? "pill--accent" : ""}">${esc(b)}</span>`).join("");

  return `
    <div class="person">
      <img class="person__pic" src="${esc(m.avatar || "")}" alt="" loading="lazy" decoding="async">
      <div class="person__body">
        <div class="person__name">
          <b>${esc(m.name)}</b>
          <span>${esc(m.tag || "")}${m.pronouns ? ` &middot; ${esc(m.pronouns)}` : ""}</span>
        </div>
        ${m.bio ? `<p class="person__bio">${esc(m.bio)}</p>` : ""}
        <div class="person__links">${badges}${links}</div>
      </div>
    </div>`;
}

export function renderPeople() {
  const idx = state.index;
  const people = Object.values(idx.maintainers);
  const counts = new Map();
  for (const r of idx.releases) counts.set(r.maintainer, (counts.get(r.maintainer) || 0) + 1);

  return `
    <section class="hero">
      <h1>the <em>culprits</em></h1>
      <p>They port the ROMs. They also decide which bugs you learn to live with.</p>
    </section>
    <div class="card">${people.map(person).join("")}</div>
    <div class="cap" style="padding-top:16px">Scoreboard</div>
    <dl class="card">
      ${people.map((m) => `
        <div class="kv">
          <dt>${esc(m.name)}</dt>
          <dd>${counts.get(m.id) || 0} build${(counts.get(m.id) || 0) === 1 ? "" : "s"}</dd>
        </div>`).join("")}
    </dl>`;
}

export function renderLoading(text = "Loading builds") {
  return `<div class="loading">${spinner("spin spin--lg spin--accent", text)}<span>${esc(text)}</span></div>`;
}

export function renderError(message) {
  return `
    <div class="empty">
      <h3>could not load the builds</h3>
      <p>${esc(message)}</p>
      <p style="margin-top:18px"><a class="btn" href="">Try again</a></p>
    </div>`;
}
