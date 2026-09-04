/* effect tier + liquid-glass capability ------------------------------ */
const html = document.documentElement;
const ua = navigator.userAgent;

/* SVG filters inside backdrop-filter only render in Chromium engines */
const chromium = navigator.userAgentData?.brands?.some((b) => /Chromium/i.test(b.brand))
  ?? (/Chrome\//.test(ua) && !/Edge\//.test(ua));

export const fx = {
  rich: html.dataset.fx === "rich",
  liquid: false,
};
fx.liquid = fx.rich && !!chromium
  && typeof CSS !== "undefined" && CSS.supports("backdrop-filter", "url(#x)");
html.dataset.liquid = fx.liquid ? "1" : "0";
