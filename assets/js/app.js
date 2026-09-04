/* router + wiring ---------------------------------------------------- */
import { state, loadIndex, getRelease, hostOf } from "./store.js";
import { renderHome, renderRelease, renderPeople, renderError, renderLoading, spinner, icon } from "./ui.js";

const BRAND = "alpha's trashdump";
const APP_HOSTS = new Set(["t.me", "telegram.me", "telegram.dog"]);

const root = document.getElementById("app");
const topTitle = document.getElementById("top-title");
const backBtn = document.getElementById("back");
const lb = document.getElementById("lb");
const lbTrack = document.getElementById("lb-track");
const lbCount = document.getElementById("lb-count");
const toastEl = document.getElementById("toast");
const sheet = document.getElementById("sheet");
const sheetHost = document.getElementById("sheet-host");
const sheetGo = document.getElementById("sheet-go");
const sheetCancel = document.getElementById("sheet-cancel");

let shots = [];
let toastTimer = 0;
let depth = 0; /* in-site navigations so far; lets "back" use history when safe */

/* ---- helpers ------------------------------------------------------- */

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.dataset.show = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.dataset.show = "0"; }, 1800);
}

function setTitle(parts) {
  document.title = [...parts, BRAND].filter(Boolean).join(" — ");
}

function parseHash() {
  const seg = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (!seg.length) return { view: "home" };
  if (seg[0] === "people") return { view: "people" };
  if (seg[0] === "d" && seg[1]) return { view: "home", device: seg[1] };
  if (seg[0] === "r" && seg[1] && seg[2]) return { view: "release", device: seg[1], id: seg[2] };
  return { view: "home" };
}

function trackImage(img, onFail) {
  const done = () => {
    img.dataset.loaded = "1";
    img.closest("button, figure")?.setAttribute("data-loaded", "1");
  };
  if (img.complete) {
    if (img.naturalWidth > 0) done(); else onFail?.(img);
    return;
  }
  img.addEventListener("load", done, { once: true });
  img.addEventListener("error", () => onFail?.(img), { once: true });
}

/* ---- views --------------------------------------------------------- */

function paint(html, view, { title = BRAND, animate = true } = {}) {
  document.body.dataset.view = view;
  topTitle.textContent = title;
  root.innerHTML = html;
  if (animate) {
    root.classList.remove("is-in");
    void root.offsetWidth;
    root.classList.add("is-in");
  }
  if (view === "home") wireHome();
  if (view === "release") wireRelease();
}

function wireHome() {
  const input = root.querySelector("#q");
  if (!input) return;
  const search = input.closest(".search");
  const rerender = () => {
    const focused = document.activeElement === input;
    const pos = input.selectionStart;
    paint(renderHome(), "home", { animate: false });
    if (focused) {
      const next = root.querySelector("#q");
      next.focus();
      next.setSelectionRange(pos, pos);
    }
  };
  let debounce = 0;
  input.addEventListener("input", () => {
    state.query = input.value;
    search.dataset.filled = input.value ? "1" : "0";
    clearTimeout(debounce);
    debounce = setTimeout(rerender, 120);
  });
  root.querySelector("#q-clear")?.addEventListener("click", () => {
    state.query = "";
    rerender();
  });
}

function wireRelease() {
  root.querySelector("#share")?.addEventListener("click", async () => {
    try {
      if (navigator.share) await navigator.share({ url: location.href, title: document.title });
      else { await navigator.clipboard.writeText(location.href); toast("Link copied"); }
    } catch { toast("Could not copy"); }
  });
  root.querySelectorAll("[data-shot]").forEach((btn) => {
    btn.addEventListener("click", () => openLightbox(Number(btn.dataset.shot)));
  });
  watchShots();
}

/* dead screenshots drop out; if all die, fall back to the album link */
function watchShots() {
  const section = root.querySelector("[data-shots-section]");
  if (!section) return;
  const imgs = [...section.querySelectorAll("[data-shot-img]")];
  if (!imgs.length) return;

  const all = shots.slice();
  const dead = new Set();

  const onFail = (img) => {
    const btn = img.closest("button");
    const i = Number(btn?.dataset.shot);
    if (Number.isInteger(i)) dead.add(i);
    btn?.remove();
    shots = all.filter((_, n) => !dead.has(n));
    if (dead.size < imgs.length) return;

    section.querySelector(".shots")?.remove();
    section.querySelector("[data-shots-hint]")?.remove();
    section.querySelector(".shots__album")?.remove();
    const tpl = section.querySelector("[data-shots-fallback-tpl]");
    if (tpl) { section.append(tpl.content.cloneNode(true)); tpl.remove(); }
    else {
      const p = document.createElement("p");
      p.className = "shots__hint mono";
      p.textContent = "Screenshots unavailable.";
      section.append(p);
    }
  };

  imgs.forEach((img) => trackImage(img, onFail));
}

