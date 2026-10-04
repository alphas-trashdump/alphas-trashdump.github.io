# Audit checklist

Working list for the Material 3 pass. Kept in the repo so each round of fixes can be
ticked off instead of remembered. Run the checks at the bottom after every change.

## Round 1 - the nine-item list

| # | Item | Status | Evidence / fix |
|---|------|--------|----------------|
| 1 | Icons render filled (solid blobs) | done | `md-icon` carries `::slotted(svg){fill:currentColor}` for icon *fonts*; a style rule beats the `fill="none"` presentation attribute. `.ico` now restates Feather's contract in author CSS (base.css). |
| 2 | Release "Beta" chip identical to the metadata chips | done | Two chip roles: `tag-beta`/`status` (primary, semibold) and `meta` (outline, neutral). |
| 3 | Rows/text too big on mobile | done | Two-line list item 72 -> 64px, label 15px/22px. |
| 4 | Detail box text too small | done | `.block--details` list items at 16px/24px, value on `on-surface`. |
| 5 | Design inconsistency | done | Chip roles, row height, subheads, icon sizes, marker alignment audited; see "Consistency rules". |
| 6 | Maintainers page broken | done | Avatar top-aligned, build count on the first line (`align-self`), chips at the site's 24dp size, initial fallback for a missing avatar. |
| 7 | Note box used a warning icon | done | Back to Feather `info`. |
| 8 | Nothing is clickable | done | `$("警报-msg")` - a mangled id meant every outbound link threw `TypeError`. Real touch input test now covers chips, rows, back, switch, accent, dialog. |
| 9 | Screenshots + cleanup | done | All views in both schemes; dead code removed (`mdi`, `words`, `ICON_NAMES`, alias map, `defaults`). |

## Round 2

| # | Item | Status | Notes |
|---|------|--------|-------|
| 11 | Clean loading screen, centred, no blur animation | done | `.boot` splash in index.html: wordmark + M3 progress, no text motion. Hides the half-upgraded shell (un-styled `md-icon-button`s read as a spinner), locks scroll, dismissed by app.js, 8s hint + `<noscript>` escape. The blur keyframes are gone from `.ch` and `.top-bar__title`. |
| 12 | Audit every function | done | Function-by-function pass, then driven in a browser; findings below. |
| 13 | Download rows must be labelled by mirror | done | `Google Drive` / `Telegram` / `SourceForge` with `Main mirror` / `Mirror` + size; no more "Download - Google Drive" or "Telegram - Telegram". |
| 14 | Checklist itself | done | This file. |

## Round 3 - from the screen recording

Watched `Screen_Recording_20261004_100346_Chrome.mp4` (7.8s of scrolling on a
release page) instead of guessing what was meant.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 15 | Tag chips showed through the header | done | Not a colour bug: `#app` was not a stacking context, so the chips in the release header painted **over** the sticky bar. Measured - `elementsFromPoint(200, 56)` inside the 64px bar returned `md-assist-chip.meta`, not the header. `#app { isolation: isolate }` fixes it; the bar stays at `z-index: 1` so `md-dialog`'s scrim still covers it. |
| 16 | Boxes too big, details text too small | done | Rows 64 -> 60px with 12px padding, block gaps 24 -> 16px, note padding 16 -> 12px. The details *values* were the real text bug: they are `trailing-supporting-text`, a different token from the label, so the earlier fix only enlarged the left half. Both are body-large (16px) now. Release page 2614 -> 2080px tall. |
| 17 | Reorder the release page | done | Downloads (with "Also flash these" + Recovery) -> Screenshots -> Details -> What changed -> Known bugs -> How to flash -> Ported by -> Copy Link. The old markup split this across a sticky sidebar and a main column, so the reading order depended on the viewport; it is one ordered column at every width now, capped at 640px so the measure stays readable. |

Note for screenshots: a full-page capture of a view with `content-visibility: auto`
blocks can come back blank below the fold - the blocks get skipped again when the
capture re-lays out the page. Scroll and shoot per viewport (`wide.mjs`) instead of
trusting `captureBeyondViewport`.

## Round 4 - copy and chrome cuts

| # | Item | Status | Notes |
|---|------|--------|-------|
| 18 | Drop "Both colour schemes are generated from the same tokens." | done | The theme row is a single line now (moon/sun + label + switch). |
| 19 | Maintainers link only on home + releases | done | Both the footer text button and the header people icon drop on the maintainers and settings views (`body:not([data-view="home"]):not([data-view="release"])`). On the maintainers page it pointed at itself. Verified per view by `chrome.mjs`. |
| 20 | Drop "Saved on this device only." | done | The settings page has no subtitle. `render_check.js` pins both removals so they cannot drift back. |

## Audit findings (round 2)

Bugs found by reading every function and then driving the site:

