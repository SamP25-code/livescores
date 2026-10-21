"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export const LARGER_TEXT_KEY = "bowls-larger-text";

// Applied before the page shows (see app/layout.tsx), so remembered larger
// text doesn't jump in after a moment
export const LARGER_TEXT_SCRIPT = `try{if(localStorage.getItem("${LARGER_TEXT_KEY}")==="1")document.documentElement.classList.add("larger-text")}catch(e){}`;

// The bottom of every public page: the privacy notice, "Larger text"
// (remembered on this phone), and the organisers' sign-in
export default function PublicFooter({ line }: { line?: string }) {
  const [larger, setLarger] = useState(false);

  useEffect(() => {
    setLarger(document.documentElement.classList.contains("larger-text"));
  }, []);

  function toggle() {
    const next = !larger;
    setLarger(next);
    document.documentElement.classList.toggle("larger-text", next);
    try {
      if (next) localStorage.setItem(LARGER_TEXT_KEY, "1");
      else localStorage.removeItem(LARGER_TEXT_KEY);
    } catch {
      // Not remembered (private browsing) - still larger for now
    }
  }

  return (
    <footer className="public-footer">
      {line && <p>{line}</p>}
      <nav className="public-footer-links" aria-label="Site">
        <Link href="/privacy">Privacy</Link>
        <button type="button" aria-pressed={larger} onClick={toggle}>
          {larger ? "Normal text" : "Larger text"}
        </button>
        <Link href="/admin">Sign in</Link>
      </nav>
    </footer>
  );
}
