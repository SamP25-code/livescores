export default function Brand({ suffix }: { suffix?: string }) {
  return (
    <span className="brand">
      <img src="/verve-wills-logo.png" alt="Verve Wills & Estate Planning" className="sponsor-logo" />
      <span className="brand-text">
        <span className="brand-name">Penwortham Sports &amp; Social Club</span>
        <span className="brand-tagline">
          October singles kindly sponsored by{" "}
          <a href="https://vervewills.co.uk/" target="_blank" rel="noopener noreferrer">
            Verve Wills and Estate Planning
          </a>
        </span>
      </span>
      {suffix}
    </span>
  );
}
