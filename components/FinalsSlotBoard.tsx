"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Player } from "@/lib/types";

/**
 * Drag-and-drop board for assigning finals-day draw numbers: drag a player
 * chip onto one of the 16 numbered slots, or back down to "Not yet placed"
 * to clear their number. Used both on finals day itself (managing every
 * seat) and on a qualifying night (managing just that night's own
 * qualifiers against the shared finals-day lineup - other nights' occupants
 * show up read-only, for context, since this board can't move them).
 */
export default function FinalsSlotBoard({
  slots,
  pool,
  currentSeedOf,
  occupantIdentity = (p) => p.id,
  onAssign,
}: {
  slots: Array<Player | null>;
  pool: Player[];
  currentSeedOf: (player: Player) => number | null;
  /**
   * How to read a slot occupant's identity for matching against `pool`.
   * Defaults to the occupant's own id, which is correct when `pool` and
   * `slots` are drawn from the same table (finals day managing its own
   * players). On a qualifying night, `slots` comes from finals day's player
   * rows while `pool` is this night's own rows for the same people, so the
   * two only line up via `qualified_from_player_id`.
   */
  occupantIdentity?: (occupant: Player) => string;
  onAssign: (player: Player, seed: number | null) => Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const poolById = new Map(pool.map((p) => [p.id, p]));
  const unplaced = pool.filter((p) => currentSeedOf(p) == null);
  const activePlayer = activeId ? poolById.get(activeId) ?? null : null;

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const player = poolById.get(String(active.id));
    if (!player) return;

    if (over.id === "slot-unplaced") {
      if (currentSeedOf(player) != null) await onAssign(player, null);
      return;
    }

    const seed = Number(String(over.id).replace("slot-", ""));
    if (currentSeedOf(player) === seed) return;
    // Seeds are unique per night, so if someone's here, it can only be someone else.
    const occupant = slots[seed - 1];
    if (occupant && !confirm(`${occupant.name} is currently #${seed}. Move ${player.name} there instead?`)) {
      return;
    }
    await onAssign(player, seed);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
      onDragEnd={handleDragEnd}
    >
      <div className="finals-board">
        {slots.map((occupant, i) => {
          const seed = i + 1;
          const poolPlayer = occupant ? poolById.get(occupantIdentity(occupant)) : undefined;
          return (
            <SlotTarget key={seed} seed={seed}>
              {occupant ? (
                poolPlayer ? (
                  <DraggableChip player={poolPlayer} />
                ) : (
                  <span className="finals-chip finals-chip-readonly">{occupant.name}</span>
                )
              ) : (
                <span className="finals-chip-empty">Drop here</span>
              )}
            </SlotTarget>
          );
        })}
      </div>

      {unplaced.length > 0 && (
        <UnplacedZone>
          {unplaced.map((p) => (
            <DraggableChip key={p.id} player={p} />
          ))}
        </UnplacedZone>
      )}

      <DragOverlay>
        {activePlayer ? <span className="finals-chip finals-chip-overlay">{activePlayer.name}</span> : null}
      </DragOverlay>
    </DndContext>
  );
}

function SlotTarget({ seed, children }: { seed: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${seed}` });
  return (
    <div ref={setNodeRef} className={`finals-slot ${isOver ? "drag-over" : ""}`}>
      <span className="finals-slot-number">{seed}</span>
      {children}
    </div>
  );
}

function UnplacedZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "slot-unplaced" });
  return (
    <div ref={setNodeRef} className={`finals-unplaced ${isOver ? "drag-over" : ""}`}>
      <span className="finals-slot-number">Not yet placed</span>
      <div className="finals-unplaced-chips">{children}</div>
    </div>
  );
}

function DraggableChip({ player }: { player: Player }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: player.id });
  return (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`finals-chip ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      {player.name}
    </span>
  );
}
