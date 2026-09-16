import Link from "next/link";
import Brand from "@/components/Brand";

export default function NotFound() {
  return (
    <div className="page page-photo">
      <div className="public-background" aria-hidden="true" />
      <div className="top-bar">
        <Brand />
        <nav>
          <Link href="/">Home</Link>
        </nav>
      </div>

      <div className="home-hero">
        <h1>Page not found</h1>
        <p className="hint">That link doesn&rsquo;t lead anywhere &mdash; maybe it&rsquo;s been moved or mistyped.</p>
      </div>

      <p style={{ textAlign: "center" }}>
        <Link href="/" className="button">
          Back to results
        </Link>
      </p>
    </div>
  );
}
