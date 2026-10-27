// What's left to set up for a competition, shown at the top of its admin
// page: each item done or not, and the tab that fixes it.

export type ChecklistItem = {
  label: string;
  detail: string;
  done: boolean;
  tab: "settings" | "entries" | "people" | "qualifying";
};

export function setupChecklist({
  sessions,
  venueId,
  movesBetweenClubs,
  entered,
  capacity,
  admins,
  qualification,
  qualifyingPlaces,
}: {
  sessions: { date?: string | null; venue_id?: string | null }[];
  venueId: string | null;
  // A county competition: each session has its own venue
  movesBetweenClubs: boolean;
  entered: number;
  capacity: number | null;
  admins: number;
  qualification: boolean;
  qualifyingPlaces: number;
}): ChecklistItem[] {
  const dated = sessions.filter((s) => s.date).length;
  const placed = sessions.filter((s) => s.venue_id).length;
  const items: ChecklistItem[] = [
    {
      label: "Dates",
      detail: sessions.length === 0 ? "No sessions yet" : dated === sessions.length ? "All set" : `${dated} of ${sessions.length} set`,
      done: sessions.length > 0 && dated === sessions.length,
      tab: "settings",
    },
    movesBetweenClubs
      ? {
          label: "Where it's played",
          detail: placed === sessions.length && sessions.length > 0 ? "Every session" : `${placed} of ${sessions.length} sessions`,
          done: sessions.length > 0 && placed === sessions.length,
          tab: "settings",
        }
      : { label: "Where it's played", detail: venueId ? "Set" : "Not set yet", done: Boolean(venueId), tab: "settings" },
  ];
  if (qualification) {
    items.push({
      label: "Qualifying competitions",
      detail: qualifyingPlaces === 0 ? "None added yet" : `${qualifyingPlaces} place${qualifyingPlaces === 1 ? "" : "s"} added`,
      done: qualifyingPlaces > 0,
      tab: "qualifying",
    });
  } else {
    items.push({
      label: "Entries",
      detail: capacity ? `${entered} of ${capacity}` : `${entered} entered`,
      done: capacity ? entered >= capacity : entered > 0,
      tab: "entries",
    });
  }
  items.push({
    label: "Admin",
    detail: admins === 0 ? "Nobody assigned yet" : `${admins} assigned`,
    done: admins > 0,
    tab: "people",
  });
  return items;
}
