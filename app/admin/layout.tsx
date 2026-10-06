"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminNav from "@/components/AdminNav";
import type { Session } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === "loading") return;
    if (!session && !isLoginPage) router.replace("/admin/login");
    if (session && isLoginPage) router.replace("/admin");
  }, [session, isLoginPage, router]);

  if (isLoginPage) {
    return (
      <>
        <div className="public-background" aria-hidden="true" />
        {children}
      </>
    );
  }
  if (session === "loading") {
    return (
      <>
        <div className="public-background" aria-hidden="true" />
        <div className="page page-photo">
          <p className="hint">Loading&hellip;</p>
        </div>
      </>
    );
  }
  if (!session) {
    return (
      <>
        <div className="public-background" aria-hidden="true" />
        <div className="page page-photo">
          <p className="hint">Redirecting to sign in&hellip;</p>
        </div>
      </>
    );
  }

  // Setting a new password from a reset email is a one-off step, so it
  // stays a plain page without the menu.
  if (pathname === "/admin/reset-password") {
    return (
      <>
        <div className="public-background" aria-hidden="true" />
        {children}
      </>
    );
  }

  return (
    <>
      <div className="public-background" aria-hidden="true" />
      <div className="admin-shell">
        <AdminNav />
        <div className="admin-main">{children}</div>
      </div>
    </>
  );
}
