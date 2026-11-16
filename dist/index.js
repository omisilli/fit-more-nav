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
 * Motion: when the row changes, the items that stay slide to their new
 * places, never from beyond the row's edge. One that leaves flies into
 * "More", shrinking as it goes — a copy of it, the item itself is already
 * hidden — and "More"'s count jumps. One that comes back springs out of
 * "More"; "More" itself springs in when it first shows. Not on load, not
 * while the fonts arrive, not while a row only moves with its page: only
 * when what the row shows, or its order, changes.
 * --pg-fit-more-nav-duration (400ms; 0s is at once), --pg-fit-more-nav-
 * easing for slides and flights, --pg-fit-more-nav-pop-easing for what
 * springs in. With reduced motion asked for, it is at once.
 *
 * Keys: with focus on an item or on "More", ← and → go to the one beside it
 * as the row is seen — the current item where it stands, "More" last — and
 * round from the end to the start; Home and End to the first and the last.
 * Tab goes through them as they are written.
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
const GHOST = "data-pg-fit-more-nav-ghost";
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
/* What the row showed last, and in which order, per row: motion only when
   it changes. */
const shown = new WeakMap();
const MOTION = "pg-fit-more-nav";
const DEFAULT_DURATION = 400;
const DEFAULT_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const DEFAULT_POP_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
/* Copies flying into "More" at once, at most: a window dragged fast hides
   many items in a few frames. */
const MAX_GHOSTS = 6;
let ghosts = 0;
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
/* --pg-fit-more-nav-duration in ms — seconds or ms written; 0 with reduced
   motion asked for, or before the page has settled: on load and while the
   fonts arrive the row takes its shape at once. */
function durationOf(root, css) {
    if (typeof root.animate !== "function")
        return 0;
    if (!root.hasAttribute(READY) || document.readyState !== "complete")
        return 0;
    if (document.fonts && document.fonts.status !== "loaded")
        return 0;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
        return 0;
    const raw = css.getPropertyValue("--pg-fit-more-nav-duration").trim();
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n))
        return DEFAULT_DURATION;
    return Math.max(0, raw.endsWith("ms") ? n : n * 1000);
}
function placesOf(root, parts) {
    const origin = root.getBoundingClientRect();
    return new Map(parts.map((el) => {
        const box = el.getBoundingClientRect();
        return [el, { left: box.left - origin.left, top: box.top - origin.top, width: box.width, seen: box.width > 0 }];
    }));
}
const centre = (p) => p.left + p.width / 2;
/* Ours only: a site's own animations on an item are left alone. */
function stopMotion(parts) {
    parts.forEach((el) => el.getAnimations?.().forEach((a) => a.id === MOTION && a.cancel()));
}
/* The right edge of the row's content, from its own left corner. */
function edgeOf(root) {
    const css = getComputedStyle(root);
    return px(css.borderLeftWidth) + root.clientWidth - px(css.paddingRight);
}
/* The row went on narrowing while a slide ran — a window dragged fast —
   and its edge has passed something still on its way: that slide goes on
   from the edge instead, for the time it had left. */
function keepInside(root, parts, seen, motion) {
    const edge = edgeOf(root);
    for (const el of parts) {
        const was = seen.get(el);
        if (!was?.seen || was.left + was.width <= edge + 0.5)
            continue;
        const running = (el.getAnimations?.() ?? []).filter((a) => a.id === MOTION && a.playState === "running");
        if (!running.length)
            continue;
        const left = Math.max(0, motion.duration - (Number(running[0].currentTime) || 0));
        running.forEach((a) => a.cancel());
        const to = placesOf(root, [el]).get(el);
        if (!to?.seen || left <= 0)
            continue;
        const dx = Math.min(was.left, edge - to.width) - to.left;
        if (Math.abs(dx) >= 0.5)
            el.animate({ transform: [`translateX(${dx}px)`, "none"] }, { duration: left, easing: motion.easing, id: MOTION });
    }
}
/* An item that left, on its way into "More": a copy of it where it stood,
   beside it in the same parent — so the site's styles for it still hold —
   out of the flow, unseen by keys and screen readers, gone when it lands. */
