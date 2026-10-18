import { nameLines } from "@/lib/sessionEntries";

// A player's name, or a pair one name per line so both fit on a phone:
//   Wayne Ditchfield &
//   Lee Hanson
export default function PlayerName({ name, className = "name" }: { name: string; className?: string }) {
  const lines = nameLines(name);
  if (lines.length === 1) return <span className={className}>{name}</span>;
  return (
    <span className={`${className} name-pair`} aria-label={name}>
      <span>{lines[0]} &amp;</span>
      <span>{lines[1]}</span>
    </span>
  );
}
