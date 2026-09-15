export default function Brand({ suffix }: { suffix?: string }) {
  return (
    <span className="brand">
      Penwortham Sports & Social Club October singles kindly sponsored by{" "}
      <a href="https://vervewills.co.uk/" target="_blank" rel="noopener noreferrer">
        Verve Wills and Estate Planning
      </a>
      {suffix}
    </span>
  );
}
