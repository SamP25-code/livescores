"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Night } from "@/lib/types";

export default function NightNav({ currentId }: { currentId?: string }) {
  const [nights, setNights] = useState<Night[]>([]);

  useEffect(() => {
    supabase
      .from("nights")
      .select("*")
      .order("sort_order")
      .order("created_at")
      .then(({ data }) => setNights(data ?? []));
  }, []);

  if (nights.length === 0) return null;

  return (
    <nav className="night-nav">
      {nights.map((n) => (
        <Link key={n.id} href={`/night/${n.id}`} className={`night-pill ${n.id === currentId ? "active" : ""}`}>
          {n.name}
        </Link>
      ))}
    </nav>
  );
}
