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
```

`render_check.js` renders every view against the real data outside a browser and fails
on template crashes, `undefined` leaking into the output, or unescaped user content.

## Layout

```
index.html                  shell only; every view is rendered client-side
assets/css/base.css         design tokens, reset, buttons/tags
assets/css/app.css          header, cards, release page, gallery, lightbox
assets/js/store.js          fetch + normalise data, search, formatting
assets/js/ui.js             HTML templates (all output escaped)
assets/js/app.js            hash router, lightbox, wiring
data/devices.json           device targets
data/maintainers.json       people + avatars
data/releases/<dev>/*.json  one file per release  <- the only thing you normally edit
data/index.json             generated; do not hand-edit
res/maintainers/            avatars
res/shots/<dev>/<id>/       screenshots, committed and optimised
tools/build_index.py        validate + generate data/index.json
tools/publish_issue.py      issue form -> release file (used by the bot)
tools/serve.py              local preview server
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

## Fonts

The UI is set in [MiSans](https://hyperos.mi.com/font-en/) (Latin subset), loaded from
jsDelivr via [dsrkafuu/misans](https://github.com/dsrkafuu/misans). The three faces it
ships declare non-standard weights - 380, 520 and 630 - so the CSS asks for those exact
numbers instead of 500/600/700, otherwise the browser snaps semibold up to bold. MiSans
is Xiaomi's font under its own licence, which asks that its use be credited; the credit
is in the site footer.

## Licence

Site code: do what you want with it. The ROMs themselves belong to their respective
vendors and porters.
