import Link from "next/link";
import { SHOW_PRIVACY } from "@/lib/site";

// The very bottom of a public page: the organisers' Sign in on the home page
// only (it's in the menu everywhere), and the privacy notice when it's shown
export default function PublicFooter({ signIn = false }: { signIn?: boolean }) {
  if (!signIn && !SHOW_PRIVACY) return null;
  return (
    <footer className="public-footer">
      <nav className="public-footer-links" aria-label="Site">
        {SHOW_PRIVACY && <Link href="/privacy">Privacy</Link>}
        {signIn && <Link href="/admin">Sign in</Link>}
      </nav>
    </footer>
  );
}
