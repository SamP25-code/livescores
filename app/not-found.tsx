import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <div className="top-bar">
        <Link href="/" className="brand">
          Bowls Live
        </Link>
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
