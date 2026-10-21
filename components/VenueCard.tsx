import { directionsUrl } from "@/lib/venues";
import type { Venue } from "@/lib/types";

// Where it's played, as a row like the sessions above it: the name and
// address, and the whole row opens Google Maps for directions
export default function VenueCard({ venue, spaced = false }: { venue: Venue; spaced?: boolean }) {
  const address = [venue.address, venue.postcode].filter(Boolean).join(" ");
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
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z M12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z"
            />
          </svg>
          Map
        </span>
      </a>
    </div>
  );
}
