import { STATUS_LABEL, type PublicStatus } from "@/lib/publicCompetitions";

// Live gets a pill - it's the one that matters - everything else is just words
export default function StatusLabel({ status }: { status: PublicStatus }) {
  if (status === "live") {
    return (
      <span className="comp-pill comp-pill-live">
        <span className="live-dot" />
        {STATUS_LABEL.live}
      </span>
    );
  }
  return <span className={`comp-status comp-status-${status}`}>{STATUS_LABEL[status]}</span>;
}
