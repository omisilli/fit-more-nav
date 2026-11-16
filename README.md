# fit-more-nav

A row of links or tabs that always fits. What does not fit moves to
**More**, the least important first, and comes back as the row grows. The
row never wraps and never cuts an item in half, and the current item never
leaves it. No dependencies.

> **fit-more-nav completes dropdown — install them together.** "More" is a
> dropdown: written by your site, opened and closed by
> [`@plusguard/dropdown`](https://github.com/omisilli/dropdown). For tabs,
> [`@plusguard/target-functions`](https://github.com/omisilli/target-functions)
> opens the one picked. fit-more-nav only measures the row and decides
> what stays; it imports neither — each package is installed on its own.

```sh
npm install github:omisilli/dropdown#v1.4.0
npm install github:omisilli/target-functions#v3.2.0   # for tabs
npm install github:omisilli/anchor#v3.2.1             # for long tabs
npm install github:omisilli/fit-more-nav#v1.0.0
```

```ts
import { initDropdown } from "@plusguard/dropdown";
import { initTargetFunctions } from "@plusguard/target-functions";
import { initAnchor } from "@plusguard/anchor";
import { initFitMoreNav } from "@plusguard/fit-more-nav";
import "@plusguard/fit-more-nav/index.css";

initDropdown();
initTargetFunctions(); // for tabs
initAnchor();          // for long tabs
initFitMoreNav();
```

Each returns its own cleanup.

### Without a build step

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/omisilli/dropdown@v1.4.0/index.css" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/omisilli/target-functions@v3.2.0/index.css" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/omisilli/anchor@v3.2.1/index.css" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/omisilli/fit-more-nav@v1.0.0/index.css" />
<script type="module">
    import { initDropdown } from "https://cdn.jsdelivr.net/gh/omisilli/dropdown@v1.4.0/dist/index.js";
    import { initTargetFunctions } from "https://cdn.jsdelivr.net/gh/omisilli/target-functions@v3.2.0/dist/index.js";
    import { initAnchor } from "https://cdn.jsdelivr.net/gh/omisilli/anchor@v3.2.1/dist/index.js";
    import { initFitMoreNav } from "https://cdn.jsdelivr.net/gh/omisilli/fit-more-nav@v1.0.0/dist/index.js";

    initDropdown();
    initTargetFunctions();
    initAnchor();
    initFitMoreNav();
</script>
```

Pin the versions on a live site. A pinned URL never changes; `@1` follows
the newest 1.x release.

## Which do I need?

| The row is                   | You need                                                     |
| ---------------------------- | ------------------------------------------------------------ |
| A menu of links to pages     | `dropdown` + `fit-more-nav`                                  |
| Tabs                         | `dropdown` + `target-functions` + `fit-more-nav`             |
| Tabs with long panels        | the same + `anchor` (`data-pg-anchor` on the tabs)           |
| A row that should scroll sideways instead | Not this: the anchor package's `data-pg-anchor-strip` |

## The packages it is used with — and why

| Package                          | Why it is here                                                                                                   | When       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| `dropdown`                       | It **is** "More": its look, opening and closing, Escape, a press outside; it closes once a link or tab is picked. `data-pg-dropdown-x="end"` keeps the list on the screen at the row's end. | Always     |
| `target-functions`               | Opens the tab picked — in the row, or its copy in "More", which carries the same commands. Writes the `aria-expanded` that marks the open tab, the one that never leaves the row; opens a tab named by the address's `#id`. | Tabs       |
| `anchor` — `data-pg-anchor`      | Far down a long tab, a tab pressed brings the page back to its start (`--pg-anchor-when: passed`) — in the row or in "More", where the copy carries it too. | Long tabs  |
| `anchor` — `data-pg-anchor-strip`| Scrolls a row sideways instead of moving items to "More". The other answer to the same row: one or the other, never both. | Not with this row |

fit-more-nav imports none of them, and none of them knows it: each is
installed and started on its own, and they meet only in the markup.

## The markup

```html
<nav data-pg-fit-more-nav aria-label="Sections">
    <button data-pg-fit-more-nav-item data-pg-fit-more-nav-priority="5"
            data-pg-target-functions="close-tab-except-overview open-overview"
            aria-controls="t-overview">Overview</button>
    <button data-pg-fit-more-nav-item data-pg-fit-more-nav-priority="-2"
            data-pg-target-functions="close-tab-except-news open-news"
            aria-controls="t-news">News</button>
    …

    <!-- "More": a dropdown. Leave its list empty. -->
    <div data-pg-fit-more-nav-more data-pg-dropdown data-pg-dropdown-active="false" data-pg-dropdown-x="end">
        <button data-pg-dropdown-head aria-expanded="false">
            More <b data-pg-fit-more-nav-count aria-hidden="true"></b>
        </button>
        <div data-pg-dropdown-body data-pg-fit-more-nav-list></div>
    </div>
</nav>
```

- **The row** (`data-pg-fit-more-nav`) is one flex line. Its width comes
  from its place, not its items: in a header it takes what is left between
  the logo and the rest (`index.css` gives it `flex: 1 1 0%` and
  `min-width: 0`).
- **The items** (`data-pg-fit-more-nav-item`) are the row's children — a
  link, a button, or a box around one.
- **"More"** (`data-pg-fit-more-nav-more`) is a dropdown, after the items.
  `data-pg-fit-more-nav-count` shows how many are in it;
  `data-pg-fit-more-nav-list` gets their copies.

## What it does

### It measures the row, not the window

A `ResizeObserver` watches the row's own width — so it works the same in a
header, a sidebar or a panel, and when the fonts arrive it measures again.
When the items do not fit, room is kept for "More" and items leave one at a
time until the rest do. They come back, one at a time, as the row grows.
All of it happens before the next paint: an item is never seen cut off or
on a second line.

### The least important first

`data-pg-fit-more-nav-priority`: a higher number stays longer. Not set, it
is 0; on a tie the later item leaves first — so with no priorities at all,
items leave from the end.

### The current item never leaves

The current item is the one marked `aria-current`, `aria-selected="true"`
or `aria-expanded="true"` — the marks targetFunctions writes on a tab, the
same marks the anchor package's strips follow. Picked from "More", a tab
comes into the row and another leaves. A page opened on `#t-news`
(targetFunctions opens that tab) shows News in the row, however narrow.

While the row is too narrow for it in its own place, it stands where
`--pg-fit-more-nav-picked` says:

| `--pg-fit-more-nav-picked` | The current item stands                          |
| -------------------------- | ------------------------------------------------ |
| `end` (default)            | Last in the row, beside "More"                   |
| `start`                    | First                                            |
| `3`                        | Third — or the last place there is, if fewer stay |

When the row is wide enough again, every item is back in its own place. It
is CSS, so a media query sets it per screen size. The place is CSS `order`:
the item is not moved in the page, and the Tab key still goes through the
items as they are written.

### Nothing is moved or made

An item that does not fit is hidden (`data-pg-fit-more-nav-hidden`), and
"More" gets a copy of it: a link keeps its `href`, a tab its
`data-pg-target-functions` — a click on the copy does what a click on the
item does, and dropdown closes "More" after it. Ids are left off the copy.
Your markup stays as you, or React, wrote it.

## CSS

Set anywhere above the row — `:root`, the row itself — and per screen size
with media queries:

| Variable                   | Default | What                                                      |
| -------------------------- | ------- | --------------------------------------------------------- |
| `--pg-fit-more-nav`        | —       | `none`: every item in the row, no "More"                  |
| `--pg-fit-more-nav-picked` | `end`   | Where the current item stands while the row is too narrow — `end`, `start` or a place from 1 |

Before the script has looked, the row is cut at its end
(`overflow: clip`) rather than spilling out; "More" shows only when
something is in it.

## Attributes

| Attribute                         | On          | What                                          |
| --------------------------------- | ----------- | --------------------------------------------- |
| `data-pg-fit-more-nav`            | the row     | The row that fits                             |
| `data-pg-fit-more-nav-item`       | each item   | An item that may move to "More"               |
| `data-pg-fit-more-nav-priority`   | an item     | Higher stays longer; default 0                |
| `data-pg-fit-more-nav-more`       | "More"      | The dropdown, after the items                 |
| `data-pg-fit-more-nav-count`      | in "More"   | Filled with how many are in it                |
| `data-pg-fit-more-nav-list`       | in "More"   | Left empty; filled with the copies            |

Written by this file — do not write them yourself:
`data-pg-fit-more-nav-hidden` on an item, `data-pg-fit-more-nav-copy` on a
copy, `data-pg-fit-more-nav-overflow` and `data-pg-fit-more-nav-ready` on
the row.

## React (Next)

```tsx
useEffect(() => initFitMoreNav(), []);
```

Mount it once, high in the tree, beside dropdown's, targetFunctions' and anchor's;
rows rendered later are found too. Render `data-pg-fit-more-nav-list`
empty and never give it children: this file fills it. If `initFitMoreNav`
is called again before the first cleanup runs (React remounting in
development), only the newest call answers. See
[`examples/react/Example.tsx`](examples/react/Example.tsx).

## Example

[`examples/static/index.html`](examples/static/index.html) — tabs in an app
bar, a window you narrow with a slider, and switches for where the picked
tab stands (`?picked=start`, `?picked=3`), for leaving by priority or from
the end (`?priority=none`), and a link that opens a tab by `#id`. anchor
sits beside it: far down the long first tab, a tab pressed in the row or
in "More" brings the page back to its start (`?when=always`,
`?when=never` to compare).
