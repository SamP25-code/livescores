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

// The slim line at the top of a session page, where the scores need the room:
// a small logo and the name written out (a full logo's wording is too small
// to read at this size)
export function SponsorStrip({ sponsors }: { sponsors: SponsorShown[] }) {
  if (sponsors.length === 0) return null;
  return (
    <div className="sponsor-strip sponsor-strip-list">
      <span>Sponsored by</span>
      {sponsors.map((s, i) => (
        <Linked key={s.name} sponsor={s} className="sponsor-strip-item">
          <strong>{s.name}</strong>
          {i < sponsors.length - 1 && <span aria-hidden="true">{i === sponsors.length - 2 ? " and" : ","}</span>}
        </Linked>
      ))}
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
