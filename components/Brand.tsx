export default function Brand({ suffix }: { suffix?: string }) {
  return (
    <span className="brand">
      <img src="/verve-wills-logo.png" alt="Verve Wills & Estate Planning" className="sponsor-logo" />
      Penwortham Sports & Social Club October singles kindly sponsored by{" "}
      <a href="https://vervewills.co.uk/" target="_blank" rel="noopener noreferrer">
        Verve Wills and Estate Planning
      </a>
      {suffix}
    </span>
  );
}
