import Link from "next/link";

export default function Brand({ homeLink }: { homeLink?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-top-row">
        <span className="brand-name">Penwortham Sports &amp; Social Club</span>
        {homeLink && (
          <Link href="/" className="brand-home-link">
            Home
          </Link>
        )}
      </div>
      <hr className="brand-divider" />
      <p className="brand-caption">October singles sponsored by</p>
      <a href="https://vervewills.co.uk/" target="_blank" rel="noopener noreferrer" className="brand-logo-link">
        <img src="/verve-wills-logo.png" alt="Verve Wills and Estate Planning" className="sponsor-logo" />
      </a>
    </div>
  );
}
