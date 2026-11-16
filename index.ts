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
 * Motion: when items leave or come back, those that stay slide to their
 * new places — never from beyond the row's edge, nor past it while a window
 * is dragged narrow fast — and those that come in fade in, "More" too. Not
 * on load, not while the fonts arrive, not while a row only moves with its
 * page: only when what the row shows, or its order, changes.
 * --pg-fit-more-nav-duration (200ms; 0s is at once) and
 * --pg-fit-more-nav-easing (any CSS easing). With reduced motion asked
 * for, it is at once.
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
const COPY = "data-pg-fit-more-nav-copy";
const OVERFLOW = "data-pg-fit-more-nav-overflow";
const READY = "data-pg-fit-more-nav-ready";

/* What marks the current item — the same marks the anchor package's strips
   follow. */
const MARKS = ["aria-current", "aria-selected", "aria-expanded"];
const MARKED = '[aria-current]:not([aria-current="false"]), [aria-selected="true"], [aria-expanded="true"]';

type Picked = "end" | "start" | number;

/* What "More" holds now, per row: copies are made again only when it
   changes. */
const copied = new WeakMap<HTMLElement, string>();

/* What the row showed last, and in which order, per row: motion only when
   it changes. */
const shown = new WeakMap<HTMLElement, string>();

const MOTION = "pg-fit-more-nav";
const DEFAULT_DURATION = 200;
const DEFAULT_EASING = "cubic-bezier(0.2, 0, 0, 1)";

const px = (value: string): number => parseFloat(value) || 0;

/* The row's own items and its "More" — not those of a row inside it. */
function partsOf(root: HTMLElement): { items: HTMLElement[]; more: HTMLElement | null } {
    const own = (el: Element): boolean => el.closest(`[${ROOT}]`) === root;
    const items = [...root.querySelectorAll<HTMLElement>(`[${ITEM}]`)].filter(
        (el) => own(el) && !el.closest(`[${MORE}]`),
    );
    const more = [...root.querySelectorAll<HTMLElement>(`[${MORE}]`)].find(own) ?? null;
    return { items, more };
}

const isCurrent = (item: HTMLElement): boolean => item.matches(MARKED) || !!item.querySelector(MARKED);

/* --pg-fit-more-nav-picked: end, start, or a whole number from 1. */
function pickedOf(root: HTMLElement): Picked {
    const raw = getComputedStyle(root).getPropertyValue("--pg-fit-more-nav-picked").trim().toLowerCase();
    if (raw === "start") return "start";
    const n = Number(raw);
    return raw !== "" && Number.isInteger(n) && n >= 1 ? n : "end";
}

/* An item's width in the row, its margins with it. */
function widthOf(el: HTMLElement): number {
    const css = getComputedStyle(el);
    return el.getBoundingClientRect().width + px(css.marginLeft) + px(css.marginRight);
}

/*
 * Which items stay. `keep` stays whatever the width: the current item.
 * Items leave in `leaving` order until the rest fit in `room`.
 */
function staying(widths: number[], gap: number, room: number, leaving: number[], keep: number): Set<number> {
    const stay = new Set(widths.map((_, i) => i));
    const used = (): number => {
        let sum = 0;
        stay.forEach((i) => (sum += widths[i]));
        return sum + Math.max(0, stay.size - 1) * gap;
    };
    for (const i of leaving) {
        if (used() <= room) break;
        if (i !== keep) stay.delete(i);
    }
    return stay;
}

/* "More" gets a copy of each item hidden: its link or button, or the item
   itself — without ids, which must stay unique, and without this file's
   own marks. */
function copyOf(item: HTMLElement): HTMLElement {
    const source = item.matches("a[href], button") ? item : (item.querySelector<HTMLElement>("a[href], button") ?? item);
    const copy = source.cloneNode(true) as HTMLElement;
    [copy, ...copy.querySelectorAll<HTMLElement>("[id]")].forEach((el) => el.removeAttribute("id"));
    [ITEM, PRIORITY, HIDDEN].forEach((name) => copy.removeAttribute(name));
    copy.style.removeProperty("order");
    copy.setAttribute(COPY, "");
    return copy;
}

/* --pg-fit-more-nav-duration in ms — seconds or ms written; 0 with reduced
   motion asked for, or before the page has settled: on load and while the
   fonts arrive the row takes its shape at once. */
