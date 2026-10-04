/* router + wiring ---------------------------------------------------- */
import "./lib/material.js";
import { state, loadIndex, getRelease, hostOf, mirrorHint } from "./lib/store.js";
import { renderHome, renderList, renderRelease, renderPeople, renderSettings, renderError, renderLoading, esc } from "./views/index.js";
import { settings, saveSettings, applySettings } from "./lib/settings.js";
import { icon } from "./lib/icons.js";

const BRAND = "alpha's trashdump";
const APP_HOSTS = new Set(["t.me", "telegram.me", "telegram.dog"]);

const $ = (id) => document.getElementById(id);
const root = $("app"), top = $("top"), topTitle = $("top-title"), backBtn = $("back");
const lb = $("lb"), lbTrack = $("lb-track"), lbCount = $("lb-count"), toastEl = $("toast");

let shots = [];
let toastTimer = 0;
let navDir = "none";
let titleIO = null;
/* in-app history, so Back walks the pages the visitor opened instead of leaving */
const trail = [location.hash || "#/"];
let popping = false;

/* ---- boot splash ----------------------------------------------------- */
/* The splash in index.html covers the page until the app has real content to
   show, then fades out. It is deliberately *not* dismissed on the loading
   state: that state is the slow thing the splash is covering up. */
const boot = $("boot");
let booted = false;

function dismissBoot() {
  if (booted || !boot) return;
  booted = true;
  document.documentElement.dataset.booted = "1";
  boot.dataset.out = "1";
  const instant = matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => { boot.hidden = true; }, instant ? 0 : 200);
}

/* The splash draws its own bar because Material Web may not have arrived yet.
   The moment it has, the real component takes over - same size, same colours, so
   the hand-over is invisible and the site's only loading language is a Material
   Web indicator rather than a stand-in for one. */
async function realIndicator() {
  try { await customElements.whenDefined("md-linear-progress"); } catch { return; }
  const stand = boot?.querySelector(".boot__bar");
  if (!stand || booted) return;
  const real = document.createElement("md-linear-progress");
  real.indeterminate = true;
  real.setAttribute("aria-label", "Loading");
  stand.replaceWith(real);
  boot.dataset.indicator = "md-linear-progress";
}
realIndicator();

/* ---- helpers ------------------------------------------------------- */

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.dataset.show = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.dataset.show = "0"; }, 1800);
}
function setTitle(parts) { document.title = [...parts, BRAND].filter(Boolean).join(" — "); }
function lockScroll(on) { document.documentElement.style.overflow = on ? "hidden" : ""; }

/* Material Web renders its own anchors inside a shadow root, so a
   composedPath() walk is the only way to see a link from here. */
function linkFrom(e) {
  for (const node of e.composedPath()) {
    if (node?.nodeType !== 1) continue;
    const href = node.getAttribute?.("href");
    if (!href) continue;
    try {
      const label = node.dataset?.label ||
                    node.querySelector?.('[slot="headline"]')?.textContent?.trim() ||
                    node.getAttribute?.("aria-label")?.trim() ||
                    "";
      return { raw: href, url: new URL(href, location.href), label };
    } catch { return null; }
  }
  return null;
}

function parseHash() {
  /* decodeURIComponent throws on a malformed escape (`#/r/100%`), which used to
     leave the page blank: guard it and treat the segment as literal text. */
  const seg = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean)
    .map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  if (!seg.length) return { view: "home" };
  if (seg[0] === "people") return { view: "people" };
  if (seg[0] === "settings") return { view: "settings" };
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
  titleIO = new IntersectionObserver(([e]) => {
    document.body.dataset.scrolled = e.isIntersecting ? "0" : "1";
    if (!e.isIntersecting) { toggleHelp(false); toggleSettings(false); }
  }, { rootMargin: `-${top.offsetHeight}px 0px 0px 0px` });
  titleIO.observe(h1);
}

/* ---- single-select chip sets ----------------------------------------- */

