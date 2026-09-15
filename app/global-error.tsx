"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/browser";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="page">
          <div className="home-hero">
            <h1>Something went wrong</h1>
            <p className="hint">
              This page hit an error. Try again, or refresh &mdash; scores and the draw aren&rsquo;t affected.
            </p>
          </div>
          <p style={{ textAlign: "center" }}>
            <button onClick={reset}>Try again</button>
          </p>
        </div>
      </body>
    </html>
  );
}
