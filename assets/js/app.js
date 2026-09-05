/* router + wiring ---------------------------------------------------- */
import { state, loadIndex, getRelease, hostOf, mirrorHint } from "./store.js";
import { renderHome, renderList, renderRelease, renderPeople, renderError, renderLoading, spinner, icon, esc } from "./ui.js";

const BRAND = "alpha's trashdump";
const APP_HOSTS = new Set(["t.me", "telegram.me", "telegram.dog"]);

const $ = (id) => document.getElementById(id);
const root = $("app"), top = $("top"), topTitle = $("top-title"), backBtn = $("back");
const lb = $("lb"), lbTrack = $("lb-track"), lbCount = $("lb-count"), toastEl = $("toast");

let shots = [];
let toastTimer = 0;
let depth = 0;
let navDir = "none";
let titleIO = null;
let segCtl = null;

/* ---- helpers ------------------------------------------------------- */

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.dataset.show = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.dataset.show = "0"; }, 1800);
}
function setTitle(parts) { document.title = [...parts, BRAND].filter(Boolean).join(" — "); }
function lockScroll(on) { document.documentElement.style.overflow = on ? "hidden" : ""; }

function parseHash() {
  const seg = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (!seg.length) return { view: "home" };
  if (seg[0] === "people") return { view: "people" };
  if (seg[0] === "d" && seg[1]) return { view: "home", device: seg[1] };
  if (seg[0] === "r" && seg[1] && seg[2]) return { view: "release", device: seg[1], id: seg[2] };
  return { view: "home" };
}

function trackImage(img, onFail) {
  const done = () => { img.dataset.loaded = "1"; img.closest("button, figure")?.setAttribute("data-loaded", "1"); };
  if (img.complete) { img.naturalWidth > 0 ? done() : onFail?.(img); return; }
  img.addEventListener("load", done, { once: true });
  img.addEventListener("error", () => onFail?.(img), { once: true });
}

function watchTitle() {
  titleIO?.disconnect();
  const h1 = root.querySelector("h1");
  if (!h1) { document.body.dataset.scrolled = "1"; return; }
  titleIO = new IntersectionObserver(([e]) => { document.body.dataset.scrolled = e.isIntersecting ? "0" : "1"; },
    { rootMargin: `-${top.offsetHeight}px 0px 0px 0px` });
  titleIO.observe(h1);
}

/* ---- segmented control: tap a segment, or drag the thumb ----------- */

function wireSeg(seg, onChange) {
  const thumb = seg.querySelector(".seg__thumb");
  const tabs = [...seg.querySelectorAll(".seg__it")];
  let cur = tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0];
  let x = 0, drag = null, live = 0;

  const fit = (t) => { thumb.style.width = `${t.offsetWidth}px`; };
  const place = (t) => { x = t.offsetLeft; fit(t); thumb.style.transform = `translateX(${x}px)`; };
  const mark = (t) => {
    if (t === cur) return;
    cur = t;
    tabs.forEach((b) => { const on = b === t; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
    navigator.vibrate?.(5);
  };
  const commit = () => onChange(cur.dataset.key, cur.dataset.href);
  const select = (t) => { mark(t); place(t); commit(); };
  const nearest = (cx) => tabs.reduce((b, t) =>
    Math.abs(t.offsetLeft + t.offsetWidth / 2 - cx) < Math.abs(b.offsetLeft + b.offsetWidth / 2 - cx) ? t : b);

  place(cur);
  requestAnimationFrame(() => { seg.dataset.ready = "1"; });
  document.fonts?.ready.then(() => place(cur));

  seg.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    drag = { id: e.pointerId, px: e.clientX, x0: x, tab: e.target.closest(".seg__it"), moved: false };
  });
  seg.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.px;
    if (!drag.moved) {
      if (Math.abs(dx) < 5) return;
      drag.moved = true;
      seg.setPointerCapture(e.pointerId);
      seg.classList.add("seg--drag");
    }
    const max = seg.scrollWidth - thumb.offsetWidth - 2;
    x = Math.max(2, Math.min(max, drag.x0 + dx));
    thumb.style.transform = `translateX(${x}px)`;
    const t = nearest(x + thumb.offsetWidth / 2);
    if (t !== cur) { mark(t); fit(t); clearTimeout(live); live = setTimeout(commit, 80); }
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { moved, tab } = drag;
    drag = null;
    seg.classList.remove("seg--drag");
    clearTimeout(live);
    if (moved) { place(cur); commit(); }
    else if (tab && e.type === "pointerup") select(tab);
  };
  seg.addEventListener("pointerup", end);
  seg.addEventListener("pointercancel", end);

  /* keyboard: Enter/Space (detail 0) and arrows */
  seg.addEventListener("click", (e) => { const t = e.target.closest(".seg__it"); if (t && e.detail === 0) select(t); });
  seg.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = tabs[(tabs.indexOf(cur) + d + tabs.length) % tabs.length];
    select(next); next.focus();
  });

  return { relayout: () => place(cur) };
}

