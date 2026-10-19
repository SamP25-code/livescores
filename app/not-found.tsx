import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export default function NotFound() {
  return (
    <div className="page page-photo">
      <div className="public-background" aria-hidden="true" />
      <Link href="/" className="page-back-link">
        <span aria-hidden="true">&lsaquo;</span> Home
      </Link>
      <header className="home-header">
        <p className="home-title">{SITE_NAME}</p>
        <p className="home-tagline">{SITE_TAGLINE}</p>
      </header>

      <div className="home-hero">
        <h1>Page not found</h1>
        <p className="hint">That link doesn&rsquo;t lead anywhere, maybe it&rsquo;s been moved or mistyped.</p>
      </div>

      <p style={{ textAlign: "center" }}>
        <Link href="/" className="button">
          Back to results
        </Link>
      </p>
    </div>
  );
}
