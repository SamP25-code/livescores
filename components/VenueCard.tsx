import { directionsUrl } from "@/lib/venues";
import type { Venue } from "@/lib/types";

// Where it's played: a slim strip with the name and address, and a small
// Directions button that opens Google Maps
export default function VenueCard({ venue }: { venue: Venue }) {
  return (
    <section className="card venue-card">
      <span className="venue-card-text">
        <strong>{venue.name}</strong>
        {(venue.address || venue.postcode) && (
          <span className="venue-card-address">{[venue.address, venue.postcode].filter(Boolean).join(" ")}</span>
        )}
        {venue.notes && <span className="hint">{venue.notes}</span>}
      </span>
      <a className="venue-card-directions" href={directionsUrl(venue)} target="_blank" rel="noopener noreferrer">
        Directions
      </a>
    </section>
  );
}
