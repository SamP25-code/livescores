"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Venues are part of Clubs now - an old link lands there
export default function VenuesMoved() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/clubs");
  }, [router]);
  return null;
}
