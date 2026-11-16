/*
 * fit-more-nav — a row of links or tabs that always fits: what does not fit
 * moves to "More".
 *
 *   <nav data-pg-fit-more-nav>
 *       <a data-pg-fit-more-nav-item href="/">Home</a>
 *       <a data-pg-fit-more-nav-item href="/team" data-pg-fit-more-nav-priority="-1">Team</a>
 *       …
 *       <div data-pg-fit-more-nav-more data-pg-dropdown data-pg-dropdown-active="false">
 *           <button data-pg-dropdown-head aria-expanded="false">More <b data-pg-fit-more-nav-count></b></button>
 *           <div data-pg-dropdown-body data-pg-fit-more-nav-list></div>
 *       </div>
 *   </nav>
 *
 * It completes the dropdown package: "More" is a dropdown, written by the
 * site, opened and closed by dropdown. Tabs are targetFunctions buttons.
 * This file only measures and decides — no import of either.
 *
 * The row's own width is watched, not the window's. When its items do not
 * fit, room is kept for "More" and items leave one at a time — the lowest
 * data-pg-fit-more-nav-priority first (default 0; on a tie, the later one)
 * — until the rest fit. They come back as the row grows.
 *
 * The current item never leaves: the one marked aria-current,
 * aria-selected="true" or aria-expanded="true" (a targetFunctions tab).
 * Picked from "More", it comes into the row and another leaves; while the
 * row is too narrow for it in its own place it stands where
 * --pg-fit-more-nav-picked says: end (default, beside "More"), start, or a
 * place counted from the start — 3, or the last there is. When the row is
 * wide enough again, every item is back in its own place.
 *
 * Items are never moved or made: one that does not fit is hidden
 * (data-pg-fit-more-nav-hidden), and "More" gets a copy of it — a link
 * keeps its href, a tab its commands, so a click on the copy does what a
 * click on the item does. React's markup stays as React wrote it. Render
 * the data-pg-fit-more-nav-list empty; this file fills it.
 *
 * --pg-fit-more-nav: none — by screen size, with a media query — leaves
 * every item in the row and "More" away.
 *
 * No dependencies.
 */
const ROOT = "data-pg-fit-more-nav";
const ITEM = "data-pg-fit-more-nav-item";
const PRIORITY = "data-pg-fit-more-nav-priority";
const MORE = "data-pg-fit-more-nav-more";
const LIST = "data-pg-fit-more-nav-list";
const COUNT = "data-pg-fit-more-nav-count";
const HIDDEN = "data-pg-fit-more-nav-hidden";
const COPY = "data-pg-fit-more-nav-copy";
const OVERFLOW = "data-pg-fit-more-nav-overflow";
const READY = "data-pg-fit-more-nav-ready";
/* What marks the current item — the same marks the anchor package's strips
   follow. */
const MARKS = ["aria-current", "aria-selected", "aria-expanded"];
const MARKED = '[aria-current]:not([aria-current="false"]), [aria-selected="true"], [aria-expanded="true"]';
/* What "More" holds now, per row: copies are made again only when it
   changes. */
const copied = new WeakMap();
const px = (value) => parseFloat(value) || 0;
/* The row's own items and its "More" — not those of a row inside it. */
function partsOf(root) {
    const own = (el) => el.closest(`[${ROOT}]`) === root;
    const items = [...root.querySelectorAll(`[${ITEM}]`)].filter((el) => own(el) && !el.closest(`[${MORE}]`));
    const more = [...root.querySelectorAll(`[${MORE}]`)].find(own) ?? null;
    return { items, more };
}
const isCurrent = (item) => item.matches(MARKED) || !!item.querySelector(MARKED);
/* --pg-fit-more-nav-picked: end, start, or a whole number from 1. */
function pickedOf(root) {
    const raw = getComputedStyle(root).getPropertyValue("--pg-fit-more-nav-picked").trim().toLowerCase();
    if (raw === "start")
        return "start";
    const n = Number(raw);
    return raw !== "" && Number.isInteger(n) && n >= 1 ? n : "end";
}
/* An item's width in the row, its margins with it. */
function widthOf(el) {
    const css = getComputedStyle(el);
    return el.getBoundingClientRect().width + px(css.marginLeft) + px(css.marginRight);
}
/*
 * Which items stay. `keep` stays whatever the width: the current item.
 * Items leave in `leaving` order until the rest fit in `room`.
 */
function staying(widths, gap, room, leaving, keep) {
    const stay = new Set(widths.map((_, i) => i));
    const used = () => {
        let sum = 0;
        stay.forEach((i) => (sum += widths[i]));
        return sum + Math.max(0, stay.size - 1) * gap;
    };
    for (const i of leaving) {
        if (used() <= room)
            break;
        if (i !== keep)
            stay.delete(i);
    }
    return stay;
}
/* "More" gets a copy of each item hidden: its link or button, or the item
   itself — without ids, which must stay unique, and without this file's
   own marks. */
function copyOf(item) {
    const source = item.matches("a[href], button") ? item : (item.querySelector("a[href], button") ?? item);
    const copy = source.cloneNode(true);
    [copy, ...copy.querySelectorAll("[id]")].forEach((el) => el.removeAttribute("id"));
    [ITEM, PRIORITY, HIDDEN].forEach((name) => copy.removeAttribute(name));
    copy.style.removeProperty("order");
    copy.setAttribute(COPY, "");
    return copy;
}
/* Measure the row with every item in it, then hide what does not fit. All
   in one go, before the next paint: nothing is seen in between. */