/* ---- views --------------------------------------------------------- */

function paint(html, view, title = BRAND) {
  document.body.dataset.view = view;
  document.body.dataset.scrolled = "0";
  document.body.dataset.nav = "none";
  topTitle.textContent = title;
  if (view === "home" || view === "release") {
    topTitle.setAttribute("translate", "no");
    topTitle.classList.add("notranslate");
  } else {
    topTitle.removeAttribute("translate");
    topTitle.classList.remove("notranslate");
  }
  root.innerHTML = html;
  void root.offsetWidth;
  document.body.dataset.nav = navDir;
  navDir = "none";
  segCtl = null;
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
    state.query = ""; input.value = ""; search.dataset.filled = "0"; relist(); input.focus();
  });

  if (seg) {
    segCtl = wireSeg(seg, (key, href) => {
      if (state.device === key) return;
      state.device = key;
      history.replaceState(null, "", href);
      relist();
    });
  }

  /* ROM card: quick press bump, then the page lifts in from the bottom */
  list.addEventListener("click", (e) => {
    const a = e.target.closest("a.cell");
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    navDir = "push";
    e.preventDefault();
    a.classList.add("cell--go");
    setTimeout(() => { location.hash = a.getAttribute("href"); }, 120);
  });
}

function wireRelease() {
  root.querySelector("#share")?.addEventListener("click", async () => {
    try {
      if (navigator.share) await navigator.share({ url: location.href, title: document.title });
      else { await navigator.clipboard.writeText(location.href); toast("Link copied"); }
    } catch { toast("Could not copy"); }
  });
  root.querySelectorAll("[data-shot]").forEach((btn) => btn.addEventListener("click", () => openLightbox(Number(btn.dataset.shot))));
  watchShots();
}

