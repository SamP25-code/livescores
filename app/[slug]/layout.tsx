import type { Metadata } from "next";
import { addressShare, shareMetadata } from "@/lib/shareMeta";

// A competition's or an event's own title when its link is shared
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return shareMetadata(await addressShare(slug));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
