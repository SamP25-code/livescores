import type { Metadata } from "next";
import { postShare, shareMetadata } from "@/lib/shareMeta";

// A news post's headline and picture when its link is shared
export async function generateMetadata({ params }: { params: Promise<{ postId: string }> }): Promise<Metadata> {
  const { postId } = await params;
  return shareMetadata(await postShare(postId));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