- **Broken ids, twice**: `slot="headline muted"` in the empty-state list item put the
  class inside the slot name, so nothing slotted and "Nothing reported yet." rendered
  as an empty card. Same class of bug as round 1's `$("警报-msg")`.
- `renderError` shipped `<md-filled-button href="">`: an empty href resolves to the
  current URL, so it only looked like a retry button. Now a real button, wired to
  `location.reload()`, and proven by blocking `data/index.json`.
- `watchShots` compacted `shots` when a thumbnail failed but left the surviving
  thumbs' `data-shot` indices pointing at the old positions - the lightbox could open
  the wrong screenshot. Failed indices are now tracked separately.
- `parseHash` ran `decodeURIComponent` unguarded: a malformed hash (`#/r/100%`) threw
  `URIError` and left the page blank. Now falls back to home.
- The Back button counted pushes, so two pushes and one pop still walked out of the
  site. It now walks the real hash trail and is a no-op on the home view.
- `src=""` on a maintainer without an avatar makes the browser fetch the page url as
  an image. Falls back to an initial.
- A release missing one list key (`mirrors`, `extras`, `install`, ...) threw inside a
  template and blanked the whole page. `normalize()` fills the shape first.
- `fmtDate` printed "31 NaN 2026" for a month outside 1-12, and a size-less release
  printed "undefined" on the home row.
- Note text was escaped *before* the URL linkifier ran, so `&quot;` and `&amp;` could
  end up inside an `href`. Each piece is now escaped on its own.
- 404.html still used `.btn btn--primary`, classes that died with the old CSS, so the
  way out was unstyled. It now uses a real `md-filled-button` and the same scheme
  defaults.
- Bullets and step numbers were vertically centred against wrapped paragraphs, so a
  3-line changelog entry had its marker floating in the middle. They hang from the
  first line now.
- Dead code: `mdi()`, `words()`, `ICON_NAMES`, the icon alias map, `defaults`.
- The note claiming `md-circular-progress` was a "legacy two-arc spinner" was wrong:
  2.5.0 ships the spec's real M3 arc (`expand-arc`, `rotate-arc`, `four-color`). It
  is still not imported - every loading state here is a region-wide bar, not a
  spinner - but the splash indicator now hands over to `md-linear-progress` the
  moment Material Web is defined, so the CSS stand-in only covers the window before
  the CDN answers. Verified on a throttled connection: CSS bar at 2.5s, real
  component by 6.5s, same 240x4 box, same colours.

## Consistency rules (kept on purpose)

- Chips: 24dp when they sit inside a list row (Beta tag, metadata, roles, links),
  32dp when they are standalone controls (device filter, accent picker).
- One status tag on the site: `Beta`. Stable builds show none.
- "New" is an 8dp dot, never a chip, so a row's height never changes.
- Rows: 64dp two-line everywhere; 56dp for one-line detail rows.
- Accent (`primary`) is used only for interactive and status elements; everything
  else is surface / on-surface-variant / outline.
- 16dp page gutter, `--page` 640px (980px on wide landscape), 8dp spacing scale.
- Text motion is one move-in with M3 easing, no blur: the hero letters and the top-bar
  title used to cross-fade a `blur(2px)` filter, which read as a glitch on a slow load.
- Download rows are named after the mirror ("Google Drive", "Telegram",
  "SourceForge") with `Main mirror` / `Mirror` + size underneath - never the build
  filename, never the host twice.

## Checks

```
python3 tools/serve.py &                 # dev server on :8000
node tools/test/material_check.js        # import map, <md-*> coverage, boot script, splash
node tools/test/render_check.js          # view markup assertions
node tools/gen_accents.mjs | diff - assets/css/accents.css   # palette is generated
```

Browser checks (headless Chromium, real `Input.dispatchTouchEvent` - a synthetic
`.click()` bypasses Material Web's own toggle/revert logic and gives false passes):

| script | covers |
|--------|--------|
| `shot2.mjs <url> <out.png> --full --dark` / `--theme=light` | screenshots, console, failed requests |
| `touch.mjs` | chips, row, back, switch, accent, download dialog, scrim dismiss |
| `nav.mjs` | back trail, deep links, malformed hash, unknown release |
| `edge.mjs` | blocked `index.json` -> error state -> retry, search, clear, no results |
| `lb.mjs` | lightbox opens the tapped index, counter, escape, close button |
| `boot.mjs` | splash on a throttled connection, hand-off, 8s hint |
| `cdnblock.mjs` | CDN unreachable -> the splash says so instead of spinning |
| `chrome.mjs` | which chrome (footer, header icons, blurbs) shows on each view |
| `header.mjs` | the tag chips must not paint over the sticky bar |
| `wide.mjs` | wide-landscape layout, scrolled per viewport |