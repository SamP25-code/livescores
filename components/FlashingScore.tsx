"use client";

import { useEffect, useRef, useState } from "react";

export default function FlashingScore({
  value,
  className = "score",
}: {
  value: number | string;
  className?: string;
}) {
  const previous = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (value === previous.current) return;
    previous.current = value;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 500);
    return () => clearTimeout(timer);
  }, [value]);

  return <span className={`${className} ${flash ? "score-flash" : ""}`}>{value}</span>;
}
