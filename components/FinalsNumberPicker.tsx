"use client";

import { useState } from "react";
import { finalsNumberOptions } from "@/lib/finalsNumbers";
import type { Player } from "@/lib/types";

// One row per player with a number picker beside their name - pick the
// number they drew and it saves straight away. Numbers someone else already
// has are labelled with their name; picking one asks before moving them.
export default function FinalsNumberPicker({
  slots,
  pool,
  currentSeedOf,
  occupantIdentity = (p) => p.id,
  onAssign,
}: {
  slots: Array<Player | null>;
  pool: Player[];
  currentSeedOf: (player: Player) => number | null;
  occupantIdentity?: (occupant: Player) => string;
  onAssign: (player: Player, seed: number | null) => Promise<void>;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);

  async function choose(player: Player, value: string) {
    const seed = value === "" ? null : Number(value);
    if (seed === currentSeedOf(player)) return;
    if (seed != null) {
      const occupant = slots[seed - 1];
      if (
        occupant &&
        occupantIdentity(occupant) !== player.id &&
        !confirm(`${occupant.name} is currently #${seed}. Give ${player.name} #${seed} instead?`)
      ) {
        return;
      }
    }
    setSavingId(player.id);
    try {
      await onAssign(player, seed);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="finals-picker">
      {pool.map((player) => {
        const current = currentSeedOf(player);
        const options = finalsNumberOptions(slots, player.id, occupantIdentity);
        return (
          <label key={player.id} className={`finals-picker-row ${current == null ? "finals-picker-unset" : ""}`}>
            <span className="finals-picker-name">{player.name}</span>
            <select
              value={current ?? ""}
              disabled={savingId === player.id}
              onChange={(e) => choose(player, e.target.value)}
              aria-label={`Finals number for ${player.name}`}
            >
              <option value="">No number</option>
              {options.map((o) => (
                <option key={o.number} value={o.number}>
                  {o.takenBy ? `${o.number} – ${o.takenBy}` : o.number}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
