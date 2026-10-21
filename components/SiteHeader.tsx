"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { loadLiveMatches, loadPublicCompetitions } from "@/lib/publicData";
import type { PublicCompetition } from "@/lib/publicCompetitions";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { menuEvents, menuItems, searchMenu, type MenuEvent, type MenuItem } from "@/lib/siteMenu";

// Loaded the first time the menu opens, then kept for the visit
type Menu = { items: MenuItem[]; events: MenuEvent[]; live: number };
let cached: Promise<Menu> | null = null;
function loadMenu() {
  if (!cached) {
    cached = Promise.all([loadPublicCompetitions(), loadLiveMatches()]).then(([all, live]: [PublicCompetition[], unknown[]]) => ({
      items: menuItems(all),
      events: menuEvents(all),
      live: live.length,
    }));
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/competitions", label: "Competitions" },
  { href: "/calendar", label: "Calendar" },
  { href: "/clubs", label: "Clubs" },
  { href: "/champions", label: "Champions" },
];

// Whether this visit has already been on another of the site's pages, so
// Back can go back to it rather than off the site
let visited: string | null = null;

// The top of every public page: the menu button (☰), Back (except on the
// home page), and the site's name. The menu has a search - every
// competition, club and event that matches, narrowing as you type - then
// the main pages, then the events in gold with their competitions.
export default function SiteHeader({ compact = false, back = "/" }: { compact?: boolean; back?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cameFromSite, setCameFromSite] = useState(false);
  useEffect(() => {
    setCameFromSite(visited !== null && visited !== pathname);
    visited = pathname;
  }, [pathname]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<Menu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    loadMenu()
      .then(setMenu)
      .catch(() => setMenu({ items: [], events: [], live: 0 }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    menuRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Closes when a link is followed
  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [pathname]);

  const results = menu ? searchMenu(menu.items, query) : [];

  return (
    <>
      <header className={`site-header ${compact ? "site-header-compact" : ""}`}>
        <button type="button" className="site-menu-button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <span />
          <span />
          <span />
        </button>
        {pathname !== "/" && (
          <button
            type="button"
            className="site-back-button"
            onClick={() => (cameFromSite ? router.back() : router.push(back))}
          >
            <span aria-hidden="true">&lsaquo;</span> Back
          </button>
        )}
        <Link href="/" className="site-brand">
          <span className="site-brand-name">{SITE_NAME}</span>
          {!compact && <span className="site-brand-tagline">{SITE_TAGLINE}</span>}
        </Link>
      </header>

      {open && (
        <div className="site-menu" role="dialog" aria-modal="true" aria-label="Menu" ref={menuRef} tabIndex={-1}>
          <nav className="site-menu-panel">
            <div className="site-menu-top">
              <span className="site-menu-title">{SITE_NAME}</span>
              <button type="button" className="site-menu-close" aria-label="Close the menu" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <input
              type="search"
              className="site-menu-search"
              placeholder="Find a competition, club or event"
              aria-label="Find a competition, club or event"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {query.trim() ? (
              <div className="site-menu-results">
                {menu === null && <p className="hint">Loading&hellip;</p>}
                {menu !== null && results.length === 0 && <p className="hint">Nothing matches &ldquo;{query.trim()}&rdquo;.</p>}
                {results.map((r) => (
                  <Link key={r.href} href={r.href} className="site-menu-item site-menu-sub">
                    <span>
                      <strong>{r.title}</strong>
                      <span className="hint">{r.detail}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <>
                {LINKS.slice(0, 1).map((l) => (
                  <Link key={l.href} href={l.href} className="site-menu-item">
                    {l.label}
                  </Link>
                ))}
                {menu && menu.live > 0 && (
                  <Link href="/#live" className="site-menu-item">
                    <span className="live-dot" aria-hidden="true" />
                    Live now
                    <span className="site-menu-live">
                      {menu.live} match{menu.live === 1 ? "" : "es"}
                    </span>
                  </Link>
                )}
                {LINKS.slice(1).map((l) => (
                  <Link key={l.href} href={l.href} className="site-menu-item">
                    {l.label}
                  </Link>
                ))}

                {menu && menu.events.length > 0 && <p className="site-menu-heading">Events</p>}
                {menu?.events.map((e) => (
                  <div key={e.href} className="site-menu-event">
                    <Link href={e.href} className="site-menu-event-name">
                      <strong>{e.title}</strong>
                      {e.dates && <span>{e.dates}</span>}
                    </Link>
                    {e.competitions.map((c) => (
                      <Link key={c.href} href={c.href} className="site-menu-event-comp">
                        {c.title}
                      </Link>
                    ))}
                  </div>
                ))}
              </>
            )}

            <p className="site-menu-foot">
              <Link href="/privacy">Privacy</Link> · <Link href="/admin">Log in</Link>
            </p>
          </nav>
          <button type="button" className="site-menu-shade" aria-label="Close the menu" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
