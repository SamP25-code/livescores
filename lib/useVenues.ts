"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Venue } from "@/lib/types";

// The venues with these ids, by id - for clubs' directions
export function useVenues(ids: (string | null)[]): Map<string, Venue> {
  const [venues, setVenues] = useState<Map<string, Venue>>(new Map());
  const key = [...new Set(ids.filter((i): i is string => Boolean(i)))].sort().join(",");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    supabase
      .from("venues")
      .select("*")
      .in("id", key.split(","))
      .then(({ data }) => {
        if (!cancelled) setVenues(new Map(((data ?? []) as Venue[]).map((v) => [v.id, v])));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return venues;
}