function durationOf(root: HTMLElement, css: CSSStyleDeclaration): number {
    if (typeof root.animate !== "function") return 0;
    if (!root.hasAttribute(READY) || document.readyState !== "complete") return 0;
    if (document.fonts && document.fonts.status !== "loaded") return 0;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
    const raw = css.getPropertyValue("--pg-fit-more-nav-duration").trim();
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return DEFAULT_DURATION;
    return Math.max(0, raw.endsWith("ms") ? n : n * 1000);
}

/* Where each part of the row stands, from the row's own top left corner —
   so a row that moves with its page (a centred header growing) is not a
   move. Running slides are in it: a new slide picks up where one is. */
type Place = { left: number; top: number; width: number; seen: boolean };
function placesOf(root: HTMLElement, parts: HTMLElement[]): Map<HTMLElement, Place> {
    const origin = root.getBoundingClientRect();
    return new Map(
        parts.map((el) => {
            const box = el.getBoundingClientRect();
            return [el, { left: box.left - origin.left, top: box.top - origin.top, width: box.width, seen: box.width > 0 }];
        }),
    );
}

/* Ours only: a site's own animations on an item are left alone. */
function stopMotion(parts: HTMLElement[]): void {
    parts.forEach((el) => el.getAnimations?.().forEach((a) => a.id === MOTION && a.cancel()));
}

type Motion = { duration: number; easing: string };

/* The right edge of the row's content, from its own left corner. */
function edgeOf(root: HTMLElement): number {
    const css = getComputedStyle(root);
    return px(css.borderLeftWidth) + root.clientWidth - px(css.paddingRight);
}

/* The row went on narrowing while a slide ran — a window dragged fast —
   and its edge has passed something still on its way: that slide goes on
   from the edge instead, for the time it had left. */
function keepInside(root: HTMLElement, parts: HTMLElement[], seen: Map<HTMLElement, Place>, motion: Motion): void {
    const edge = edgeOf(root);

    for (const el of parts) {
        const was = seen.get(el);
        if (!was?.seen || was.left + was.width <= edge + 0.5) continue;
        const running = (el.getAnimations?.() ?? []).filter((a) => a.id === MOTION && a.playState === "running");
        if (!running.length) continue;
        const left = Math.max(0, motion.duration - (Number(running[0].currentTime) || 0));
        running.forEach((a) => a.cancel());
        const to = placesOf(root, [el]).get(el);
        if (!to?.seen || left <= 0) continue;
        const dx = Math.min(was.left, edge - to.width) - to.left;
        if (Math.abs(dx) >= 0.5) el.animate({ transform: [`translateX(${dx}px)`, "none"] }, { duration: left, easing: motion.easing, id: MOTION });
    }
}

/* First, last, play: those seen before and after slide from where they
   were — mid-slide too, a new slide picks up where the last one is — but
   never from beyond the row's right edge, so nothing chases a row dragged
   narrow. Those that were not seen — an item back from "More", "More"
   itself — fade in. */
function move(root: HTMLElement, parts: HTMLElement[], before: Map<HTMLElement, Place>, motion: Motion): void {
    stopMotion(parts);
    const after = placesOf(root, parts);
    const edge = edgeOf(root);
    const timing = { duration: motion.duration, easing: motion.easing, id: MOTION };
    for (const el of parts) {
        const from = before.get(el);
        const to = after.get(el);
        if (!to?.seen) continue;
        if (from?.seen) {
            const dx = Math.min(from.left, edge - to.width) - to.left;
            if (Math.abs(dx) >= 0.5) el.animate({ transform: [`translateX(${dx}px)`, "none"] }, timing);
        } else {
            el.animate({ opacity: [0, 1] }, timing);
        }
    }
}

/* Measure the row with every item in it, then hide what does not fit. All
   in one go, before the next paint: nothing is seen in between. */
function decide(root: HTMLElement): void {
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
        const priority = (i: number): number => Number(items[i].getAttribute(PRIORITY)) || 0;
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
    if (hidden.length) root.setAttribute(OVERFLOW, "true");
    else root.removeAttribute(OVERFLOW);

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
    if (count && count.textContent !== text) count.textContent = text;

    const list = more?.querySelector<HTMLElement>(`[${LIST}]`);
    const holds = hidden.map((item) => items.indexOf(item)).join(",") + "|" + items.length;
    if (list && holds !== copied.get(root)) {
        copied.set(root, holds);
        list.replaceChildren(...hidden.map(copyOf));
    }

    if (before) {
        const read = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
        const motion = { duration, easing: read("--pg-fit-more-nav-easing", DEFAULT_EASING) };
        const parts = more ? [...items, more] : items;
        if (changed) move(root, parts, before, motion);
        else keepInside(root, parts, before, motion);
    }

    if (!root.hasAttribute(READY)) root.setAttribute(READY, "");
}

