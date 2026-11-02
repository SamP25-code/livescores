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

// At the top of a session page, under the competition's name: a light card
// like the October Singles' sponsor card - "Sponsored by", then each
// sponsor's name written out large and clear, with a small logo beside it
// when there is one (a full logo's wording is too small to read here)
export function SponsorStrip({ sponsors }: { sponsors: SponsorShown[] }) {
  if (sponsors.length === 0) return null;
  return (
    <div className="sponsor-card">
      <span className="sponsor-card-label">Sponsored by</span>
      <div className="sponsor-card-list">
        {sponsors.map((s) => (
          <Linked key={s.name} sponsor={s} className="sponsor-card-item">
            {s.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo_url} alt="" className="sponsor-card-logo" />
            )}
            <strong>{s.name}</strong>
          </Linked>
        ))}
      </div>
    </div>
  );
}

// On a competition's page: logos on a light panel (logos often have dark
// writing), or the names where there's no logo. "bare" (an event's page)
// shows just the logos on the page's photo, with no panel or heading.
export function SponsorPanel({ sponsors, bare = false }: { sponsors: SponsorShown[]; bare?: boolean }) {
  if (sponsors.length === 0) return null;
  return (
    <div className={bare ? "sponsor-panel sponsor-panel-bare" : "sponsor-panel"}>
      {!bare && <span className="sponsor-panel-label">Sponsored by</span>}
      <div className="sponsor-panel-list">
        {sponsors.map((s) => (
          <Linked key={s.name} sponsor={s} className="sponsor-panel-item">
            {s.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo_url} alt={s.name} className="sponsor-panel-logo" />
            ) : (
              <strong>{s.name}</strong>
            )}
          </Linked>
        ))}
      </div>
    </div>
  );
}
