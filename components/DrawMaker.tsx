"use client";

import { useState } from "react";
import { drawNumberProblems, drawSizeFor } from "@/lib/draw";
import PlayerName from "@/components/PlayerName";
import type { Player } from "@/lib/types";

export type DrawMethod = "random" | "physical";

// Making the draw by number, before it's confirmed:
//   - "Draw at random" gives everyone a number (byes spread so no two meet),
//     with "Redraw" until it's confirmed
//   - or record a physical draw: pick each entry's drawn number; numbers
//     nobody drew become byes
// Nothing shows publicly until the draw is confirmed and published.
export default function DrawMaker({
  players,
  onRandom,
  onSetNumber,
  onClear,
  onConfirm,
}: {
  players: Player[];
  onRandom: () => Promise<void>;
  onSetNumber: (player: Player, n: number | null) => Promise<void>;
  onClear: () => Promise<void>;
  onConfirm: (method: DrawMethod) => Promise<void>;
}) {
  // How the numbers were made, for the log: "random" after Draw at random,
  // "physical" once any number is picked by hand
  const [method, setMethod] = useState<DrawMethod>("physical");
  const [busy, setBusy] = useState(false);

  const active = players.filter((p) => !p.is_bye);
  const size = drawSizeFor(active.length);
  const numbered = active.some((p) => p.seed != null);
  const problems = drawNumberProblems(active.map((p) => p.seed));
  const byNumber = new Map(active.filter((p) => p.seed != null).map((p) => [p.seed!, p]));
  const undrawn = active.filter((p) => p.seed == null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  function numberPicker(p: Player) {
    return (
      <select
        aria-label={`Draw number for ${p.name}`}
        value={p.seed ?? ""}
        disabled={busy}
        onChange={(e) =>
          run(async () => {
            setMethod("physical");
            await onSetNumber(p, e.target.value ? Number(e.target.value) : null);
          })
        }
      >
        <option value="">No.</option>
        {Array.from({ length: size }, (_, i) => i + 1).map((n) => {
          const holder = byNumber.get(n);
          return (
            <option key={n} value={n} disabled={Boolean(holder && holder.id !== p.id)}>
              {n}
            </option>
          );
        })}
      </select>
    );
  }

  return (
    <section className="card draw-maker">
      <h2>Make the draw</h2>
      <p className="hint">
        Draw at random here, or record a physical draw by picking each number as it&rsquo;s drawn. Numbers nobody
        has are byes ({size - active.length} in a draw of {size}). Nothing shows publicly until you confirm and
        publish.
      </p>
      <div className="draw-maker-actions">
        <button
          type="button"
          disabled={busy || active.length < 2}
          onClick={() =>
            run(async () => {
              await onRandom();
              setMethod("random");
            })
          }
        >
          {numbered ? "Redraw at random" : "Draw at random"}
        </button>
        {numbered && (
          <button type="button" className="secondary" disabled={busy} onClick={() => run(onClear)}>
            Clear all numbers
          </button>
        )}
      </div>

      {numbered && (
        <div className="draw-maker-matches">
          {Array.from({ length: size / 2 }, (_, m) => {
            const a = byNumber.get(m * 2 + 1);
            const b = byNumber.get(m * 2 + 2);
            return (
              <div key={m} className="draw-maker-match">
                {[a, b].map((p, side) => (
                  <div key={side} className="draw-maker-place">
                    <span className="draw-number">{m * 2 + 1 + side}</span>
                    {p ? (
                      <>
                        <PlayerName name={p.name} />
                        {numberPicker(p)}
                      </>
                    ) : (
                      <span className="name draw-maker-bye">Bye</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {undrawn.length > 0 && (
        <>
          <h3 className="draw-maker-undrawn-title">{numbered ? "Still to be drawn" : "Record a physical draw"}</h3>
          <div className="draw-maker-undrawn">
            {undrawn.map((p) => (
              <div key={p.id} className="draw-maker-place">
                <PlayerName name={p.name} />
                {numberPicker(p)}
              </div>
            ))}
          </div>
        </>
      )}

      {numbered && problems.length > 0 && <p className="hint">{problems[0]}</p>}
      {numbered && (
        <button type="button" disabled={busy || problems.length > 0} onClick={() => run(() => onConfirm(method))}>
          Confirm the draw
        </button>
      )}
    </section>
  );
}
