"use client";

import { useEffect, useState } from "react";
import CompetitionRow from "@/components/home/CompetitionRow";
import { searchPeople } from "@/lib/peopleApi";
import { monthYear, type PersonDetails } from "@/lib/people";
import PublicPage from "@/components/PublicPage";

// Find a player: type a name and everyone who matches shows, narrowing as
// more letters go in - each with their club and when they last played, so
// two John Smiths can be told apart
export default function PlayersPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonDetails[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    // A moment's pause, so it doesn't search on every letter
    const t = setTimeout(() => {
      searchPeople(query)
        .then((r) => {
          if (!cancelled) {
            setResults(r);
            setFailed(false);
          }
        })
        .catch(() => !cancelled && setFailed(true));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <PublicPage title="Find a player" loading={false} failed={failed}>
      <input
        type="search"
        className="home-search"
        placeholder="Type a name"
        aria-label="Type a player's name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results !== null && results.length === 0 && <p className="quiet-line">Nothing matches &ldquo;{query.trim()}&rdquo;</p>}
      {results !== null && results.length > 0 && (
        <div className="card home-rows">
          {results.map((p) => (
            <CompetitionRow
              key={p.id}
              date={false}
              title={p.full_name}
              href={`/player/${p.id}`}
              line={[p.note, p.club_name, p.last_played ? `last played ${monthYear(p.last_played)}` : null].filter(Boolean).join(" · ")}
            />
          ))}
        </div>
      )}
    </PublicPage>
  );
}
