export default function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span className={`avatar ${size === "sm" ? "avatar-sm" : ""}`} style={{ background: `hsl(${hashHue(name)}, 32%, 34%)` }}>
      {getInitials(name)}
    </span>
  );
}

// Name endings that aren't a surname, so "Alan Hodson snr" is AH, not AS.
const SUFFIXES = new Set(["snr", "sr", "senior", "jnr", "jr", "junior", "ii", "iii", "iv"]);

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const isSuffix = (w: string) => SUFFIXES.has(w.toLowerCase().replace(/[^a-z]/g, ""));
  // Never strip a word that's the whole name.
  const parts = words.length > 1 ? words.filter((w, i) => i === 0 || !isSuffix(w)) : words;
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
