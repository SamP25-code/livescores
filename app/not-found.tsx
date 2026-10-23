import Link from "next/link";
import PublicPage from "@/components/PublicPage";

export default function NotFound() {
  return (
    <PublicPage title="Page not found" loading={false} failed={false}>
      <p className="quiet-line">That link doesn&rsquo;t lead anywhere &ndash; it may have moved, or been mistyped</p>
      <p>
        <Link href="/" className="button secondary">
          Go to the home page
        </Link>
      </p>
    </PublicPage>
  );
}
