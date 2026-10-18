"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type AdminRole = "owner" | "scorer";

// Whether this login is Super (Sam) - the only one who can set up
// competitions. Kept separate from AdminRole so the existing owner/scorer
// screens are unaffected. null while the session is still loading.
export function useIsSuper(): boolean | null {
  const [isSuper, setIsSuper] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const apply = (role: unknown) => {
      if (!cancelled) setIsSuper(role === "super");
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user.app_metadata?.role));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user.app_metadata?.role);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return isSuper;
}

export function useAdminRole(): AdminRole | null {
  const [role, setRole] = useState<AdminRole | null>(null);

  useEffect(() => {
    let cancelled = false;

    function apply(role: unknown) {
      if (!cancelled) setRole(role === "scorer" ? "scorer" : "owner");
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session?.user.app_metadata?.role));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user.app_metadata?.role);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return role;
}
