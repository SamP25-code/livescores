// "Live", the one status shown as a pill - everything else is just words
export default function LivePill() {
  return (
    <span className="comp-pill comp-pill-live">
      <span className="live-dot" />
      Live
    </span>
  );
}