function watchShots() {
  const section = root.querySelector("[data-shots-section]");
  if (!section) return;
  const imgs = [...section.querySelectorAll("[data-shot-img]")];
  if (!imgs.length) return;
  const all = shots.slice(), dead = new Set();
  imgs.forEach((img) => trackImage(img, (bad) => {
    const btn = bad.closest("button"), i = Number(btn?.dataset.shot);
    if (Number.isInteger(i)) dead.add(i);
    btn?.remove();
    shots = all.filter((_, n) => !dead.has(n));
    if (dead.size < imgs.length) return;
    section.querySelector(".shots")?.remove();
    section.querySelector("[data-shots-hint]")?.remove();
    section.querySelector(".shots__album")?.remove();
    const tpl = section.querySelector("[data-shots-fallback-tpl]");
    if (tpl) { section.append(tpl.content.cloneNode(true)); tpl.remove(); }
    else { const p = document.createElement("p"); p.className = "shots__hint"; p.textContent = "Screenshots unavailable."; section.append(p); }
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
    setTitle(["Maintainers"]); paint(renderPeople(), "people", "Maintainers"); window.scrollTo(0, 0); return;
  }
  if (r.view === "release") {
    const rel = getRelease(r.device, r.id);
    if (!rel) { location.replace("#/"); return; }
    shots = rel.screenshots;
    setTitle([rel.name]); paint(renderRelease(rel), "release", rel.name); window.scrollTo(0, 0); return;
  }
  state.device = r.device && idx.byCodename.has(r.device) ? r.device : "all";
  setTitle([]);
  paint(renderHome(), "home");
}

/* ---- lightbox ------------------------------------------------------ */

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

function openLightbox(start) {
  if (!shots.length) return;
  lbTrack.innerHTML = shots.map((src, i) => `<figure>${spinner("spin spin--lg spin--on-dark")}<img src="${src}" alt="Screenshot ${i + 1}" decoding="async"></figure>`).join("");
  lb.dataset.open = "1";
  lbCount.dataset.text = ""; lbCount.textContent = "";
  lockScroll(true);
  lbTrack.querySelectorAll("img").forEach((img) => trackImage(img, (bad) => {
    const fig = bad.closest("figure");
    if (!fig) return;
    fig.dataset.loaded = "1";
    fig.replaceChildren(Object.assign(document.createElement("p"), { textContent: "This image failed to load" }));
  }));
  requestAnimationFrame(() => { lbTrack.scrollLeft = start * lbTrack.clientWidth; updateLbCount(); });
}
function closeLightbox() { lb.dataset.open = "0"; lbTrack.innerHTML = ""; lockScroll(false); }
function updateLbCount() {
  if (lb.dataset.open !== "1" || !lbTrack.clientWidth) return;
  const i = Math.round(lbTrack.scrollLeft / lbTrack.clientWidth);
  rollTo(lbCount, `${Math.min(i + 1, shots.length)} / ${shots.length}`);
}

/* ---- outbound-link alert ------------------------------------------- */

const alertEl = $("alert"), alertTitle = $("alert-title"), alertMsg = $("alert-msg"),
      alertHost = $("alert-host"), alertGo = $("alert-go");
const SITE_HOST = location.hostname.replace(/^www\./, "");
let pendingUrl = null, closeTimer = 0;

function describe(url) {
  if (APP_HOSTS.has(hostOf(url))) {
    return {
      title: "Open in Telegram?",
      msg: "This link needs the Telegram app. Without it you'll land on a login page instead of the file.",
      go: "Open",
    };
  }
  return {
    title: `Redirecting to ${mirrorHint(url)}`,
    msg: "Thank you for using alpha's trashdump. Read the flashing steps before you install, and enjoy the build.",
    go: "Continue",
  };
}

function openAlert(url) {
  clearTimeout(closeTimer);
  const d = describe(url);
  pendingUrl = url;
  alertTitle.textContent = d.title;
  alertMsg.textContent = d.msg;
  alertHost.textContent = url.replace(/^https?:\/\/(www\.)?/, "");
  alertGo.textContent = d.go;
  alertEl.dataset.closing = "0";
  alertEl.dataset.open = "1";
  lockScroll(true);
  alertGo.focus({ preventScroll: true });
}

function closeAlert() {
  if (alertEl.dataset.open !== "1" || alertEl.dataset.closing === "1") return;
  pendingUrl = null;
  alertEl.dataset.closing = "1";
  closeTimer = setTimeout(() => {
    alertEl.dataset.open = "0";
    alertEl.dataset.closing = "0";
    lockScroll(false);
  }, 200);
}

$("alert-cancel").addEventListener("click", closeAlert);
alertEl.querySelector(".alert__bg").addEventListener("click", closeAlert);
alertGo.addEventListener("click", () => {
  const url = pendingUrl;
  closeAlert();
  if (url) window.open(url, "_blank", "noopener,noreferrer");
});

/* every link that leaves the site goes through the alert */
document.addEventListener("click", (e) => {
  const link = e.target.closest?.("a[href]");
  if (!link || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const href = link.getAttribute("href") || "";
  if (!/^https?:/i.test(href)) return;
  if (hostOf(href) === SITE_HOST) return;
  e.preventDefault();
  openAlert(link.href);
});

/* ---- boot ---------------------------------------------------------- */

document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon, "ico"); });

backBtn.addEventListener("click", (e) => { navDir = "pop"; if (depth > 0) { e.preventDefault(); history.back(); } });
$("people-link").addEventListener("click", () => { navDir = "push"; });

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (alertEl.dataset.open === "1") closeAlert();
    else if (lb.dataset.open === "1") closeLightbox();
  }
  if (e.key === "Enter" && alertEl.dataset.open === "1" && document.activeElement !== $("alert-cancel")) alertGo.click();
});
$("lb-close").addEventListener("click", closeLightbox);
lb.addEventListener("click", (e) => { if (e.target === lb || e.target.tagName === "FIGURE") closeLightbox(); });
lbTrack.addEventListener("scroll", () => requestAnimationFrame(updateLbCount), { passive: true });

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    segCtl?.relayout();
    watchTitle();
    if (lb.dataset.open === "1") {
      const i = Math.round(lbTrack.scrollLeft / (lbTrack.clientWidth || 1));
      lbTrack.scrollLeft = i * lbTrack.clientWidth; updateLbCount();
    }
  }, 80);
});

window.addEventListener("hashchange", () => {
  depth += 1;
  if (lb.dataset.open === "1") closeLightbox();
  if (alertEl.dataset.open === "1") closeAlert();
  route();
});

route();
