/* router + wiring ---------------------------------------------------- */
import { state, loadIndex, getRelease, hostOf } from "./store.js";
import { renderHome, renderList, renderRelease, renderPeople, renderError, renderLoading, spinner, icon, esc } from "./ui.js";

const BRAND = "alpha's trashdump";
const APP_HOSTS = new Set(["t.me", "telegram.me", "telegram.dog"]);

const root = document.getElementById("app");
const top = document.getElementById("top");
const topTitle = document.getElementById("top-title");
const backBtn = document.getElementById("back");
const lb = document.getElementById("lb");
const lbTrack = document.getElementById("lb-track");
const lbCount = document.getElementById("lb-count");
const toastEl = document.getElementById("toast");
const sheet = document.getElementById("sheet");
const sheetBox = document.getElementById("sheet-box");
const sheetHost = document.getElementById("sheet-host");
const sheetGo = document.getElementById("sheet-go");
const sheetCancel = document.getElementById("sheet-cancel");

const isDialog = () => matchMedia("(orientation: landscape) and (max-height: 500px)").matches;

let shots = [];
let toastTimer = 0;
let depth = 0;      /* in-site navigations, so Back can use history when safe */
let titleIO = null; /* watches the large title */
let navDir = "none"; /* push | pop | none — drives the page slide */

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

function lockScroll(on) {
  document.documentElement.style.overflow = on ? "hidden" : "";
}

function trackImage(img, onFail) {
  const done = () => {
    img.dataset.loaded = "1";
    img.closest("button, figure")?.setAttribute("data-loaded", "1");
  };
  if (img.complete) { img.naturalWidth > 0 ? done() : onFail?.(img); return; }
  img.addEventListener("load", done, { once: true });
  img.addEventListener("error", () => onFail?.(img), { once: true });
}

/* large title collapses into the header once it scrolls under it */
function watchTitle() {
  titleIO?.disconnect();
  const h1 = root.querySelector("h1");
  if (!h1) { document.body.dataset.scrolled = "1"; return; }
  titleIO = new IntersectionObserver(([e]) => {
    document.body.dataset.scrolled = e.isIntersecting ? "0" : "1";
  }, { rootMargin: `-${top.offsetHeight}px 0px 0px 0px`, threshold: 0 });
  titleIO.observe(h1);
}

/* segmented control thumb follows the selected tab */
function layoutSeg(seg) {
  const thumb = seg?.querySelector(".seg__thumb");
  const act = seg?.querySelector('[aria-selected="true"]');
  if (!thumb || !act) return;
  thumb.style.width = `${act.offsetWidth}px`;
  thumb.style.transform = `translateX(${act.offsetLeft}px)`;
  if (seg.dataset.ready !== "1") requestAnimationFrame(() => { seg.dataset.ready = "1"; });
}

/* ---- views --------------------------------------------------------- */

function paint(html, view, title = BRAND) {
  document.body.dataset.view = view;
  document.body.dataset.scrolled = "0";
  document.body.dataset.nav = "none";
  topTitle.textContent = title;
  root.innerHTML = html;
  void root.offsetWidth;                 /* restart the slide animation */
  document.body.dataset.nav = navDir;
  navDir = "none";
  if (view === "home") wireHome();
  if (view === "release") wireRelease();
  watchTitle();
}

function wireHome() {
  const input = root.querySelector("#q");
  const list = root.querySelector("#list");
  const seg = root.querySelector("#seg");
  if (!input || !list) return;
  const search = input.closest(".search");

  const relist = () => { list.innerHTML = renderList(); };

  let debounce = 0;
  input.addEventListener("input", () => {
    state.query = input.value;
    search.dataset.filled = input.value ? "1" : "0";
    clearTimeout(debounce);
    debounce = setTimeout(relist, 120);
  });
  root.querySelector("#q-clear")?.addEventListener("click", () => {
    state.query = "";
    input.value = "";
    search.dataset.filled = "0";
    relist();
    input.focus();
  });

  list.addEventListener("click", (e) => {
    const a = e.target.closest("a.cell");
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    navDir = "push";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    a.classList.add("cell--go");
    setTimeout(() => { location.hash = a.getAttribute("href"); }, 140);
  });

  if (seg) {
    layoutSeg(seg);
    document.fonts?.ready.then(() => layoutSeg(seg));
    seg.addEventListener("click", (e) => {
      const tab = e.target.closest(".seg__it");
      if (!tab) return;
      e.preventDefault();
      const key = tab.dataset.key;
      if (state.device === key) return;
      state.device = key;
      history.replaceState(null, "", tab.getAttribute("href"));
      seg.querySelectorAll(".seg__it").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      tab.scrollIntoView?.({ inline: "nearest", block: "nearest" });
      layoutSeg(seg);
      relist();
    });
  }
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

  imgs.forEach((img) => trackImage(img, (bad) => {
    const btn = bad.closest("button");
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
      p.className = "shots__hint";
      p.textContent = "Screenshots unavailable.";
      section.append(p);
    }
  }));
}

