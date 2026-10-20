"use client";

import { useEffect, type ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";
import PublicFooter from "@/components/PublicFooter";

// The frame of the public pages reached from the menu: the header with the
// menu (☰), the page's title, then its content and the footer
export default function PublicPage({
  title,
  intro,
  loading,
  failed,
  children,
}: {
  title: string;
  intro?: string;
  loading: boolean;
  failed: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} · ${SITE_NAME}`;
  }, [title]);
  return (
    <div className="page page-photo home">
      <div className="public-background" aria-hidden="true" />
      <SiteHeader />
      <h1 className="public-page-title">{title}</h1>
      {intro && <p className="public-page-intro">{intro}</p>}
      {failed && <p className="night-header-hint">Having trouble loading this page? Check your connection and try refreshing.</p>}
      {loading && !failed && <p className="night-header-hint">Loading&hellip;</p>}
      {children}
      <PublicFooter line="Live scores for crown green competitions, free to follow." />
    </div>
  );
}
