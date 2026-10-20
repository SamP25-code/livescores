"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsSuper } from "@/lib/auth";
import CompetitionForm from "@/components/CompetitionForm";
import { SITE_NAME } from "@/lib/site";

export default function NewCompetitionPage() {
  const router = useRouter();
  const isSuper = useIsSuper();
  // ?event=<id>: adding another competition to that event
  const [presetEvent, setPresetEvent] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setPresetEvent(new URLSearchParams(window.location.search).get("event"));
  }, []);

  useEffect(() => {
    document.title = `New competition · Admin · ${SITE_NAME}`;
  }, []);

  return (
    <div className="page page-photo">
      <Link href="/admin/competitions" className="page-back-link">
        <span aria-hidden="true">&lsaquo;</span> Competitions
      </Link>
      <h1>New competition</h1>
      {isSuper === false && <p className="hint">Only Sam (Super) can set up competitions.</p>}
      {isSuper && presetEvent !== undefined && (
        <CompetitionForm
          presetOrganiserId={presetEvent ?? undefined}
          onSaved={(id) => router.replace(`/admin/competitions/${id}`)}
        />
      )}
    </div>
  );
}