async function route() {
  const r = parseHash();

  let idx = state.index;
  if (!idx) {
    paint(renderLoading(), "home", { animate: false });
    try { idx = await loadIndex(); }
    catch (err) { paint(renderError(err.message || String(err)), "home"); return; }
  }

  if (r.view === "people") {
    setTitle(["Maintainers"]);
    paint(renderPeople(), "people", { title: "maintainers" });
    window.scrollTo(0, 0);
    return;
  }

  if (r.view === "release") {
    const rel = getRelease(r.device, r.id);
    if (!rel) { location.replace("#/"); return; }
    shots = rel.screenshots;
    setTitle([rel.name]);
    paint(renderRelease(rel), "release", { title: rel.name });
    window.scrollTo(0, 0);
    return;
  }

  state.device = r.device && idx.byCodename.has(r.device) ? r.device : "all";
  setTitle([]);
  paint(renderHome(), "home");
}

/* ---- lightbox ------------------------------------------------------ */

function openLightbox(start) {
  if (!shots.length) return;
  lbTrack.innerHTML = shots.map((src, i) => `
    <figure>
      ${spinner("spin spin--lg spin--on-dark")}
      <img src="${src}" alt="Screenshot ${i + 1}" decoding="async">
    </figure>`).join("");
  lb.dataset.open = "1";
  document.documentElement.style.overflow = "hidden";

  lbTrack.querySelectorAll("img").forEach((img) => trackImage(img, (bad) => {
    const fig = bad.closest("figure");
    if (!fig) return;
    fig.dataset.loaded = "1";
    fig.replaceChildren(Object.assign(document.createElement("p"), { textContent: "image failed to load" }));
  }));

  requestAnimationFrame(() => {
    lbTrack.scrollLeft = start * lbTrack.clientWidth;
    updateLbCount();
  });
}

function closeLightbox() {
  lb.dataset.open = "0";
  lbTrack.innerHTML = "";
  document.documentElement.style.overflow = "";
}

function updateLbCount() {
  if (lb.dataset.open !== "1" || !lbTrack.clientWidth) return;
  const i = Math.round(lbTrack.scrollLeft / lbTrack.clientWidth);
  lbCount.textContent = `${Math.min(i + 1, shots.length)} / ${shots.length}`;
}

/* ---- telegram confirm ---------------------------------------------- */

let pendingUrl = null;

function askBeforeLeaving(url) {
  pendingUrl = url;
  sheetHost.textContent = url.replace(/^https?:\/\//, "");
  sheet.dataset.open = "1";
}
function closeSheet() {
  sheet.dataset.open = "0";
  pendingUrl = null;
}

sheetCancel.addEventListener("click", closeSheet);
sheet.querySelector(".sheet__bg").addEventListener("click", closeSheet);
sheetGo.addEventListener("click", () => {
  const url = pendingUrl;
  closeSheet();
  if (url) window.open(url, "_blank", "noopener,noreferrer");
});

document.addEventListener("click", (e) => {
  const link = e.target.closest?.("a[href]");
  if (!link) return;
  const href = link.getAttribute("href") || "";
  if (!/^https?:/i.test(href) || !APP_HOSTS.has(hostOf(href))) return;
  e.preventDefault();
  askBeforeLeaving(link.href);
});

/* ---- boot ---------------------------------------------------------- */

document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = icon(el.dataset.icon, "ico");
});

backBtn.addEventListener("click", (e) => {
  if (depth > 0) { e.preventDefault(); history.back(); }
});

window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (sheet.dataset.open === "1") closeSheet();
  else if (lb.dataset.open === "1") closeLightbox();
});

document.getElementById("lb-close").addEventListener("click", closeLightbox);
lb.addEventListener("click", (e) => {
  if (e.target === lb || e.target.tagName === "FIGURE") closeLightbox();
});
lbTrack.addEventListener("scroll", () => requestAnimationFrame(updateLbCount), { passive: true });

/* orientation flips re-measure the lightbox pages */
window.addEventListener("resize", () => {
  if (lb.dataset.open !== "1") return;
  const i = Math.round(lbTrack.scrollLeft / (lbTrack.clientWidth || 1));
  requestAnimationFrame(() => { lbTrack.scrollLeft = i * lbTrack.clientWidth; updateLbCount(); });
});

window.addEventListener("hashchange", () => {
  depth += 1;
  if (lb.dataset.open === "1") closeLightbox();
  if (sheet.dataset.open === "1") closeSheet();
  route();
});

route();