async function route() {
  const r = parseHash();

  let idx = state.index;
  if (!idx) {
    paint(renderLoading(), "home");
    try { idx = await loadIndex(); }
    catch (err) { paint(renderError(err.message || String(err)), "home"); return; }
  }

  if (r.view === "people") {
    setTitle(["Maintainers"]);
    paint(renderPeople(), "people", "Maintainers");
    window.scrollTo(0, 0);
    return;
  }

  if (r.view === "release") {
    const rel = getRelease(r.device, r.id);
    if (!rel) { location.replace("#/"); return; }
    shots = rel.screenshots;
    setTitle([rel.name]);
    paint(renderRelease(rel), "release", rel.name);
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
  lbCount.dataset.text = ""; lbCount.textContent = "";
  lockScroll(true);

  lbTrack.querySelectorAll("img").forEach((img) => trackImage(img, (bad) => {
    const fig = bad.closest("figure");
    if (!fig) return;
    fig.dataset.loaded = "1";
    fig.replaceChildren(Object.assign(document.createElement("p"), { textContent: "This image failed to load" }));
  }));

  requestAnimationFrame(() => {
    lbTrack.scrollLeft = start * lbTrack.clientWidth;
    updateLbCount();
  });
}

function closeLightbox() {
  lb.dataset.open = "0";
  lbTrack.innerHTML = "";
  lockScroll(false);
}

/* iOS numericText: only changed characters roll, direction follows the value */
function rollTo(el, text) {
  const prev = el.dataset.text ?? "";
  if (prev === text) return;
  el.dataset.text = text;
  const old = [...prev];
  el.innerHTML = [...text].map((c, i) => {
    if (old[i] === c) return `<span class="rl">${esc(c)}</span>`;
    const dir = old[i] == null || old[i] < c ? 1 : -1;
    return `<span class="rl rl--in" style="--dir:${dir}">${esc(c)}</span>`;
  }).join("");
}

function updateLbCount() {
  if (lb.dataset.open !== "1" || !lbTrack.clientWidth) return;
  const i = Math.round(lbTrack.scrollLeft / lbTrack.clientWidth);
  rollTo(lbCount, `${Math.min(i + 1, shots.length)} / ${shots.length}`);
}

/* ---- telegram confirm sheet ---------------------------------------- */

let pendingUrl = null;
let closeTimer = 0;

function openSheet(url) {
  clearTimeout(closeTimer);
  pendingUrl = url;
  sheetHost.textContent = url.replace(/^https?:\/\//, "");
  sheetBox.style.transform = "";
  sheet.dataset.closing = "0";
  sheet.dataset.open = "1";
  lockScroll(true);
}

function closeSheet() {
  if (sheet.dataset.open !== "1" || sheet.dataset.closing === "1") return;
  pendingUrl = null;
  sheet.dataset.closing = "1";
  closeTimer = setTimeout(() => {
    sheet.dataset.open = "0";
    sheet.dataset.closing = "0";
    sheetBox.style.transform = "";
    lockScroll(false);
  }, 260);
}

sheetCancel.addEventListener("click", closeSheet);
sheet.querySelector(".sheet__bg").addEventListener("click", closeSheet);
sheetGo.addEventListener("click", () => {
  const url = pendingUrl;
  closeSheet();
  if (url) window.open(url, "_blank", "noopener,noreferrer");
});

/* drag the sheet down to dismiss; springs back if released early */
let drag = null;
sheetBox.addEventListener("pointerdown", (e) => {
  if (isDialog() || e.target.closest("button")) return;
  drag = { y: e.clientY, dy: 0, t: performance.now() };
  sheetBox.setPointerCapture(e.pointerId);
  sheetBox.style.transition = "none";
});
sheetBox.addEventListener("pointermove", (e) => {
  if (!drag) return;
  drag.dy = Math.max(0, e.clientY - drag.y);
  sheetBox.style.transform = `translateY(${drag.dy}px)`;
});
const endDrag = () => {
  if (!drag) return;
  const { dy, t } = drag;
  const velocity = dy / Math.max(1, performance.now() - t); /* px per ms */
  drag = null;
  sheetBox.style.transition = "transform var(--dur) var(--spring)";
  if (dy > 110 || velocity > 0.6) closeSheet();
  else sheetBox.style.transform = "";
};
sheetBox.addEventListener("pointerup", endDrag);
sheetBox.addEventListener("pointercancel", endDrag);

document.addEventListener("click", (e) => {
  const link = e.target.closest?.("a[href]");
  if (!link) return;
  const href = link.getAttribute("href") || "";
  if (!/^https?:/i.test(href) || !APP_HOSTS.has(hostOf(href))) return;
  e.preventDefault();
  openSheet(link.href);
});

/* ---- boot ---------------------------------------------------------- */

document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = icon(el.dataset.icon, "ico");
});

backBtn.addEventListener("click", (e) => {
  navDir = "pop";
  if (depth > 0) { e.preventDefault(); history.back(); }
});
document.querySelector('.top__act[href="#/people"]').addEventListener("click", () => { navDir = "push"; });

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

/* orientation flips: re-measure the seg thumb, lightbox page and title watcher */
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    layoutSeg(root.querySelector("#seg"));
    watchTitle();
    if (lb.dataset.open === "1") {
      const i = Math.round(lbTrack.scrollLeft / (lbTrack.clientWidth || 1));
      lbTrack.scrollLeft = i * lbTrack.clientWidth;
      updateLbCount();
    }
  }, 80);
});

window.addEventListener("hashchange", () => {
  depth += 1;
  if (lb.dataset.open === "1") closeLightbox();
  if (sheet.dataset.open === "1") closeSheet();
  route();
});

route();
