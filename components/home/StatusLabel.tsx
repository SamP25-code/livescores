import { STATUS_LABEL, type PublicStatus } from "@/lib/publicCompetitions";
import LivePill from "@/components/home/LivePill";

// Live gets a pill - it's the one that matters - everything else is just words
export default function StatusLabel({ status }: { status: PublicStatus }) {
  if (status === "live") {
    return (
      <LivePill />
    );
  }
  return <span className={`comp-status comp-status-${status}`}>{STATUS_LABEL[status]}</span>;
}
