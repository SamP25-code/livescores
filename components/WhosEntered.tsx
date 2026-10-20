"use client";

import { useState } from "react";
import PlayerName from "@/components/PlayerName";
import { loadEnteredNames, type EnteredName } from "@/lib/publicData";
import { sessionTitle, type PublicCompetition } from "@/lib/publicCompetitions";

// "32 pairs entered · See who's entered" on a competition's page. The names
// are only fetched when asked for. Qualifying competitions list them by
// session.
export default function WhosEntered({ competition: c }: { competition: PublicCompetition }) {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<EnteredName[] | null>(null);
  const [failed, setFailed] = useState(false);
  if (c.entryCount === 0) return null;
  const noun = c.team_size === 2 ? (c.entryCount === 1 ? "pair" : "pairs") : c.entryCount === 1 ? "player" : "players";

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && names === null) {
      try {
        setNames(await loadEnteredNames(c.id));
      } catch {
        setFailed(true);
      }
    }
  }

  const qualifying = c.sessions.filter((s) => s.kind === "qualifier");
  const groups =
    names && qualifying.length > 0
      ? [
          ...qualifying.map((s) => ({ title: sessionTitle(s), list: names.filter((n) => n.sessionId === s.id) })),
          { title: "Session to be confirmed", list: names.filter((n) => !qualifying.some((s) => s.id === n.sessionId)) },
        ].filter((g) => g.list.length > 0)
      : names
        ? [{ title: null, list: names }]
        : [];

  return (
    <section className="card whos-entered">
      <div className="whos-entered-head">
        <strong>
          {c.entryCount} {noun} entered
        </strong>
        <button type="button" className="link-button" aria-expanded={open} onClick={toggle}>
          {open ? "Hide" : "See who’s entered"}
        </button>
      </div>
      {open && failed && <p className="hint">Couldn&rsquo;t load the names - try again in a moment.</p>}
      {open && !failed && names === null && <p className="hint">Loading&hellip;</p>}
      {open &&
        groups.map((g, i) => (
          <div key={i} className="whos-entered-group">
            {g.title && <h3>{g.title}</h3>}
            <ul>
              {g.list.map((n, j) => (
                <li key={j}>
                  <PlayerName name={n.name} />
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}
