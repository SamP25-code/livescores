export default function Brand({ suffix, compact }: { suffix?: string; compact?: boolean }) {
  if (compact) {
    return (
      <span className="brand brand-compact">
        <img src="/verve-wills-logo.png" alt="Verve Wills & Estate Planning" className="sponsor-logo sponsor-logo-sm" />
        <span className="brand-compact-text">Penwortham Sports &amp; Social Club</span>
        {suffix}
      </span>
    );
  }

  return (
    <span className="brand">
      <img src="/verve-wills-logo.png" alt="Verve Wills & Estate Planning" className="sponsor-logo" />
      Penwortham Sports &amp; Social Club
      <br />
      <span className="brand-tagline">October singles kindly sponsored by</span>
      <br />
      <a href="https://vervewills.co.uk/" target="_blank" rel="noopener noreferrer">
        Verve Wills and Estate Planning
      </a>
      {suffix}
    </span>
  );
}
