"use client";

import { useEffect } from "react";
import { initDropdown } from "@plusguard/dropdown";
import { initTargetFunctions } from "@plusguard/target-functions";
import { initFitMoreNav } from "@plusguard/fit-more-nav";
import "@plusguard/dropdown/index.css";
import "@plusguard/target-functions/index.css";
import "@plusguard/fit-more-nav/index.css";

/* Mount once, high in the tree: each listens on the page, for rows and
   tabs rendered later too. None of the three knows the others. */
export function Packages() {
    useEffect(() => initDropdown(), []);
    useEffect(() => initTargetFunctions(), []);
    useEffect(() => initFitMoreNav(), []);
    return null;
}

/* priority: higher stays longer in the row; not set, 0. */
const tabs = [
    { id: "overview", title: "Overview", priority: 5, text: "Everything at a glance." },
    { id: "catalog", title: "Catalog", priority: 4, text: "Pieces, materials and sizes." },
    { id: "services", title: "Services", priority: 3, text: "Design, making and fitting." },
    { id: "projects", title: "Projects", priority: 0, text: "Finished work." },
    { id: "news", title: "News", priority: -2, text: "The first to leave for More." },
    { id: "team", title: "Team", priority: -1, text: "Who does what." },
    { id: "help", title: "Help", priority: 1, text: "Orders and guarantees." },
    { id: "contact", title: "Contact", priority: 2, text: "Write to us." },
];

/*
 * The row: the tabs are targetFunctions buttons, "More" is a dropdown.
 * Render the list empty — fit-more-nav fills it with copies of the tabs
 * that do not fit, and hides those in the row. The first tab is written
 * open; from then on targetFunctions owns data-pg-target-active.
 */
export function Tabs() {
    return (
        <div>
            <nav className="tabs" data-pg-fit-more-nav aria-label="Sections">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className="tab"
                        data-pg-fit-more-nav-item
                        data-pg-fit-more-nav-priority={t.priority}
                        data-pg-target-functions={`close-tab-except-${t.id} open-${t.id}`}
                        aria-controls={`t-${t.id}`}
                    >
                        {t.title}
                    </button>
                ))}
                <div data-pg-fit-more-nav-more data-pg-dropdown data-pg-dropdown-active="false" data-pg-dropdown-x="end">
                    <button type="button" className="more-head" data-pg-dropdown-head aria-expanded="false">
                        More <b data-pg-fit-more-nav-count aria-hidden="true" />
                    </button>
                    <div className="more-list" data-pg-dropdown-body data-pg-fit-more-nav-list />
                </div>
            </nav>
            {tabs.map((t, i) => (
                <section
                    key={t.id}
                    id={`t-${t.id}`}
                    className="panel"
                    data-pg-target={`${t.id} tab`}
                    data-pg-target-active={i === 0 ? "true" : "false"}
                >
                    <h2>{t.title}</h2>
                    <p>{t.text}</p>
                </section>
            ))}
        </div>
    );
}
