import type { Metadata } from "next";
import { playerShare, shareMetadata } from "@/lib/shareMeta";

// A player's name when their page is shared
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return shareMetadata(await playerShare(id));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
