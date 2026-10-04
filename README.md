# alpha's trashdump

Custom ROM ports for Xiaomi msm8937 devices. Static site, no build step, published
from this branch by GitHub Pages.

<https://alphas-trashdump.github.io/>

## Adding a release (the normal way)

From your phone, in the GitHub app or the website:

1. **Issues → New issue → "Add or update a ROM release"**.
2. Fill the form. Mirrors and extras are one per line as `Label | URL`, so two, three
   or ten download mirrors all work.
3. Drag your screenshots into the Screenshots box.
4. Submit.

A bot then:

- writes `data/releases/<device>/<id>.json`,
- downloads your screenshots, resizes them to 1440px and converts them to webp under
  `res/shots/<device>/<id>/`,
- rebuilds `data/index.json`,
- commits, pushes, comments the result on the issue and closes it.

The site is live about a minute later. If the form has a problem the bot says exactly
what is wrong and leaves the issue open — edit the issue and it retries automatically.

**Updating** an existing release: same form, put the existing release id in the
"Release id" field. It overwrites that file. Leave the Screenshots box empty to keep
the screenshots that are already there.

**Removing** one: Issues → New issue → "Remove a release".

Only the repo owner and collaborators can trigger the bot. Anyone else's submission
gets a polite comment and nothing is written.

## Adding a release (by hand)

Drop a file at `data/releases/<device>/<id>.json`, then:

```bash
python3 tools/build_index.py    # validates everything, regenerates data/index.json
```

The filename must match the `id` field, and the directory must match the `device`
field. `build_index.py` refuses to write a broken index, and CI fails if
`data/index.json` was not regenerated after a data change.

## Local preview

```bash
python3 tools/serve.py          # http://localhost:8000
qjs --std --module tools/test/render_check.js   # or: node tools/test/render_check.js
node tools/test/material_check.js               # Material Web wiring, needs network
```

`render_check.js` renders every view against the real data outside a browser and fails
on template crashes, `undefined` leaking into the output, or unescaped user content.

`material_check.js` walks the Material Web module graph from `assets/js/material.js`,
proves the `<script type="importmap">` in `index.html` resolves every bare specifier
those files import, and fails if a view renders an `<md-…>` tag nothing defines.

## Design system

