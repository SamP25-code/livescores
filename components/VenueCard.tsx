import { directionsUrl } from "@/lib/venues";
import type { Venue } from "@/lib/types";

const PIN = (size: number) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z M12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z"
    />
  </svg>
);

// Where it's played, as a row like the sessions above it: the name and
// address, and the whole row opens Google Maps for directions. `slim` is a
// small pill for the foot of a competition or session page - just the name
// and postcode, out of the way.
export default function VenueCard({ venue, spaced = false, slim = false }: { venue: Venue; spaced?: boolean; slim?: boolean }) {
  const address = [venue.address, venue.postcode].filter(Boolean).join(" ");
  if (slim) {
    return (
      <a
        className="venue-pill"
        href={directionsUrl(venue)}
        target="_blank"
        rel="noopener noreferrer"
        title={[address, venue.notes].filter(Boolean).join(" · ") || undefined}
      >
        {PIN(14)}
        <span className="venue-pill-name">{venue.name}</span>
        {venue.postcode && <span className="venue-pill-postcode">{venue.postcode}</span>}
        <span className="venue-pill-map">Map</span>
      </a>
    );
  }
  return (
    <div className={`card comp-schedule ${spaced ? "venue-spaced" : ""}`}>
      <a className="comp-schedule-row" href={directionsUrl(venue)} target="_blank" rel="noopener noreferrer">
        <span className="comp-schedule-main">
          <span className="comp-schedule-line">
            <strong>{venue.name}</strong>
            {address && <> &middot; {address}</>}
          </span>
          {venue.notes && <span className="comp-schedule-was">{venue.notes}</span>}
        </span>
        <span className="venue-row-map">
          {PIN(18)}
          Map
        </span>
      </a>
    </div>
  );
}
