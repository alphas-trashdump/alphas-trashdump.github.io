/* router + wiring ---------------------------------------------------- */
import { state, loadIndex, getRelease, hostOf } from "./store.js";
import { renderHome, renderRelease, renderPeople, renderError, renderLoading, spinner, icon }
  from "./ui.js";

const root = document.getElementById("app");
const lb = document.getElementById("lb");
const lbTrack = document.getElementById("lb-track");
const lbCount = document.getElementById("lb-count");
const toastEl = document.getElementById("toast");
const sheet = document.getElementById("sheet");
const sheetHost = document.getElementById("sheet-host");
const sheetGo = document.getElementById("sheet-go");
const sheetCancel = document.getElementById("sheet-cancel");

/* hosts that need a native app installed to be useful */
const APP_HOSTS = new Set(["t.me", "telegram.me", "telegram.dog"]);

let shots = [];
let toastTimer = 0;

/* ---- helpers ------------------------------------------------------- */

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.dataset.show = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.dataset.show = "0"; }, 1900);
}

function setTitle(parts) {
  document.title = [...parts, "alpha's trashdump"].filter(Boolean).join(" - ");
}

function parseHash() {
  const seg = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (!seg.length) return { view: "home" };
  if (seg[0] === "people") return { view: "people" };
  if (seg[0] === "d" && seg[1]) return { view: "home", device: seg[1] };
  if (seg[0] === "r" && seg[1] && seg[2]) return { view: "release", device: seg[1], id: seg[2] };
  return { view: "home" };
}

/* ---- image loading ------------------------------------------------- */

/** Mark an image loaded so its spinner hides and it fades in. */
function trackImage(img, onFail) {
  const done = () => {
    img.dataset.loaded = "1";
    img.closest("button, figure")?.setAttribute("data-loaded", "1");
  };
  if (img.complete) {
    if (img.naturalWidth > 0) done();
    else onFail?.(img);
    return;
  }
  img.addEventListener("load", done, { once: true });
  img.addEventListener("error", () => onFail?.(img), { once: true });
}

/* ---- views --------------------------------------------------------- */

function paint(html, view) {
  document.body.dataset.view = view;
  root.innerHTML = html;
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
    paint(renderHome(), "home");
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
    debounce = setTimeout(rerender, 130);
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
      else {
        await navigator.clipboard.writeText(location.href);
        toast("Link copied");
      }
    } catch {
      toast("Could not copy");
    }
  });
  root.querySelectorAll("[data-shot]").forEach((btn) => {
    btn.addEventListener("click", () => openLightbox(Number(btn.dataset.shot)));
  });
  watchShots();
  fetchViews();
}

/* ---- view counter -------------------------------------------------- */

function fetchViews() {
  const el = root.querySelector("#views");
  if (!el) return;
  const device = el.dataset.device;
  const id = el.dataset.id;
  const key = `${device}/${id}`;
  fetch(`https://hits.dwyl.com/alphas-trashdump/${device}-${id}.json`)
    .then((r) => r.ok ? r.json() : Promise.reject())
    .then((data) => {
      const n = parseInt(data.message, 10);
      if (!Number.isFinite(n)) return;
      el.textContent = `👁️ ${n.toLocaleString()} view${n === 1 ? "" : "s"}`;
      el.style.display = "";
    })
    .catch(() => { el.remove(); });
}

/* Dead screenshots drop out; if all of them die, fall back to the album. */
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
    const tpl = section.querySelector("[data-shots-fallback-tpl]");
    section.querySelectorAll(".card").forEach((el) => el.remove());
    if (tpl) {
      section.append(tpl.content.cloneNode(true));
      tpl.remove();
    } else {
      const note = document.createElement("p");
      note.className = "shots__hint";
      note.textContent = "Screenshots unavailable.";
      section.append(note);
    }
  };

  imgs.forEach((img) => trackImage(img, onFail));
}

async function route() {
  const r = parseHash();

  let idx = state.index;
  if (!idx) {
    paint(renderLoading(), "home");
    try {
      idx = await loadIndex();
    } catch (err) {
      paint(renderError(err.message || String(err)), "home");
      return;
    }
  }

  if (r.view === "people") {
    setTitle(["Maintainers"]);
    paint(renderPeople(), "people");
    window.scrollTo(0, 0);
    return;
  }

  if (r.view === "release") {
    const rel = getRelease(r.device, r.id);
    if (!rel) { location.replace("#/"); return; }
    shots = rel.screenshots;
    setTitle([rel.name]);
    paint(renderRelease(rel), "release");
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
    fig.replaceChildren(Object.assign(document.createElement("p"), {
      textContent: "This image failed to load",
    }));
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

/* ---- telegram / app-link warning ----------------------------------- */

let pendingUrl = null;

function needsApp(url) {
  return APP_HOSTS.has(hostOf(url));
}

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
  if (!/^https?:/i.test(href) || !needsApp(href)) return;
  e.preventDefault();
  askBeforeLeaving(link.href);
});

/* ---- boot ---------------------------------------------------------- */

document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = icon(el.dataset.icon, "ico");
});

const onScroll = () => {
  document.body.dataset.scrolled = window.scrollY > 12 ? "1" : "0";
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

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

window.addEventListener("hashchange", () => {
  if (lb.dataset.open === "1") closeLightbox();
  if (sheet.dataset.open === "1") closeSheet();
  route();
});

route();