/* What focus stops on in an item, or in "More" outside its list: the
   element itself when it is a link or a button, else the first inside. */
const FOCUSABLE = "a[href], button";
function focusableIn(el: HTMLElement, skip?: string): HTMLElement | null {
    if (el.matches(FOCUSABLE)) return el;
    return [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].find((f) => !skip || !f.closest(skip)) ?? null;
}

/* The row's stops as they are seen, left to right: the items in it — the
   current one where --pg-fit-more-nav-picked put it — then "More", when it
   shows. */
function stopsOf(root: HTMLElement): HTMLElement[] {
    const { items, more } = partsOf(root);
    const stops = items.filter((item) => !item.hasAttribute(HIDDEN)).map((item) => focusableIn(item));
    if (more && root.getAttribute(OVERFLOW) === "true") stops.push(focusableIn(more, `[${LIST}]`));
    const left = (el: HTMLElement): number => el.getBoundingClientRect().left;
    return stops.filter((el): el is HTMLElement => !!el).sort((a, b) => left(a) - left(b));
}

/* Only the newest call answers — a late cleanup from an older one (React
   remounting) cannot switch it off. Same rule as the other packages. */
let live: object | null = null;

/* Start watching every row on the page, those rendered later too; returns
   the cleanup for a React effect. */
export function initFitMoreNav(): () => void {
    if (typeof document === "undefined") return () => {};

    const self = {};
    live = self;

    let roots: HTMLElement[] = [];
    let dirty = true;
    let frame = 0;

    // A row resized decides at once: the observer answers after layout and
    // before paint, so no frame is painted with the row narrower and its
    // items not yet gone — a window dragged fast would show them past its
    // edge. Hiding items does not resize the row (index.css gives it its
    // width from its place), so this does not call itself again.
    const sizes =
        typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(() => {
                  if (frame) cancelAnimationFrame(frame);
                  update();
              });

    const update = (): void => {
        frame = 0;
        if (live !== self) return;
        if (dirty) {
            dirty = false;
            roots = [...document.querySelectorAll<HTMLElement>(`[${ROOT}]`)];
            sizes?.disconnect();
            roots.forEach((root) => sizes?.observe(root));
        }
        roots.forEach(decide);
    };
    const schedule = (): void => {
        if (!frame) frame = requestAnimationFrame(update);
    };

    // A row added or taken away: look round the page again. A change inside
    // a row — a new item, a new label, a new current one — decides again;
    // one "More" makes to itself (its copies, its count, its head opening)
    // does not.
    const holdsRow = (node: Node): boolean =>
        node instanceof Element && (node.matches(`[${ROOT}]`) || !!node.querySelector(`[${ROOT}]`));
    const inRow = (node: Node): boolean => {
        const el = node instanceof Element ? node : node.parentElement;
        return !!el?.closest(`[${ROOT}]`) && !el.closest(`[${MORE}]`);
    };
    const mo = new MutationObserver((records) => {
        let changed = false;
        for (const r of records) {
            if (r.type === "childList" && [...r.addedNodes, ...r.removedNodes].some(holdsRow)) dirty = true;
            if (r.type === "attributes" && r.attributeName === ROOT) dirty = true;
            if (inRow(r.target)) changed = true;
        }
        if (changed || dirty) schedule();
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
    const onKeydown = (event: KeyboardEvent): void => {
        if (live !== self || !KEYS.includes(event.key)) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const target = event.target instanceof HTMLElement ? event.target : null;
        const root = target?.closest<HTMLElement>(`[${ROOT}]`);
        if (!target || !root || target.closest(`[${LIST}]`)) return;
        const stops = stopsOf(root);
        const at = stops.indexOf(target);
        if (at < 0) return;
        event.preventDefault();
        const last = stops.length - 1;
        const next =
            event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowRight" ? (at === last ? 0 : at + 1) : at === 0 ? last : at - 1;
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
        if (frame) cancelAnimationFrame(frame);
        if (live === self) live = null;
    };
}