function fly(root, item, from, to, motion) {
    if (ghosts >= MAX_GHOSTS)
        return;
    const ghost = item.cloneNode(true);
    [ghost, ...ghost.querySelectorAll("[id]")].forEach((el) => el.removeAttribute("id"));
    [ITEM, PRIORITY, HIDDEN].forEach((name) => ghost.removeAttribute(name));
    ghost.setAttribute(GHOST, "");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    Object.assign(ghost.style, { position: "absolute", left: "0px", top: "0px", margin: "0px", width: `${from.width}px`, pointerEvents: "none", order: "" });
    item.after(ghost);
    // Put where the item stood, whatever its containing block is.
    const origin = root.getBoundingClientRect();
    const box = ghost.getBoundingClientRect();
    ghost.style.left = `${from.left - (box.left - origin.left)}px`;
    ghost.style.top = `${from.top - (box.top - origin.top)}px`;
    ghosts++;
    let gone = false;
    const land = () => {
        if (gone)
            return;
        gone = true;
        ghosts--;
        ghost.remove();
    };
    const dx = centre(to) - centre(from);
    const flight = ghost.animate({ transform: ["none", `translateX(${dx}px) scale(0.4)`], opacity: [1, 0] }, { duration: motion.duration, easing: motion.easing, fill: "forwards" });
    flight.onfinish = land;
    flight.oncancel = land;
    // A tab in the background does not play animations: it lands anyway.
    setTimeout(land, motion.duration + 100);
}
/* First, last, play. Those seen before and after slide from where they
   were — never from beyond the row's right edge, so nothing chases the row
   as it is dragged narrow. Those that left fly into "More"; those that came
   back spring out of it; "More" springs in when it first shows, and its
   count jumps when it changes. */
function move(root, items, more, before, motion, counted) {
    const parts = more ? [...items, more] : items;
    stopMotion(parts);
    const after = placesOf(root, parts);
    const edge = edgeOf(root);
    const slide = { duration: motion.duration, easing: motion.easing, id: MOTION };
    const pop = { duration: motion.duration, easing: motion.pop, id: MOTION };
    const moreWas = more ? before.get(more) : undefined;
    const moreIs = more ? after.get(more) : undefined;
    const door = moreWas?.seen ? moreWas : moreIs?.seen ? moreIs : null;
    for (const el of parts) {
        const from = before.get(el);
        const to = after.get(el);
        if (from?.seen && !to?.seen) {
            if (el !== more && moreIs?.seen)
                fly(root, el, from, moreIs, motion);
            continue;
        }
        if (!to?.seen)
            continue;
        if (from?.seen) {
            const dx = Math.min(from.left, edge - to.width) - to.left;
            if (Math.abs(dx) >= 0.5)
                el.animate({ transform: [`translateX(${dx}px)`, "none"] }, slide);
        }
        else if (el === more || !door) {
            el.animate({ transform: ["scale(0.6)", "none"], opacity: [0, 1] }, pop);
        }
        else {
            const dx = Math.min(centre(door), edge - to.width / 2) - centre(to);
            el.animate({ transform: [`translateX(${dx}px) scale(0.5)`, "none"], opacity: [0, 1] }, pop);
        }
    }
    const count = more?.querySelector(`[${COUNT}]`);
    if (count && counted && moreWas?.seen && moreIs?.seen) {
        count.getAnimations?.().forEach((a) => a.id === MOTION && a.cancel());
        count.animate({ transform: ["scale(1.5)", "none"] }, pop);
    }
}
/* Measure the row with every item in it, then hide what does not fit. All
   in one go, before the next paint: nothing is seen in between. */
