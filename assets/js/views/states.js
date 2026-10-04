/* transient states ------------------------------------------------------- */
import { esc } from "./shared.js";

export function renderLoading(text = "Loading builds") {
  return `<div class="loading"><md-linear-progress indeterminate role="status" aria-label="${esc(text)}"></md-linear-progress><span class="t-body-medium">${esc(text)}</span></div>`;
}
/* A real button, not <md-filled-button href="">: an empty href resolves to the
   current URL, which only looks like a retry. app.js wires #retry to a reload. */
export function renderError(message) {
  return `<div class="empty"><h3 class="t-title-medium">Could not load the builds</h3><p class="t-body-medium muted">${esc(message)}</p>
    <md-filled-button id="retry">Try Again</md-filled-button></div>`;
}
