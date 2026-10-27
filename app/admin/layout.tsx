"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminNav from "@/components/AdminNav";
import type { Session } from "@supabase/supabase-js";
import { mustChoosePassword } from "@/lib/choosePassword";
import { backToOwnLogin, viewingAs } from "@/lib/viewAs";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const isLoginPage = pathname === "/admin/login";
  const isChoosePage = pathname === "/admin/choose-password";
  // Super viewing as someone in this tab (lib/viewAs.ts)
  const [viewing, setViewing] = useState<string | null>(null);
  useEffect(() => {
    setViewing(viewingAs());
  }, [session]);
  // Signed in with a password they were given: choose their own first (never
  // while Super is viewing as them)
  const mustChoose = session !== "loading" && !viewing && mustChoosePassword(session?.user);

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
    if (session && isLoginPage) router.replace(mustChoose ? "/admin/choose-password" : "/admin");
    if (session && mustChoose && !isLoginPage && !isChoosePage) router.replace("/admin/choose-password");
  }, [session, isLoginPage, isChoosePage, mustChoose, router]);

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
          <p className="quiet-line">Loading&hellip;</p>
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
  if (pathname === "/admin/reset-password" || isChoosePage || mustChoose) {
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
      {viewing && (
        <div className="view-as-bar" role="status">
          <span>
            You&rsquo;re viewing as <strong>{viewing}</strong>
          </span>
          <button type="button" onClick={() => backToOwnLogin()}>
            Back to your login
          </button>
        </div>
      )}
      <div className="admin-shell">
        <AdminNav />
        <div className="admin-main">{children}</div>
      </div>
    </>
  );
}