/* Exactly one chip in a set stays selected (device filter, accent picker).
   md-filter-chip toggles `selected` on its inner button and then re-dispatches
   the click, so this must NOT preventDefault: the component reverts that toggle
   *after* this handler runs, wiping the tick and the fill again. Let its toggle
   stand, force this chip back on, and single-select the set here. The click
   arrives twice (original + re-dispatch), so `active` makes the second a no-op. */
function singleSelect(set, onPick) {
  const chips = () => set.chips ?? [...set.querySelectorAll("md-filter-chip")];
  let active = chips().find((c) => c.selected) ?? chips()[0];

  set.addEventListener("click", (e) => {
    const chip = e.composedPath().find((n) => n?.tagName === "MD-FILTER-CHIP");
    if (!chip || chip.disabled || chip.softDisabled) return;
    chip.selected = true;
    if (chip === active) return;
    active = chip;
    chips().forEach((c) => { if (c !== chip) c.selected = false; });
    onPick(chip);
  });
}

function wireFilters(set, onChange) {
  singleSelect(set, (chip) => {
    navigator.vibrate?.(5);
    onChange(chip.dataset.key, chip.dataset.href);
  });
}

/* ---- settings -------------------------------------------------------- */

function wireSettings() {
  const sw = root.querySelector("#theme-switch");
  sw?.addEventListener("change", () => {
    settings.theme = sw.selected ? "dark" : "light";
    saveSettings();
    const ico = sw.closest("md-list-item")?.querySelector("md-icon[slot='start']");
    if (ico) ico.innerHTML = icon(settings.theme === "dark" ? "moon" : "sun", "ico ico--md");
  });

  const set = root.querySelector("#accents");
  if (!set) return;
  singleSelect(set, (chip) => {
    settings.accent = chip.dataset.accent;
    saveSettings();
  });
}

/* ---- views --------------------------------------------------------- */

function paint(html, view, title = BRAND) {
  document.body.dataset.view = view;
  document.body.dataset.scrolled = "0";
  document.body.dataset.nav = "none";
  topTitle.textContent = title;
  topTitle.setAttribute("translate", "no");
  topTitle.classList.add("notranslate");
  root.innerHTML = html;
  /* #retry is a plain button now, so it needs a handler here rather than an href */
  root.querySelector("#retry")?.addEventListener("click", () => location.reload());
  void root.offsetWidth;
  document.body.dataset.nav = navDir;
  navDir = "none";
  if (view === "home") wireHome();
  if (view === "release") wireRelease();
  if (view === "settings") wireSettings();
  watchTitle();
}

