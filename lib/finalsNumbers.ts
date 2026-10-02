// The choices for one player's finals draw number: every number 1-16, each
// labelled with whoever else already has it, so the admin can see at a
// glance which numbers are free without a separate board.
export type FinalsNumberOption = { number: number; takenBy: string | null };

export function finalsNumberOptions<T extends { name: string }>(
  slots: Array<T | null>,
  playerId: string,
  occupantIdentity: (occupant: T) => string
): FinalsNumberOption[] {
  return slots.map((occupant, i) => ({
    number: i + 1,
    takenBy: occupant && occupantIdentity(occupant) !== playerId ? occupant.name : null,
  }));
}
