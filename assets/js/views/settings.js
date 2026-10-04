/* settings --------------------------------------------------------------- */
import { ACCENTS, settings } from "../lib/settings.js";
import { esc, letters, icon } from "./shared.js";

export function renderSettings() {
  const { theme, accent } = settings;
  return `
    <div class="settings">
      <section class="hero">
        <h1 class="t-headline-large notranslate" translate="no"><span aria-hidden="true" translate="no" class="notranslate">${letters("Settings")}</span></h1>
      </section>

      <section class="block in" style="--i:0">
        <h2 class="subhead t-title-small">Theme</h2>
        <md-outlined-card>
          <md-list>
            <md-list-item type="text">
              <md-icon slot="start">${icon(theme === "dark" ? "moon" : "sun", "ico ico--md")}</md-icon>
              <span slot="headline">Dark theme</span>
              <md-switch slot="end" id="theme-switch" aria-label="Dark theme"${theme === "dark" ? " selected" : ""}></md-switch>
            </md-list-item>
          </md-list>
        </md-outlined-card>
      </section>

      <section class="block in" style="--i:1">
        <h2 class="subhead t-title-small">Accent</h2>
        <md-chip-set class="filters" id="accents" aria-label="Accent colour">
          ${ACCENTS.map((a) => `
            <md-filter-chip label="${esc(a.label)}" data-accent="${esc(a.id)}"${accent === a.id ? " selected" : ""}></md-filter-chip>`).join("")}
        </md-chip-set>
      </section>
    </div>`;
}
