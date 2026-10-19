"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsSuper } from "@/lib/auth";
import CompetitionForm from "@/components/CompetitionForm";
import { SITE_NAME } from "@/lib/site";

export default function NewCompetitionPage() {
  const router = useRouter();
  const isSuper = useIsSuper();

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
      {isSuper && <CompetitionForm onSaved={(id) => router.replace(`/admin/competitions/${id}`)} />}
    </div>
  );
}
