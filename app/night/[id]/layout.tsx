import type { Metadata } from "next";
import { sessionShare, shareMetadata } from "@/lib/shareMeta";

// A session's competition, name and date when its link is shared
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return shareMetadata(await sessionShare(id));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
