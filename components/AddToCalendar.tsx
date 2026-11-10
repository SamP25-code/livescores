// "Add to calendar": a small pill, like the venue's, that opens the
// competition's dates (or one session's) in the phone's own calendar
export default function AddToCalendar({
  competitionId,
  sessionId,
  label = "Add to calendar",
}: {
  competitionId: string;
  sessionId?: string;
  label?: string;
}) {
  const href = `/api/calendar/${competitionId}${sessionId ? `?session=${sessionId}` : ""}`;
  return (
    <a className="venue-pill calendar-pill" href={href}>
      <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 6.5h15v13h-15z M4.5 10.5h15 M8.5 4v4 M15.5 4v4 M12 13v4 M10 15h4"
        />
      </svg>
      <span className="venue-pill-map">{label}</span>
    </a>
  );
}
