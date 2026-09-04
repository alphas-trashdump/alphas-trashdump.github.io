/* liquid lens: one SVG displacement filter shared by the device bar thumb.
   Technique after Shu Ding's liquid-glass; map is aspect-correct, generated
   per size and cached (a 120×34 map is ~4k pixels, sub-millisecond). */
const NS = "http://www.w3.org/2000/svg";
const XL = "http://www.w3.org/1999/xlink";

const smooth = (a, b, t) => { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
const rrect = (x, y, w, h, r) => {
  const qx = Math.abs(x) - w + r, qy = Math.abs(y) - h + r;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
};

export class Lens {
  constructor(id = "lens") {
    this.w = 0; this.h = 0; this.cache = new Map();

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:fixed;top:0;left:0;pointer-events:none";
    const defs = document.createElementNS(NS, "defs");
    const f = document.createElementNS(NS, "filter");
    f.id = id;
    f.setAttribute("filterUnits", "userSpaceOnUse");
    f.setAttribute("color-interpolation-filters", "sRGB");
    f.setAttribute("x", "0"); f.setAttribute("y", "0");
    this.filter = f;

    this.img = document.createElementNS(NS, "feImage");
    this.img.setAttribute("result", "map");
    this.disp = document.createElementNS(NS, "feDisplacementMap");
    this.disp.setAttribute("in", "SourceGraphic");
    this.disp.setAttribute("in2", "map");
    this.disp.setAttribute("xChannelSelector", "R");
    this.disp.setAttribute("yChannelSelector", "G");

    f.append(this.img, this.disp); defs.append(f); svg.append(defs);
    document.body.append(svg);

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
  }

  setSize(w, h) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    const key = `${w}x${h}`;
    let m = this.cache.get(key);
    if (!m) { m = this.build(w, h); this.cache.set(key, m); }
    this.filter.setAttribute("width", w); this.filter.setAttribute("height", h);
    this.img.setAttribute("width", w); this.img.setAttribute("height", h);
    this.img.setAttribute("href", m.url);
    this.img.setAttributeNS(XL, "xlink:href", m.url);
    this.disp.setAttribute("scale", m.scale);
  }

  build(w, h) {
    const { canvas, ctx } = this;
    canvas.width = w; canvas.height = h;
    const raw = new Float32Array(w * h * 2);
    const ar = w / h, m = 0.16; /* rim thickness, in height units */
    let max = 0;
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i++) {
        const ux = ((x + 0.5) / w - 0.5) * ar, uy = (y + 0.5) / h - 0.5;
        const d = rrect(ux, uy, ar / 2 - m, 0.5 - m, 0.5 - m);
        const k = smooth(0, 1, smooth(0.34, 0, d));      /* 1 in the flat centre, → 0 at the rim */
        const dx = ((ux * k) / ar + 0.5) * w - (x + 0.5);
        const dy = (uy * k + 0.5) * h - (y + 0.5);
        max = Math.max(max, Math.abs(dx), Math.abs(dy));
        raw[i * 2] = dx; raw[i * 2 + 1] = dy;
      }
    }
    max *= 0.5; /* saturate the rim, like the original */
    const img = ctx.createImageData(w, h), d = img.data;
    for (let i = 0, n = w * h; i < n; i++) {
      d[i * 4] = (raw[i * 2] / max + 0.5) * 255;
      d[i * 4 + 1] = (raw[i * 2 + 1] / max + 0.5) * 255;
      d[i * 4 + 2] = 0; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { url: canvas.toDataURL(), scale: max };
  }
}
