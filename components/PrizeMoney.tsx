import { pounds, type Prize } from "@/lib/prizes";

// A competition's prize money on its page: each place and its amount, then
// anything else about it. Nothing at all until Super has added some.
export default function PrizeMoney({ prizes, note }: { prizes?: Prize[] | null; note?: string | null }) {
  if (!prizes?.length && !note) return null;
  return (
    <section className="card prize-money">
      <h2>Prize money</h2>
      {prizes && prizes.length > 0 && (
        <dl className="prize-money-list">
          {prizes.map((p, i) => (
            <div key={i} className="prize-money-row">
              <dt>{p.place}</dt>
              <dd>{pounds(p.amount)}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && <p className="hint">{note}</p>}
    </section>
  );
}
