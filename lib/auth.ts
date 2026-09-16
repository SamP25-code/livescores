"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type AdminRole = "owner" | "scorer";

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
