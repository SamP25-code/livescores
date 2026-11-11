// A competition's sponsors, as entered in its settings: each name (or logo)
// links to their website when one was given.

export type SponsorShown = { name: string; url: string | null; logo_url: string | null };

function Linked({ sponsor, className, children }: { sponsor: SponsorShown; className?: string; children: React.ReactNode }) {
  return sponsor.url ? (
    <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <span className={className}>{children}</span>
  );
}

// A competition's or an event's sponsors, the same on every public page
// (competition, session and event pages) - change them here and in the
// .sponsor-panel styles and every page follows. Straight on the photo:
// "Sponsored by" small, then each sponsor's name in white, with its logo
// on a small white backing of its own when there is one (logos often have
// dark writing). "bare" (an event's page) shows just the logos, with no
// heading. "label" puts a heading on anyway ("Associate sponsor"), and
// "small" shows the logos smaller, under the main ones.
export function SponsorPanel({
  sponsors,
  bare = false,
  small = false,
  label,
}: {
  sponsors: SponsorShown[];
  bare?: boolean;
  small?: boolean;
  label?: string;
}) {
  if (sponsors.length === 0) return null;
  const heading = label ?? (bare ? null : "Sponsored by");
  return (
    <div className={["sponsor-panel", bare && "sponsor-panel-bare", small && "sponsor-panel-small"].filter(Boolean).join(" ")}>
      {heading && <span className="sponsor-panel-label">{heading}</span>}
      <div className="sponsor-panel-list">
        {sponsors.map((s) => (
          <Linked key={s.name} sponsor={s} className="sponsor-panel-item">
            {s.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo_url} alt={bare ? s.name : ""} className="sponsor-panel-logo" />
            )}
            {(!bare || !s.logo_url) && <strong>{s.name}</strong>}
          </Linked>
        ))}
      </div>
    </div>
  );
}
