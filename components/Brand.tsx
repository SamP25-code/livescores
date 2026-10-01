const SPONSOR_URL = "https://vervewills.co.uk/";

// "full" is the stacked club name + sponsor logo card. "sponsor" is the same
// without the club name, for the home page where the club name already
// heads the page. "slim" is a single line for the night pages, where the
// scores need the space - the full logo's wordmark is unreadable that
// small, so it uses just the leaf mark with the sponsor's name written out.
export default function Brand({ variant = "full" }: { variant?: "full" | "sponsor" | "slim" }) {
  if (variant === "slim") {
    return (
      <a href={SPONSOR_URL} target="_blank" rel="noopener noreferrer" className="sponsor-strip">
        <img src="/verve-wills-leaf.png" alt="" className="sponsor-strip-leaf" />
        <span>
          Sponsored by <strong>Verve Wills &amp; Estate Planning</strong>
        </span>
      </a>
    );
  }

  return (
    <div className="brand">
      {variant === "full" && (
        <>
          <p className="brand-name">Penwortham Sports &amp; Social Club</p>
          <hr className="brand-divider" />
        </>
      )}
      <p className="brand-caption">October singles sponsored by</p>
      <a href={SPONSOR_URL} target="_blank" rel="noopener noreferrer" className="brand-logo-link">
        <img src="/verve-wills-logo.png" alt="Verve Wills and Estate Planning" className="sponsor-logo" />
      </a>
    </div>
  );
}
