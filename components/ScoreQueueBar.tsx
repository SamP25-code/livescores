"use client";

import { useEffect, useState } from "react";
import { dismissConflict, flush, type Conflict } from "@/lib/scoreSync";

// A strip that stays in view while scoring: how many scores are waiting to
// send, whether there's no signal, a brief "All sent", and any match changed
// on another phone that needs checking.
export default function ScoreQueueBar({
  waiting,
  offline,
  allSentAt,
  conflicts,
  matchName,
}: {
  waiting: number;
  offline: boolean;
  allSentAt: number | null;
  conflicts: Conflict[];
  // "Wayne Ditchfield v Lee Hanson", for the conflict messages
  matchName: (matchId: string) => string;
}) {
  const [showSent, setShowSent] = useState(false);

  useEffect(() => {
    if (!allSentAt || Date.now() - allSentAt > 4000) return;
    setShowSent(true);
    const timer = setTimeout(() => setShowSent(false), 3000);
    return () => clearTimeout(timer);
  }, [allSentAt]);

  if (waiting === 0 && !showSent && conflicts.length === 0) return null;

  return (
    <div className="score-queue" role="status" aria-live="polite">
      {waiting > 0 && (
        <div className={`score-queue-line ${offline ? "score-queue-offline" : ""}`}>
          <span>
            {offline
              ? `No signal - ${waiting} score${waiting === 1 ? " is" : "s are"} saved on this phone and will send`
              : `${waiting} score${waiting === 1 ? "" : "s"} waiting to send…`}
          </span>
          {offline && (
            <button type="button" className="link-button" onClick={() => flush()}>
              Try now
            </button>
          )}
        </div>
      )}
      {waiting === 0 && showSent && <div className="score-queue-line score-queue-sent">All scores sent</div>}
      {conflicts.map((c) => (
        <div key={c.matchId} className="score-queue-line score-queue-conflict">
          <span>
            <strong>{matchName(c.matchId)}:</strong> {c.message}
          </span>
          <button type="button" className="link-button" onClick={() => dismissConflict(c.matchId)}>
            OK
          </button>
        </div>
      ))}
    </div>
  );
}
