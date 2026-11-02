import { useEffect, useRef } from "react";

// On a phone a message shown at the top of a long page ("Saved.", an error,
// a new password) can be off-screen from the button that caused it. Put the
// returned ref on the message: whenever `value` changes to something, the
// page scrolls so the message can be seen.
export function useScrollIntoView<T extends HTMLElement>(value: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (value) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [value]);
  return ref;
}
