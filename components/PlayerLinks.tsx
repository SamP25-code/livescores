import Link from "next/link";
import PlayerName from "@/components/PlayerName";
import { nameLines } from "@/lib/sessionEntries";

// A player's name (or a pair's) that opens their player page. Without the
// people behind it - a past year typed in by hand - it's just the name.
export default function PlayerLinks({ name, ids, className = "name" }: { name: string; ids?: (string | null)[]; className?: string }) {
  const people = (ids ?? []).filter((id): id is string => Boolean(id));
  if (people.length === 0) return <PlayerName name={name} className={className} />;
  const lines = nameLines(name);
  if (lines.length === 1) {
    return (
      <Link href={`/player/${people[0]}`} className={`${className} player-link`}>
        {name}
      </Link>
    );
  }
  return (
    <span className={`${className} name-pair`} aria-label={name}>
      <span>
        <Link href={`/player/${people[0]}`} className="player-link">
          {lines[0]}
        </Link>{" "}
        &amp;
      </span>
      <span>
        {people[1] ? (
          <Link href={`/player/${people[1]}`} className="player-link">
            {lines[1]}
          </Link>
        ) : (
          lines[1]
        )}
      </span>
    </span>
  );
}
