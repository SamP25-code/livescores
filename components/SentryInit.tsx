"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/browser";

let initialized = false;

export default function SentryInit() {
  useEffect(() => {
    if (initialized) return;
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    initialized = true;
    Sentry.init({ dsn, tracesSampleRate: 0 });
  }, []);

  return null;
}
