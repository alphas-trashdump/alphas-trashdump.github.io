/* maintainers ------------------------------------------------------------- */
import { state } from "../lib/store.js";
import { esc, letters } from "./shared.js";
import { badges, links } from "./person.js";


/* An empty src makes the browser fetch the page url as an image, so a
   maintainer without one gets their initial instead of a broken image. */
function avatar(m) {
  return m.avatar
    ? `<img slot="start" class="avatar" src="${esc(m.avatar)}" alt="" width="40" height="40" loading="lazy" decoding="async">`
    : `<span slot="start" class="avatar avatar--initial" aria-hidden="true">${esc((m.name || "?").trim()[0])}</span>`;
}

export function personRow(m, count) {
  const sub = [esc(m.tag || ""), m.pronouns ? esc(m.pronouns) : ""].filter(Boolean).join(" · ");
  return `
    <md-list-item type="text" class="person">
      ${avatar(m)}
      <span slot="headline">${esc(m.name)}</span>
      <span slot="supporting-text">${sub}${m.bio ? `<br>${esc(m.bio)}` : ""}</span>
      ${count != null ? `<span slot="trailing-supporting-text">${count} build${count === 1 ? "" : "s"}</span>` : ""}
      <span slot="supporting-text" class="person__chips">${badges(m)}${links(m)}</span>
    </md-list-item>`;
}

export function renderPeople() {
  const idx = state.index;
  const counts = new Map();
  for (const r of idx.releases) counts.set(r.maintainer, (counts.get(r.maintainer) || 0) + 1);
  const people = Object.values(idx.maintainers).sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
  return `
    <section class="hero">
      <h1 class="t-headline-large notranslate" translate="no" aria-label="Maintainers"><span aria-hidden="true" translate="no" class="notranslate">${letters("Maintainers")}</span></h1>
      <p class="t-body-medium muted">They port the ROMs. They also decide which bugs you learn to live with.</p>
    </section>
    <md-outlined-card class="in" style="--i:3">
      <md-list>${people.map((m) => personRow(m, counts.get(m.id) || 0)).join("")}</md-list>
    </md-outlined-card>`;
}
