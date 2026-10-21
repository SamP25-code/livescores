import Link from "next/link";
import { SHOW_PRIVACY } from "@/lib/site";

// The bottom of every public page: the privacy notice (when it's shown) and
// the organisers' sign-in. Text size follows the phone's own setting, and
// any page can be pinched to zoom.
export default function PublicFooter({ line }: { line?: string }) {
  return (
    <footer className="public-footer">
      {line && <p>{line}</p>}
      <nav className="public-footer-links" aria-label="Site">
        {SHOW_PRIVACY && <Link href="/privacy">Privacy</Link>}
        <Link href="/admin">Sign in</Link>
      </nav>
    </footer>
  );
}