function decide(root) {
    const { items, more } = partsOf(root);
    const css = getComputedStyle(root);
    const off = css.getPropertyValue("--pg-fit-more-nav").trim().toLowerCase() === "none";
    // Everything in the row, in its own order; "More" shown, to measure it.
    items.forEach((item) => {
        item.removeAttribute(HIDDEN);
        item.style.removeProperty("order");
    });
    more?.style.removeProperty("order");
    root.setAttribute(OVERFLOW, "true");
    const room = root.clientWidth - px(css.paddingLeft) - px(css.paddingRight);
    const gap = px(css.columnGap);
    const widths = items.map(widthOf);
    const moreWidth = more ? widthOf(more) : 0;
    const total = widths.reduce((a, b) => a + b, 0) + Math.max(0, items.length - 1) * gap;
    let stay = new Set(items.map((_, i) => i));
    let picked = -1;
    if (!off && more && total > room) {
        // Lowest priority first; on a tie, the later item.
        const priority = (i) => Number(items[i].getAttribute(PRIORITY)) || 0;
        const leaving = items.map((_, i) => i).sort((a, b) => priority(a) - priority(b) || b - a);
        const left = room - moreWidth - gap;
        const current = items.findIndex(isCurrent);
        stay = staying(widths, gap, left, leaving, -1);
        // The current item would be in "More": it stays, another leaves,
        // and it stands where --pg-fit-more-nav-picked says.
        if (current >= 0 && !stay.has(current)) {
            stay = staying(widths, gap, left, leaving, current);
            picked = current;
        }
    }
    const hidden = items.filter((_, i) => !stay.has(i));
    hidden.forEach((item) => item.setAttribute(HIDDEN, ""));
    if (hidden.length)
        root.setAttribute(OVERFLOW, "true");
    else
        root.removeAttribute(OVERFLOW);
    if (picked >= 0) {
        const order = [...stay].filter((i) => i !== picked).sort((a, b) => a - b);
        const where = pickedOf(root);
        const at = where === "end" ? order.length : where === "start" ? 0 : Math.min(where - 1, order.length);
        order.splice(at, 0, picked);
        order.forEach((i, n) => items[i].style.setProperty("order", String(n)));
        more?.style.setProperty("order", String(order.length));
    }
    // Written only when changed: each write is a change the page sees.
    const count = more?.querySelector(`[${COUNT}]`);
    const text = hidden.length ? String(hidden.length) : "";
    if (count && count.textContent !== text)
        count.textContent = text;
    const list = more?.querySelector(`[${LIST}]`);
    const holds = hidden.map((item) => items.indexOf(item)).join(",") + "|" + items.length;
    if (list && holds !== copied.get(root)) {
        copied.set(root, holds);
        list.replaceChildren(...hidden.map(copyOf));
    }
    if (!root.hasAttribute(READY))
        root.setAttribute(READY, "");
}
/* Only the newest call answers — a late cleanup from an older one (React
   remounting) cannot switch it off. Same rule as the other packages. */
let live = null;
/* Start watching every row on the page, those rendered later too; returns
   the cleanup for a React effect. */
export function initFitMoreNav() {
    if (typeof document === "undefined")
        return () => { };
    const self = {};
    live = self;
    let roots = [];
    let dirty = true;
    let frame = 0;
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => schedule());
    const update = () => {
        frame = 0;
        if (live !== self)
            return;
        if (dirty) {
            dirty = false;
            roots = [...document.querySelectorAll(`[${ROOT}]`)];
            sizes?.disconnect();
            roots.forEach((root) => sizes?.observe(root));
        }
        roots.forEach(decide);
    };
    const schedule = () => {
        if (!frame)
            frame = requestAnimationFrame(update);
    };
    // A row added or taken away: look round the page again. A change inside
    // a row — a new item, a new label, a new current one — decides again;
    // one "More" makes to itself (its copies, its count, its head opening)
    // does not.
    const holdsRow = (node) => node instanceof Element && (node.matches(`[${ROOT}]`) || !!node.querySelector(`[${ROOT}]`));
    const inRow = (node) => {
        const el = node instanceof Element ? node : node.parentElement;
        return !!el?.closest(`[${ROOT}]`) && !el.closest(`[${MORE}]`);
    };
    const mo = new MutationObserver((records) => {
        let changed = false;
        for (const r of records) {
            if (r.type === "childList" && [...r.addedNodes, ...r.removedNodes].some(holdsRow))
                dirty = true;
            if (r.type === "attributes" && r.attributeName === ROOT)
                dirty = true;
            if (inRow(r.target))
                changed = true;
        }
        if (changed || dirty)
            schedule();
    });
    mo.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...MARKS, ITEM, PRIORITY, ROOT],
    });
    addEventListener("resize", schedule);
    addEventListener("load", schedule);
    // The fonts arrive: every label has its real width now.
    document.fonts?.ready.then(schedule);
    document.fonts?.addEventListener?.("loadingdone", schedule);
    // Now, not a frame later: the row is right from the first paint after.
    update();
    return () => {
        mo.disconnect();
        sizes?.disconnect();
        removeEventListener("resize", schedule);
        removeEventListener("load", schedule);
        document.fonts?.removeEventListener?.("loadingdone", schedule);
        if (frame)
            cancelAnimationFrame(frame);
        if (live === self)
            live = null;
    };
}
