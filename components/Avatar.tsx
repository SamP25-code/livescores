/**
 * A small colored circle with someone's initials. The color is derived from
 * their name, so the same person looks the same everywhere - rosters, match
 * cards, the finals board - making every list easier to scan at a glance.
 */
export default function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span className={`avatar ${size === "sm" ? "avatar-sm" : ""}`} style={{ background: `hsl(${hashHue(name)}, 40%, 32%)` }}>
      {getInitials(name)}
    </span>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Same name always maps to the same hue, so it stays consistent across the site. */
function hashHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
