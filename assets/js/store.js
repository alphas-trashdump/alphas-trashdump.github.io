/* data loading + derived helpers ------------------------------------ */

const INDEX_URL = "data/index.json";

/** @type {null | Promise<object>} */
let pending = null;

export const state = {
  index: null,
  query: "",
  device: "all",
};

export async function loadIndex() {
  if (state.index) return state.index;
  if (!pending) {
    pending = fetch(`${INDEX_URL}?v=${Date.now()}`, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((json) => {
        state.index = normalize(json);
        return state.index;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

function normalize(json) {
  const devices = json.devices || [];
  const byCodename = new Map(devices.map((d) => [d.codename, d]));
  const releases = (json.releases || []).map((r) => ({
    ...r,
    device_: byCodename.get(r.device) || { codename: r.device, name: r.device },
    maintainer_: json.maintainers?.[r.maintainer] || { id: r.maintainer, name: r.maintainer },
    _haystack: [
      r.name,
      r.shortName,
      r.device,
      byCodename.get(r.device)?.name,
      byCodename.get(r.device)?.fullName,
      `android ${r.android}`,
      r.channel,
      r.base,
      json.maintainers?.[r.maintainer]?.name,
      json.maintainers?.[r.maintainer]?.tag,
      ...(r.supports || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));

  return { ...json, devices, releases, byCodename };
}

export function getRelease(device, id) {
  return state.index?.releases.find((r) => r.device === device && r.id === id) || null;
}

export function filtered() {
  const idx = state.index;
  if (!idx) return [];
  const q = state.query.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  return idx.releases.filter((r) => {
    if (state.device !== "all" && r.device !== state.device) return false;
    return terms.every((t) => r._haystack.includes(t));
  });
}

export function groupByDevice(releases) {
  const groups = new Map();
  for (const r of releases) {
    if (!groups.has(r.device)) groups.set(r.device, []);
    groups.get(r.device).push(r);
  }
  const order = state.index?.devices.map((d) => d.codename) || [];
  return [...groups.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([codename, list]) => ({
      device: state.index.byCodename.get(codename) || { codename, name: codename },
      list,
    }));
}

/* ---- formatting -------------------------------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export function relDays(iso) {
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days < 0) return "scheduled";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30.44);
  if (months < 18) return `${months}mo ago`;
  return `${Math.floor(days / 365.25)}y ago`;
}

export function isFresh(iso, withinDays = 45) {
  const then = Date.parse(`${iso}T00:00:00Z`);
  return !Number.isNaN(then) && Date.now() - then < withinDays * 86400000;
}

export function hostOf(url) {
  try {
    if (typeof URL === "function") return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* fall through to the regex below */
  }
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(String(url || ""));
  return m ? m[1].replace(/^www\./, "").replace(/:\d+$/, "").toLowerCase() : "";
}

/** Human label for a mirror host, used as the small line under the label. */
export function mirrorHint(url) {
  const host = hostOf(url);
  const map = {
    "drive.google.com": "Google Drive",
    "sourceforge.net": "SourceForge",
    "t.me": "Telegram",
    "mega.nz": "MEGA",
    "github.com": "GitHub",
    "mediafire.com": "MediaFire",
    "pixeldrain.com": "pixeldrain",
    "buzzheavier.com": "buzzheavier",
  };
  return map[host] || host || "external link";
}
