/* ------------------------------------------------------------------
   Material Web components, straight from the published package.
   No build step: the import map in index.html resolves the bare "lit",
   "lit/*", "@lit/*" and "tslib" specifiers these files import, and every
   component below registers its custom element as soon as it loads.

   Import specifiers must be plain string literals, so the version is
   repeated on every line: bump @material/web here and in the import map
   together (tools/test/material_check.js proves they agree).

   Keep this list as short as the site allows - it is the only thing that
   decides how much of Material Web a visitor downloads.
   ------------------------------------------------------------------ */

/* buttons + icons */
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/button/filled-button.js";
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/button/text-button.js";
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/iconbutton/icon-button.js";
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/icon/icon.js";

/* containers */
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/labs/card/outlined-card.js";

/* lists */
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/list/list.js";
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/list/list-item.js";

/* chips */
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/chips/chip-set.js";
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/chips/assist-chip.js";
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/chips/filter-chip.js";

/* inputs */
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/textfield/outlined-text-field.js";
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/switch/switch.js";

/* progress + dialogs.
   md-linear-progress is the indicator the site uses. md-circular-progress - the
   spec's loading indicator, m3.material.io/components/loading-indicator - is
   available in this version too (3 extra modules, ~1.1KB, real M3 arc: it is not
   the legacy two-arc spinner). It is not imported because every loading state
   here is a region-wide bar, not a spinner. */
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/progress/linear-progress.js";
import "https://cdn.jsdelivr.net/npm/@material/web@2.5.0/dialog/dialog.js";