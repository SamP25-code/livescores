import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import PublicFooter from "@/components/PublicFooter";

export default function NotFound() {
  return (
    <div className="page page-photo">
      <div className="public-background" aria-hidden="true" />
      <SiteHeader compact />
      <h1 className="public-page-title">Page not found</h1>
      <p className="quiet-line">That link doesn&rsquo;t lead anywhere &ndash; it may have moved, or been mistyped.</p>
      <p>
        <Link href="/" className="button">
          Go to the home page
        </Link>
      </p>
      <PublicFooter />
    </div>
  );
}
