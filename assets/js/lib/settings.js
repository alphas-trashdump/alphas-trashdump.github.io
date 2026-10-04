/* theme + accent preference ------------------------------------------- */

const KEY = "trashdump:settings";
export const ACCENTS = [
  { id: "orange", label: "Orange" },
  { id: "purple", label: "Purple" },
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
];

/* dark is the default; nothing is written to storage until the visitor
   actually changes something in the settings page. */
const DEFAULTS = { theme: "dark", accent: "orange" };

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      theme: raw.theme === "light" ? "light" : "dark",
      accent: ACCENTS.some((a) => a.id === raw.accent) ? raw.accent : DEFAULTS.accent,
    };
  } catch {
    return { ...DEFAULTS };
  }
};

export const settings = read();

/** Paint the choice onto <html>, where the token blocks key off it. */
export function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.accent = settings.accent;
  /* keep the browser chrome (address bar, notch) in step with the surface */
  const surface = getComputedStyle(root).getPropertyValue("--md-sys-color-surface").trim() || (settings.theme === "light" ? "#fcfcfc" : "#151414");
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length) {
    metas[0].removeAttribute("media");
    metas[0].content = surface;
    for (let i = 1; i < metas.length; i++) metas[i].remove();
  }
}

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ theme: settings.theme, accent: settings.accent }));
  } catch {
    /* private mode: the choice just won't survive a reload */
  }
  applySettings();
}

/* The inline <head> script must agree with this, or the first paint would
   flash the default colours before app.js loads. */
export const BOOT_SNIPPET =
  `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})||"{}"),r=document.documentElement;` +
  `r.dataset.theme=s.theme==="light"?"light":"dark";` +
  `r.dataset.accent=${JSON.stringify(ACCENTS.map((a) => a.id))}.indexOf(s.accent)>-1?s.accent:"orange";}catch(e){}`;