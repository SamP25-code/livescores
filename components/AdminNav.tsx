"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAdminRole, useIsSuper } from "@/lib/auth";
import { displayNameOf } from "@/lib/adminUsers";

// The admin menu: down the left on a computer, a row of tabs across the
// top on a phone. Users is only there for full admins; Competitions and People
// for Super.
export default function AdminNav() {
  const pathname = usePathname();
  const role = useAdminRole();
  const isSuper = useIsSuper();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setName(displayNameOf(data.user));
    });
  }, []);

  const links = [
    { href: "/admin", label: "Home", active: pathname === "/admin" || pathname.startsWith("/admin/night") },
    ...(isSuper
      ? [
          { href: "/admin/competitions", label: "Competitions", active: pathname.startsWith("/admin/competitions") },
          { href: "/admin/people", label: "People", active: pathname === "/admin/people" },
        ]
      : []),
    ...(role === "owner" ? [{ href: "/admin/users", label: "Users", active: pathname === "/admin/users" }] : []),
    { href: "/admin/settings", label: "Settings", active: pathname === "/admin/settings" },
  ];

  return (
    <nav className="admin-nav" aria-label="Admin">
      {name && role && (
        <p className="admin-nav-who">
          <strong>{name}</strong>
          <span>{isSuper ? "Super" : role === "scorer" ? "Scorer" : "Admin"}</span>
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
        <button type="button" className="link-button" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
