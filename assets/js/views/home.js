/* home: build list ------------------------------------------------------- */
import { state, filtered, groupByDevice, fmtDate, isFresh } from "../lib/store.js";
import { esc, enc, letters, digits, icon, channel } from "./shared.js";

export function renderHome() {
  const idx = state.index;
  const latest = idx.releases.reduce((a, r) => (r.date > a ? r.date : a), "");
  const devices = [{ codename: "all", name: "All" }, ...idx.devices.map((d) => ({ codename: d.codename, name: d.codename }))];

  return `
    <div class="home">
      <div class="home__top">
        <section class="hero">
          <h1 class="t-headline-large notranslate" translate="no" aria-label="alpha's trashdump"><span aria-hidden="true" translate="no" class="notranslate">${letters("alpha's trashdump")}</span></h1>
          <p class="t-body-medium muted">${digits(idx.releases.length, 300)} builds${latest ? ` · updated ${fmtDate(latest)}` : ""}</p>
        </section>
        <div class="tools in" style="--i:2">
          <md-outlined-text-field id="q" label="Search" type="text" inputmode="search" autocomplete="off"
                 spellcheck="false" aria-label="Search builds" value="${esc(state.query)}">
            <md-icon slot="leading-icon">${icon("search", "ico ico--md")}</md-icon>
            <md-icon-button id="q-clear" slot="trailing-icon" aria-label="Clear search"${state.query ? "" : " hidden"}>
              ${icon("x", "ico ico--md")}
            </md-icon-button>
          </md-outlined-text-field>
          <md-chip-set id="seg" class="filters" aria-label="Device">
            ${devices.map((d) => `
              <md-filter-chip label="${esc(d.name)}" data-key="${esc(d.codename)}" data-href="${d.codename === "all" ? "#/" : `#/d/${enc(d.codename)}`}"${state.device === d.codename ? " selected" : ""}></md-filter-chip>`).join("")}
          </md-chip-set>
        </div>
      </div>
      <div class="home__list" id="list">${renderList()}</div>
    </div>`;
}

function renderList() {
  const rows = filtered();
  if (!rows.length) return `<div class="empty in"><h3 class="t-title-medium">No Results</h3><p class="t-body-medium muted">Try the codename or the Android version.</p></div>`;
  return groupByDevice(rows).map(({ device, list }, i) => `
    <section class="group in" style="--i:${i + 3}">
      <h2 class="subhead t-title-small">${esc(device.name)}</h2>
      <md-outlined-card>
        <md-list>${list.map(row).join("")}</md-list>
      </md-outlined-card>
    </section>`).join("");
}

function row(rel) {
  const tag = channel(rel.channel);
  return `
    <md-list-item type="link" href="#/r/${enc(rel.device)}/${enc(rel.id)}">
      <span slot="headline" class="cell__title">
        <span class="cell__name">${esc(rel.name)}</span>
        ${tag ? `<md-assist-chip class="status" label="${esc(tag)}"></md-assist-chip>` : ""}
        ${isFresh(rel.date) ? '<i class="dot" aria-hidden="true"></i><span class="sr-only">New</span>' : ""}
      </span>
      <span slot="supporting-text">Android ${esc(rel.android)}${rel.size ? ` · ${esc(rel.size)}` : ""}</span>
      <md-icon slot="end">${icon("chevron-right", "ico ico--md")}</md-icon>
    </md-list-item>`;
}

export { renderList };
