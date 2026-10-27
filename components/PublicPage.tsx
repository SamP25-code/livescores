"use client";

import { useEffect, type ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";
import PublicFooter from "@/components/PublicFooter";

// The frame of every public page: the header with the menu (☰) and Back,
// the page's title (or, without one, the page's own heading), the
// loading / problem line, then its content and the footer
export default function PublicPage({
  title,
  intro,
  loading,
  failed,
  back,
  children,
}: {
  title?: string;
  intro?: string;
  loading: boolean;
  failed: boolean;
  back?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (title) document.title = `${title} · ${SITE_NAME}`;
  }, [title]);
  return (
    <div className="page page-photo">
      <div className="public-background" aria-hidden="true" />
      <SiteHeader compact back={back} />
      {title && <h1 className="public-page-title">{title}</h1>}
      {intro && <p className="public-page-intro">{intro}</p>}
      {failed && <p className="quiet-line">Couldn&rsquo;t load &ndash; check your signal and refresh</p>}
      {loading && !failed && <p className="quiet-line">Loading&hellip;</p>}
      {children}
      <PublicFooter />
    </div>
  );
}
