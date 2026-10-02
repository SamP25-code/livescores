"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildViewerSeries,
  fetchViewerLog,
  peakOf,
  pointAt,
  type ViewerCount,
  type ViewerPoint,
} from "@/lib/viewerLog";

const REFRESH_MS = 60_000;

// The admin's look-back at how many people had a night's public page open,
// minute by minute. Refreshes itself every minute while it's on screen so
// it can be watched live on the night too.
export default function ViewerLog({ nightId }: { nightId: string }) {
  const [counts, setCounts] = useState<ViewerCount[] | null>(null);
  const [uniqueViewers, setUniqueViewers] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const log = await fetchViewerLog(nightId);
        if (cancelled) return;
        setCounts(log.counts);
        setUniqueViewers(log.uniqueViewers);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [nightId]);

  const series = useMemo(() => buildViewerSeries(counts ?? []), [counts]);

  return (
    <section className="card viewer-log">
      <h2>Viewers</h2>
      {failed && counts === null ? (
        <p className="hint">Couldn&rsquo;t load the viewer log. Try refreshing.</p>
      ) : counts === null ? (
        <p className="hint">Loading&hellip;</p>
      ) : (
        <ViewerLogChart series={series} uniqueViewers={uniqueViewers} />
      )}
    </section>
  );
}

export function ViewerLogChart({ series, uniqueViewers }: { series: ViewerPoint[]; uniqueViewers: number }) {
  // null = follow the latest minute as new data arrives; set once the admin
  // picks a time, so a refresh doesn't yank them away from it.
  const [chosenTime, setChosenTime] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  if (series.length === 0) {
    return (
      <p className="hint">
        No viewers logged yet. The log starts the first time someone opens this night&rsquo;s public page.
      </p>
    );
  }

  const first = series[0].time;
  const last = series[series.length - 1].time;
  const span = Math.max(last - first, 60_000);
  const selected = pointAt(series, chosenTime ?? last)!;
  const peak = peakOf(series)!;
  const yMax = Math.max(peak.viewers, 1);

  const xOf = (time: number) => ((time - first) / span) * 100;
  const yOf = (viewers: number) => 100 - (viewers / yMax) * 100;

  // Stepped, since a count holds for its whole minute.
  const line = series
    .map((p, i) => {
      const x = xOf(p.time);
      const y = yOf(p.viewers);
      if (i === 0) return `M ${x} ${y}`;
      return `H ${x} V ${y}`;
    })
    .join(" ");
  const area = `${line} V 100 H 0 Z`;

  function chooseFromPointer(clientX: number) {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const index = Math.round((ratio * span) / 60_000);
    setChosenTime(series[Math.min(series.length - 1, index)].time);
  }

  function handleKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 1;
    const index = series.indexOf(selected);
    if (e.key === "ArrowLeft") setChosenTime(series[Math.max(0, index - step)].time);
    else if (e.key === "ArrowRight") setChosenTime(series[Math.min(series.length - 1, index + step)].time);
    else return;
    e.preventDefault();
  }

  function handleTimeInput(value: string) {
    const [hours, minutes] = value.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
    const day = new Date(first);
    day.setHours(hours, minutes, 0, 0);
    setChosenTime(day.getTime());
  }

  const hourTicks: number[] = [];
  const tick = new Date(first);
  tick.setMinutes(0, 0, 0);
  for (tick.setHours(tick.getHours() + 1); tick.getTime() <= last; tick.setHours(tick.getHours() + 1)) {
    hourTicks.push(tick.getTime());
  }

  const fifteenMinuteRows = series.filter((p) => new Date(p.time).getMinutes() % 15 === 0);

  return (
    <>
      <div className="viewer-log-stats">
        <span>
          <strong>{peak.viewers}</strong> at peak ({formatTime(peak.time)})
        </span>
        <span>
          <strong>{uniqueViewers}</strong> {uniqueViewers === 1 ? "phone or browser" : "phones and browsers"} in all
        </span>
      </div>

      <div className="viewer-log-readout">
        <label htmlFor="viewer-log-time">At</label>
        <input
          id="viewer-log-time"
          type="time"
          value={formatTime(selected.time)}
          onChange={(e) => handleTimeInput(e.target.value)}
        />
        <span>
          <strong>{selected.viewers}</strong> watching
        </span>
        {chosenTime !== null && (
          <button type="button" className="link-button" onClick={() => setChosenTime(null)}>
            Latest
          </button>
        )}
      </div>

      <div
        ref={plotRef}
        className="viewer-log-plot"
        tabIndex={0}
        role="slider"
        aria-label="Time"
        aria-valuemin={first}
        aria-valuemax={last}
        aria-valuenow={selected.time}
        aria-valuetext={`${formatTime(selected.time)}, ${selected.viewers} watching`}
        onPointerDown={(e) => chooseFromPointer(e.clientX)}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === "mouse") chooseFromPointer(e.clientX);
        }}
        onKeyDown={handleKey}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line className="viewer-log-grid" x1="0" x2="100" y1="0" y2="0" />
          <line className="viewer-log-grid" x1="0" x2="100" y1="100" y2="100" />
          <path className="viewer-log-area" d={area} />
          <path className="viewer-log-line" d={line} />
          <line className="viewer-log-cursor" x1={xOf(selected.time)} x2={xOf(selected.time)} y1="0" y2="100" />
        </svg>
        <span className="viewer-log-max">{yMax}</span>
        <span
          className="viewer-log-dot"
          style={{ left: `${xOf(selected.time)}%`, top: `${yOf(selected.viewers)}%` }}
        />
      </div>

      <div className="viewer-log-axis" aria-hidden="true">
        <span style={{ left: 0 }}>{formatTime(first)}</span>
        {hourTicks
          // Kept clear of the start and end labels so they never collide on a phone.
          .filter((t) => xOf(t) > 20 && xOf(t) < 80)
          .map((t) => (
            <span key={t} style={{ left: `${xOf(t)}%` }} className="viewer-log-axis-mid">
              {formatTime(t)}
            </span>
          ))}
        <span style={{ right: 0 }}>{formatTime(last)}</span>
      </div>

      <p className="hint viewer-log-hint">Tap or drag along the chart, or type a time, to see how many were watching.</p>

      {fifteenMinuteRows.length > 0 && (
        <details className="viewer-log-table">
          <summary>Every 15 minutes</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Watching</th>
              </tr>
            </thead>
            <tbody>
              {fifteenMinuteRows.map((p) => (
                <tr key={p.time}>
                  <td>{formatTime(p.time)}</td>
                  <td>{p.viewers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}

function formatTime(time: number): string {
  return new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
