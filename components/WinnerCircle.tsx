"use client";

import { useEffect, useRef, useState } from "react";

const CIRCLE_PATH = "M10 26 C 7 12, 30 5, 48 9 C 61 13, 60 36, 40 41 C 22 45, 5 38, 5 26 C 5 17, 16 11, 29 10";

// A hand-marked ring around the winner's score, like a pen circle on a
// paper draw sheet - not a perfect CSS ring. The rotation is derived from
// the match id rather than randomised, so it stays the same between
// refreshes instead of jumping around.
function hashRotation(matchId: string): number {
  let hash = 0;
  for (let i = 0; i < matchId.length; i++) {
    hash = (hash * 31 + matchId.charCodeAt(i)) >>> 0;
  }
  return (hash % 17) - 8;
}

export default function WinnerCircle({ matchId, active }: { matchId: string; active: boolean }) {
  const wasActive = useRef(active);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (active && !wasActive.current) setJustCompleted(true);
    wasActive.current = active;
  }, [active]);

  if (!active) return null;

  return (
    <svg
      className={`winner-circle ${justCompleted ? "winner-circle-animate" : ""}`}
      viewBox="0 0 64 48"
      preserveAspectRatio="none"
      style={{ transform: `rotate(${hashRotation(matchId)}deg)` }}
      aria-hidden="true"
    >
      <path d={CIRCLE_PATH} />
    </svg>
  );
}
