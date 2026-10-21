import type { ReactNode } from "react";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// A list of competitions (or sessions) split by month, the same on every
// page: the month's name on the photo, then a box of its rows. Items keep
// the order they're given; any without a date go last, under "Dates to be
// confirmed".
export default function MonthGroups<T>({
  items,
  dateOf,
  render,
}: {
  items: T[];
  dateOf: (item: T) => string | null;
  render: (item: T) => ReactNode;
}) {
  const groups: { key: string; label: string; items: T[] }[] = [];
  const tbc: T[] = [];
  for (const item of items) {
    const date = dateOf(item);
    if (!date) {
      tbc.push(item);
      continue;
    }
    const key = date.slice(0, 7);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const [y, m] = key.split("-").map(Number);
      group = { key, label: `${MONTH_NAMES[m - 1]} ${y}`, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  if (tbc.length) groups.push({ key: "tbc", label: "Dates to be confirmed", items: tbc });

  return (
    <>
      {groups.map((g) => (
        <div key={g.key} className="home-month">
          <p className="home-month-label">{g.label}</p>
          <div className="card home-rows">{g.items.map(render)}</div>
        </div>
      ))}
    </>
  );
}
