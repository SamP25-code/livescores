"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { accessLabel, isAnyAdmin, useAccess } from "@/lib/access";
import { displayNameOf } from "@/lib/adminUsers";
import { clearViewAs, viewingAs } from "@/lib/viewAs";

// The admin menu: down the left on a computer, a row of tabs across the
// top on a phone. Competitions and Users are there for Super and for admins
// (their own competitions); People (the shared list of players) and Venues
// for Super.
export default function AdminNav() {
  const pathname = usePathname();
  const access = useAccess();
  const isSuper = Boolean(access?.isSuper);
  const admin = access ? isAnyAdmin(access) : false;
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setName(displayNameOf(data.user));
    });
  }, []);

  const links = [
    { href: "/admin", label: "Home", active: pathname === "/admin" || pathname.startsWith("/admin/night") },
    ...(admin
      ? [{ href: "/admin/competitions", label: "Competitions", active: pathname.startsWith("/admin/competitions") }]
      : []),
    ...(isSuper
      ? [
          { href: "/admin/events", label: "Events", active: pathname.startsWith("/admin/events") },
          { href: "/admin/people", label: "People", active: pathname === "/admin/people" },
          { href: "/admin/venues", label: "Venues", active: pathname === "/admin/venues" },
        ]
      : []),
    ...(admin ? [{ href: "/admin/users", label: "Users", active: pathname === "/admin/users" }] : []),
    { href: "/admin/settings", label: "Settings", active: pathname === "/admin/settings" },
  ];

  return (
    <nav className="admin-nav" aria-label="Admin">
      {name && access && (
        <p className="admin-nav-who">
          <strong>{name}</strong>
          <span>{accessLabel(access)}</span>
        </p>
      )}
      <ul className="admin-nav-links">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`admin-nav-link ${link.active ? "active" : ""}`}
              aria-current={link.active ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="admin-nav-extra">
        <Link href="/">Public site</Link>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            // Viewing as someone: sign this tab out only, never them everywhere
            const viewing = viewingAs();
            clearViewAs();
            supabase.auth.signOut(viewing ? { scope: "local" } : undefined);
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
