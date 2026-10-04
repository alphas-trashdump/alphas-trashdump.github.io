/* shared view helpers ---------------------------------------------------
   Escaping, the two text animations, and the one channel label the site
   shows. Everything here is pure: string in, string out. */
import { icon } from "../lib/icons.js";

/* Stable builds carry no tag: it was noise on every row. Beta and experimental
   both read Beta, which is the only channel tag the site shows. */
const CHANNEL = { stable: "", beta: "Beta", experimental: "Beta" };

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export const enc = (s) => encodeURIComponent(String(s));

/* text motion */
export function letters(text, start = 0, step = 20) {
  let n = 0;
  return String(text).split(/(\s+)/).map((chunk) => {
    if (!chunk) return "";
    if (!chunk.trim()) return " ";
    return `<span class="w notranslate" translate="no">${[...chunk].map((ch) => `<span class="ch notranslate" translate="no" style="--n:${n};--d:${start + (n++) * step}ms">${esc(ch)}</span>`).join("")}</span>`;
  }).join("");
}
export function digits(v, start = 0) {
  return `<span class="num">${[...String(v)].map((d, n) => `<span class="dg" style="--d:${start + n * 50}ms">${esc(d)}</span>`).join("")}</span>`;
}
export { icon };

/* the only channel label the site shows */
export const channel = (ch) => CHANNEL[ch] ?? "";
