"use client";

import { useSiteBackground } from "@/lib/backgrounds";

// Puts the site's general background (chosen in admin) behind every page
export default function SiteBackground() {
  useSiteBackground();
  return null;
}
