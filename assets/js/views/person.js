/* one maintainer row, shared by the release page and the people page ----- */
import { esc } from "./shared.js";
import { icon } from "../lib/icons.js";

export function badges(m) {
  return (m.badges || []).map((b) =>
    `<md-assist-chip class="role${b === "owner" ? " role--owner" : ""}" label="${esc(b)}"></md-assist-chip>`).join("");
}
export function links(m) {
  return (m.links || []).map((l) => `
    <md-assist-chip class="link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" label="${esc(l.label)}">
      <md-icon slot="icon">${icon("external-link", "ico ico--sm")}</md-icon>
    </md-assist-chip>`).join("");
}
