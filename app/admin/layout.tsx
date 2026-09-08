"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

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

  if (isLoginPage) return <>{children}</>;
  if (session === "loading") return <div className="page">Loading&hellip;</div>;
  if (!session) return <div className="page">Redirecting to sign in&hellip;</div>;

  return <>{children}</>;
}
