// Venues and postponements as people see them: where it's played, how to
// get there, and when a session has been rained off.
import { longDate } from "@/lib/competitionSetup";

type VenueLike = {
  name: string;
  address: string | null;
  postcode: string | null;
  map_url?: string | null;
};

// "Get directions": the pasted maps link if there is one, otherwise Google
// Maps searching the venue's name and address (opens the Maps app on a phone)
export function directionsUrl(v: VenueLike): string {
  if (v.map_url) return v.map_url;
  const query = [v.name, v.address, v.postcode].filter((s) => s && s.trim()).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// A pasted maps link, tidied, or a reason it won't do. Empty is fine.
export function checkMapUrl(input: string): { url: string | null; problem: string | null } {
  const value = input.trim();
  if (!value) return { url: null, problem: null };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { url: null, problem: "That doesn't look like a link - copy it from the Share button in Google Maps." };
  }
  if (parsed.protocol !== "https:") {
    return { url: null, problem: "The maps link should start with https://" };
  }
  return { url: parsed.toString(), problem: null };
}

// "Penwortham Sports & Social Club, Hill Road, Penwortham PR1 9XH"
export function venueAddressLine(v: VenueLike): string {
  const address = [v.address, v.postcode].filter((s) => s && s.trim()).join(" ");
  return address ? `${v.name}, ${address}` : v.name;
}

type SessionLike = {
  postponed?: boolean;
  postponed_reason?: string | null;
  date?: string | null;
  original_date?: string | null;
};

// "Rained off - now Thursday 10th June", "Postponed - new date to be
// confirmed"; null if it isn't postponed
export function postponedLabel(s: SessionLike): string | null {
  if (!s.postponed) return null;
  const reason = s.postponed_reason?.trim() || "Postponed";
  return s.date ? `${reason} - now ${longDate(s.date)}` : `${reason} - new date to be confirmed`;
}

// "Was Monday 7th June"
export function originalDateLabel(s: SessionLike): string | null {
  return s.postponed && s.original_date ? `Was ${longDate(s.original_date)}` : null;
}