Material Design 3, with [Material Web](https://github.com/material-components/material-web)
for the components. No build step: `index.html` carries an import map that points the bare
`lit`, `lit/*`, `@lit/*` and `tslib` specifiers Material Web imports at pinned jsDelivr
URLs, and `assets/js/lib/material.js` imports only the components the site uses. Bump both
together, then run `material_check.js`.

- `assets/css/tokens.css` holds the system tokens: `--md-sys-color-*` (dark by default,
  light under `[data-theme="light"]`), `--md-sys-shape-*`, the `--md-sys-typescale-*`
  scale, motion, elevation, space, and `--md-ref-typeface-brand/plain` = Inter.
- `assets/css/layout.css` is layout only. If a rule there is painting a control, it
  belongs in a Material Web component instead.
- Anything Material Web does not ship (top app bar, screenshot viewer, snackbar, page
  transitions) is built from the same tokens rather than from private values.

## Layout

```
index.html                  shell only; every view is rendered client-side
404.html                    not-found page
assets/css/tokens.css       M3 system tokens: colour, shape, type, motion, elevation, space
assets/css/accents.css      generated: one accent per [data-accent], incl. its neutrals
assets/css/base.css         reset, type helpers, Material Web token overrides, motion
assets/css/layout.css       page layout only: top bar, grids, viewer, snackbar
assets/js/app.js            hash router + wiring
assets/js/lib/store.js      fetch + normalise data, search, formatting
assets/js/lib/icons.js      inlined Feather icons
assets/js/lib/settings.js   theme + accent preference (localStorage)
assets/js/lib/material.js   the Material Web components this site imports
assets/js/views/index.js    barrel: app.js and the tests import from here
assets/js/views/home.js     build list + device filter
assets/js/views/release.js  one build: downloads, details, steps, bugs, changelog
assets/js/views/people.js   maintainers
assets/js/views/person.js   one maintainer row, shared by two views
assets/js/views/settings.js theme switch + accent picker
assets/js/views/states.js   loading + error
assets/js/views/shared.js   esc, the text animations, the channel label
data/devices.json           device targets
data/maintainers.json       people + avatars
data/releases/<dev>/*.json  one file per release  <- the only thing you normally edit
data/index.json             generated; do not hand-edit
res/maintainers/            avatars
res/shots/<dev>/<id>/       screenshots, committed and optimised
tools/build_index.py        validate + generate data/index.json
tools/gen_accents.mjs       regenerate assets/css/accents.css
tools/publish_issue.py      issue form -> release file (used by the bot)
tools/serve.py              local preview server
tools/test/render_check.js  every view rendered outside a browser
tools/test/material_check.js  Material Web loader + tag audit
```
## Release schema

```jsonc
{
  "id": "hyperos-3-0-313-0",        // must equal the filename
  "device": "santoni",              // must exist in data/devices.json
  "name": "HyperOS 3.0.313.0",
  "shortName": "HyperOS 3.1",       // optional, used in breadcrumbs
  "android": "16",
  "channel": "stable",              // stable | beta | experimental
  "date": "2026-06-04",             // ISO, drives sorting and the "new" badge
  "size": "2.38 GB",
  "maintainer": "alpha",            // key in data/maintainers.json
  "supports": ["santoni", "land"],  // optional extra codenames
  "mirrors": [                      // as many as you like; first is the big button
    { "label": "SourceForge", "url": "https://...", "primary": true },
    { "label": "Google Drive", "url": "https://..." }
  ],
  "extras": [{ "label": "Repartition", "url": "https://..." }],
  "recovery": { "label": "Recommended recovery", "url": "https://..." },
  "screenshots": ["res/shots/santoni/hyperos-3-0-313-0/01.webp"],
  "screenshotsAlbum": "https://t.me/...",   // fallback when screenshots is empty
  "install": ["Flash the repartition zip", "..."],
  "bugs": ["Fingerprint"],
  "changelog": ["Initial port"],
  "notes": "Optional. Omit it and no note is shown.",
  "noteStyle": "callout"            // callout (highlighted) | quiet (plain line)
}
```

## Routes

| URL | View |
| --- | --- |
| `#/` | all releases, newest first, grouped by device |
| `#/d/santoni` | filtered to one device |
| `#/r/santoni/miui-12-0-3` | one release, shareable |
| `#/people` | maintainers |

## Fonts and icons

Inter for text (`--md-ref-typeface-brand` / `--md-ref-typeface-plain`), from Google Fonts.
Icons are [Feather](https://feathericons.com) (MIT), inlined as SVG in
`assets/js/lib/icons.js` - path data copied verbatim from feather-icons 4.29.2, so there is no
icon font and no runtime request. `<md-icon>` still owns the sizing; the Feather `<svg>`
sits inside it.

The palette is Material Design 3: one accent (primary) for everything interactive and every
status element, neutral surfaces and on-surface-variant for everything else.

## Settings

`#/settings` has a dark/light switch and an accent picker. Both live in `localStorage`
under `trashdump:settings` and land on `<html>` as `data-theme` and `data-accent`:

- `assets/css/tokens.css` - shape, type, motion, elevation, space, and the colour roles for
  the default (orange) accent: dark in `:root`, light in `:root[data-theme="light"]`.
- `assets/css/accents.css` - generated, one block per accent per scheme. Regenerate with
  `node tools/gen_accents.mjs > assets/css/accents.css` after editing the seed list.

An inline `<script>` in `index.html` reads the saved choice before the first paint so there
is no flash of the default theme; keep it in sync with `assets/js/lib/settings.js`.

## Licence

Site code: do what you want with it. The ROMs themselves belong to their respective
vendors and porters.