function wireHome() {
  const field = root.querySelector("#q");
  const list = root.querySelector("#list");
  const seg = root.querySelector("#seg");
  const clear = root.querySelector("#q-clear");
  if (!field || !list) return;
  const relist = () => { list.innerHTML = renderList(); };

  let debounce = 0;
  field.addEventListener("input", () => {
    state.query = field.value;
    if (clear) clear.hidden = !field.value;
    clearTimeout(debounce);
    debounce = setTimeout(relist, 120);
  });
  clear?.addEventListener("click", () => {
    state.query = ""; field.value = ""; clear.hidden = true; relist(); field.focus();
  });

  if (seg) wireFilters(seg, (key, href) => {
    if (state.device === key) return;
    state.device = key;
    history.replaceState(null, "", href);
    relist();
  });

  /* ROM row: quick press bump, then the page lifts in from the bottom */
  list.addEventListener("click", (e) => {
    const item = e.composedPath().find((n) => n?.tagName === "MD-LIST-ITEM");
    if (!item || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    navDir = "push";
    e.preventDefault();
    item.classList.add("cell--go");
    setTimeout(() => { location.hash = item.getAttribute("href"); }, 120);
  });
}

function wireRelease() {
  root.querySelector("#share")?.addEventListener("click", async () => {
    try {
      if (navigator.share) await navigator.share({ url: location.href, title: document.title });
      else { await navigator.clipboard.writeText(location.href); toast("Link copied"); }
    } catch (err) {
      if (err?.name !== "AbortError") toast("Could not copy");
    }
  });
  root.querySelectorAll("[data-shot]").forEach((btn) => btn.addEventListener("click", () => openLightbox(Number(btn.dataset.shot))));
  watchShots();
}

function watchShots() {
  const section = root.querySelector("[data-shots-section]");
  if (!section) return;
  const imgs = [...section.querySelectorAll("[data-shot-img]")];
  if (!imgs.length) return;
  /* Dead indices are remembered rather than spliced out of `shots`: the
     surviving thumbs keep their original data-shot index, so the lightbox still
     opens the screenshot the visitor tapped. */
  const dead = new Set();
  imgs.forEach((img) => trackImage(img, (bad) => {
    const btn = bad.closest("button"), i = Number(btn?.dataset.shot);
    if (Number.isInteger(i)) dead.add(i);
    btn?.remove();
    if (dead.size < imgs.length) return;
    section.querySelector(".shots")?.remove();
    section.querySelector("[data-shots-hint]")?.remove();
    const tpl = section.querySelector("[data-shots-fallback-tpl]");
    if (tpl) { section.append(tpl.content.cloneNode(true)); tpl.remove(); }
    else { const p = document.createElement("p"); p.className = "shots__hint"; p.textContent = "Screenshots unavailable."; section.append(p); }
  }));
}

async function route() {
  try {
    const r = parseHash();
    let idx = state.index;
    if (!idx) {
      paint(renderLoading(), "home");
      try { idx = await loadIndex(); }
      catch (err) { paint(renderError(err.message || String(err)), "home"); dismissBoot(); return; }
    }
    if (r.view === "people") {
      setTitle(["Maintainers"]); paint(renderPeople(), "people", "Maintainers"); window.scrollTo(0, 0); dismissBoot(); return;
    }
    if (r.view === "settings") {
      applySettings();
      setTitle(["Settings"]); paint(renderSettings(), "settings", "Settings"); window.scrollTo(0, 0); dismissBoot(); return;
    }
    if (r.view === "release") {
      const rel = getRelease(r.device, r.id);
      if (!rel) { location.replace("#/"); dismissBoot(); return; }
      shots = rel.screenshots;
      setTitle([rel.name]); paint(renderRelease(rel), "release", rel.name); window.scrollTo(0, 0); dismissBoot(); return;
    }
    state.device = r.device && idx.byCodename.has(r.device) ? r.device : "all";
    setTitle([]);
    paint(renderHome(), "home");
    dismissBoot();
  } catch (err) {
    console.error(err);
    paint(renderError(err.message || String(err)), "home");
    dismissBoot();
  }
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

let lbCloseTimer = 0;

function openLightbox(start) {
  const total = shots.length;
  if (!total) return;
  const at = Math.min(Math.max(Number(start) || 0, 0), total - 1);
  clearTimeout(lbCloseTimer);
  lb.dataset.closing = "0";
  lbTrack.innerHTML = shots.map((src, i) => `<figure><span class="lightbox__ph">${icon("image", "ico")}</span><img src="${esc(src)}" alt="Screenshot ${i + 1}" decoding="async"></figure>`).join("");
  lb.dataset.open = "1";
  lbCount.dataset.text = ""; lbCount.textContent = "";
  lockScroll(true);
  lbTrack.querySelectorAll("img").forEach((img) => trackImage(img, (bad) => {
    const fig = bad.closest("figure");
    if (!fig) return;
    fig.dataset.loaded = "1";
    fig.replaceChildren(Object.assign(document.createElement("p"), { textContent: "This image failed to load", className: "t-body-medium" }));
  }));
  requestAnimationFrame(() => { lbTrack.scrollLeft = at * lbTrack.clientWidth; updateLbCount(); });
}
function closeLightbox() {
  if (lb.dataset.open !== "1" || lb.dataset.closing === "1") return;
  lb.dataset.closing = "1";
  lbCloseTimer = setTimeout(() => {
    lb.dataset.open = "0";
    lb.dataset.closing = "0";
    lbTrack.innerHTML = "";
    lockScroll(false);
  }, 220);
}
function updateLbCount() {
  if (lb.dataset.open !== "1" || !lbTrack.clientWidth) return;
  const i = Math.round(lbTrack.scrollLeft / lbTrack.clientWidth);
  rollTo(lbCount, `${Math.min(i + 1, shots.length)} / ${shots.length}`);
}

/* ---- outbound-link alert (md-dialog) ------------------------------- */

const alertEl = $("alert"), alertTitle = $("alert-title"), alertMsg = $("alert-msg"),
      alertHost = $("alert-host"), alertGo = $("alert-go"), alertProgress = $("alert-progress");
const SITE_HOST = location.hostname.replace(/^www\./, "");
let pendingUrl = null, alertOpen = false, alertReady = false, alertTimer = 0;

/* how long the dialog shows its M3 loading indicator before the link opens */
const ALERT_HOLD = 400;

function describe(url, label) {
  if (APP_HOSTS.has(hostOf(url))) {
    if (url.includes("trashdumpchat")) {
      return {
        title: label || "Need help?",
        msg: "Join @trashdumpchat on Telegram for help, questions, and discussions with maintainers and users.",
        go: "Open Chat",
      };
    }
    return {
      title: label ? `Open ${label} in Telegram?` : "Open in Telegram?",
      msg: "This link needs the Telegram app. Without it you'll land on a login page instead of the file.",
      go: "Open",
    };
  }
  const name = label || mirrorHint(url);
  return {
    title: `Redirecting to ${name}`,
    msg: "Thank you for using alpha's trashdump. Read the flashing steps before you install, and enjoy the build.",
    go: "Continue",
  };
}

function openAlert(url, label) {
  const d = describe(url, label);
  pendingUrl = url;
  alertTitle.textContent = d.title;
  alertMsg.textContent = d.msg;
  alertHost.textContent = url.replace(/^https?:\/\/(www\.)?/, "");
  alertGo.textContent = d.go;
  /* hold the link behind a short loading beat so nobody opens it by accident */
  alertReady = false;
  alertGo.disabled = true;
  alertProgress.hidden = false;
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => {
    alertReady = true;
    alertGo.disabled = false;
    alertProgress.hidden = true;
  }, ALERT_HOLD);
  alertOpen = true;
  lockScroll(true);
  alertEl.show();
}

alertEl.addEventListener("closed", () => {
  alertOpen = false; alertReady = false; pendingUrl = null;
  clearTimeout(alertTimer);
  lockScroll(false);
});
$("alert-cancel").addEventListener("click", () => alertEl.close("cancel"));
alertGo.addEventListener("click", () => {
  if (!alertReady) return;
  const url = pendingUrl;
  alertEl.close("go");
  if (url) window.open(url, "_blank", "noopener,noreferrer");
});

/* every link that leaves the site goes through the alert */
document.addEventListener("click", (e) => {
  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const link = linkFrom(e);
  if (!link || !/^https?:$/.test(link.url.protocol)) return;
  if (link.url.hostname.replace(/^www\./, "") === SITE_HOST) return;
  e.preventDefault();
  openAlert(link.url.href, link.label);
});

/* ---- boot ---------------------------------------------------------- */

backBtn.addEventListener("click", (e) => {
  e.preventDefault();
  navDir = "pop";
  /* A counter of pushes was used before, so two pushes and one pop still sent
     Back out of the site. Walk the real trail instead, and treat Back on the
     home view as a no-op rather than letting href="#" rewrite the hash. */
  if (trail.length > 1) { popping = true; trail.pop(); history.back(); }
  else { popping = true; location.hash = "#/"; }
});
$("people-link")?.addEventListener("click", () => { navDir = "push"; });
$("settings-link")?.addEventListener("click", () => { navDir = "push"; });
applySettings();

/* ---- help & settings popups --------------------------------------- */
const helpBtn = $("help-btn"), helpPopup = $("help-popup"),
      helpClose = $("help-popup-close"), helpGo = $("help-popup-go");

const settingsBtn = $("settings-btn"), settingsPopup = $("settings-popup"),
      settingsClose = $("settings-popup-close"),
      popupThemeSwitch = $("popup-theme-switch"),
      popupAccents = $("popup-accents");

function toggleHelp(open) {
  if (!helpPopup) return;
  const show = open ?? (helpPopup.dataset.open !== "1");
  if (show) toggleSettings(false);
  helpPopup.dataset.open = show ? "1" : "0";
  helpPopup.toggleAttribute("inert", !show);
  helpPopup.setAttribute("aria-hidden", String(!show));
  helpBtn?.setAttribute("aria-expanded", String(show));
}

function syncSettingsPopup() {
  if (popupThemeSwitch) popupThemeSwitch.selected = settings.theme === "dark";
  if (popupAccents) {
    const chips = popupAccents.querySelectorAll("md-filter-chip");
    chips.forEach((c) => {
      c.selected = c.dataset.accent === settings.accent;
    });
  }
}

function toggleSettings(open) {
  if (!settingsPopup) return;
  const show = open ?? (settingsPopup.dataset.open !== "1");
  if (show) {
    toggleHelp(false);
    syncSettingsPopup();
  }
  settingsPopup.dataset.open = show ? "1" : "0";
  settingsPopup.toggleAttribute("inert", !show);
  settingsPopup.setAttribute("aria-hidden", String(!show));
  settingsBtn?.setAttribute("aria-expanded", String(show));
}

helpBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleHelp();
});
helpClose?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleHelp(false);
});
helpGo?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleHelp(false);
  window.open("https://t.me/trashdumpchat", "_blank", "noopener,noreferrer");
});

settingsBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleSettings();
});
settingsClose?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleSettings(false);
});

popupThemeSwitch?.addEventListener("change", () => {
  settings.theme = popupThemeSwitch.selected ? "dark" : "light";
  saveSettings();
});

if (popupAccents) {
  singleSelect(popupAccents, (chip) => {
    settings.accent = chip.dataset.accent;
    saveSettings();
  });
}

document.addEventListener("click", (e) => {
  if (helpPopup && helpPopup.dataset.open === "1" && !helpPopup.contains(e.target) && !helpBtn?.contains(e.target)) {
    toggleHelp(false);
  }
  if (settingsPopup && settingsPopup.dataset.open === "1" && !settingsPopup.contains(e.target) && !settingsBtn?.contains(e.target)) {
    toggleSettings(false);
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (helpPopup && helpPopup.dataset.open === "1") { toggleHelp(false); return; }
    if (settingsPopup && settingsPopup.dataset.open === "1") { toggleSettings(false); return; }
    if (lb.dataset.open === "1") closeLightbox();
  }
  if (e.key === "Enter" && alertOpen && alertReady) alertGo.click();
});
$("lb-close").addEventListener("click", closeLightbox);
lb.addEventListener("click", (e) => { if (e.target === lb || e.target.tagName === "FIGURE") closeLightbox(); });
lbTrack.addEventListener("scroll", () => requestAnimationFrame(updateLbCount), { passive: true });

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    watchTitle();
    if (lb.dataset.open === "1") {
      const i = Math.round(lbTrack.scrollLeft / (lbTrack.clientWidth || 1));
      lbTrack.scrollLeft = i * lbTrack.clientWidth; updateLbCount();
    }
  }, 80);
});

window.addEventListener("hashchange", () => {
  /* a Back we triggered has already popped the trail */
  if (popping) popping = false;
  else { trail.push(location.hash || "#/"); if (trail.length > 40) trail.shift(); }
  if (helpPopup && helpPopup.dataset.open === "1") toggleHelp(false);
  if (settingsPopup && settingsPopup.dataset.open === "1") toggleSettings(false);
  if (lb.dataset.open === "1") closeLightbox();
  if (alertOpen) alertEl.close("nav");
  route();
});

route();