function decide(root) {
    const { items, more } = partsOf(root);
    const css = getComputedStyle(root);
    const off = css.getPropertyValue("--pg-fit-more-nav").trim().toLowerCase() === "none";
    // Where everything stands now — slides running included — in case it
    // moves. Not read when there is no motion to give.
    const duration = durationOf(root, css);
    const before = duration > 0 && root.clientWidth > 0 ? placesOf(root, more ? [...items, more] : items) : null;
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
    let order = [...stay].sort((a, b) => a - b);
    if (picked >= 0) {
        order = order.filter((i) => i !== picked);
        const where = pickedOf(root);
        const at = where === "end" ? order.length : where === "start" ? 0 : Math.min(where - 1, order.length);
        order.splice(at, 0, picked);
        order.forEach((i, n) => items[i].style.setProperty("order", String(n)));
        more?.style.setProperty("order", String(order.length));
    }
    // What the row shows, in order, against the last time: only a change
    // moves anything. The same row a frame later — a window dragged, a
    // label the same — leaves running slides to finish.
    const showing = order.join(",") + "|" + items.length + "|" + (hidden.length ? "more" : "");
    const changed = shown.has(root) && shown.get(root) !== showing;
    shown.set(root, showing);
    // Written only when changed: each write is a change the page sees.
    const count = more?.querySelector(`[${COUNT}]`);
    const text = hidden.length ? String(hidden.length) : "";
    const counted = !!count && count.textContent !== text;
    if (count && counted)
        count.textContent = text;
    const list = more?.querySelector(`[${LIST}]`);
    const holds = hidden.map((item) => items.indexOf(item)).join(",") + "|" + items.length;
    if (list && holds !== copied.get(root)) {
        copied.set(root, holds);
        list.replaceChildren(...hidden.map(copyOf));
    }
    if (before) {
        const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
        const motion = {
            duration,
            easing: read("--pg-fit-more-nav-easing", DEFAULT_EASING),
            pop: read("--pg-fit-more-nav-pop-easing", DEFAULT_POP_EASING),
        };
        if (changed)
            move(root, items, more, before, motion, counted);
        else
            keepInside(root, more ? [...items, more] : items, before, motion);
    }
    if (!root.hasAttribute(READY))
        root.setAttribute(READY, "");
}
/* What focus stops on in an item, or in "More" outside its list: the
   element itself when it is a link or a button, else the first inside. */
const FOCUSABLE = "a[href], button";
function focusableIn(el, skip) {
    if (el.matches(FOCUSABLE))
        return el;
    return [...el.querySelectorAll(FOCUSABLE)].find((f) => !skip || !f.closest(skip)) ?? null;
}
/* The row's stops as they are seen, left to right: the items in it — the
   current one where --pg-fit-more-nav-picked put it — then "More", when it
   shows. */
function stopsOf(root) {
    const { items, more } = partsOf(root);
    const stops = items.filter((item) => !item.hasAttribute(HIDDEN)).map((item) => focusableIn(item));
    if (more && root.getAttribute(OVERFLOW) === "true")
        stops.push(focusableIn(more, `[${LIST}]`));
    const left = (el) => el.getBoundingClientRect().left;
    return stops.filter((el) => !!el).sort((a, b) => left(a) - left(b));
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
            const nodes = [...r.addedNodes, ...r.removedNodes];
            // A copy flying into "More", come or gone: not the row's own.
            if (r.type === "childList" && nodes.length && nodes.every((n) => n instanceof Element && n.hasAttribute(GHOST)))
                continue;
            if (r.type === "childList" && nodes.some(holdsRow))
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
    // ← → Home End on an item or on "More": the next stop as the row is
    // seen. Not inside "More"'s list — that is the dropdown's.
    const KEYS = ["ArrowLeft", "ArrowRight", "Home", "End"];
    const onKeydown = (event) => {
        if (live !== self || !KEYS.includes(event.key))
            return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
            return;
        const target = event.target instanceof HTMLElement ? event.target : null;
        const root = target?.closest(`[${ROOT}]`);
        if (!target || !root || target.closest(`[${LIST}]`))
            return;
        const stops = stopsOf(root);
        const at = stops.indexOf(target);
        if (at < 0)
            return;
        event.preventDefault();
        const last = stops.length - 1;
        const next = event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowRight" ? (at === last ? 0 : at + 1) : at === 0 ? last : at - 1;
        stops[next].focus();
    };
    document.addEventListener("keydown", onKeydown);
    document.fonts?.addEventListener?.("loadingdone", schedule);
    // Now, not a frame later: the row is right from the first paint after.
    update();
    return () => {
        mo.disconnect();
        document.removeEventListener("keydown", onKeydown);
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
