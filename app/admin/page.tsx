"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAccess } from "@/lib/access";
import { SITE_NAME } from "@/lib/site";
import YourCompetitions from "@/components/admin/YourCompetitions";
import type { Night } from "@/lib/types";

// The admin home page: a card for each competition you look after, with
// what's next and the job at hand. Any sessions from before competitions
// existed (none on a database that's had the 2027 steps) are listed below.
export default function AdminDashboard() {
  const access = useAccess();
  const [olderNights, setOlderNights] = useState<Night[]>([]);

  useEffect(() => {
    document.title = `Admin · ${SITE_NAME}`;
  }, []);

  useEffect(() => {
    if (!access?.isSuper) return;
    supabase
      .from("nights")
      .select("*")
      .is("competition_id", null)
      .order("created_at", { ascending: true })
      .then(({ data }) => setOlderNights((data ?? []) as Night[]));
  }, [access?.isSuper]);

  return (
    <div className="page page-photo">
      {access && <YourCompetitions access={access} />}
      {olderNights.length > 0 && (
        <section className="home-section">
          <h2>Older sessions</h2>
          <div className="card comp-list">
            {olderNights.map((night) => (
              <Link key={night.id} href={`/admin/night/${night.id}`} className="comp-list-row">
                <span className="comp-list-main">
                  <strong>{night.name}</strong>
                </span>
                <span className="comp-list-open">Open</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
