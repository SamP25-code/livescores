// Posts on an event's page (the Blackpool Masters): news and articles,
// qualifier updates, and adverts. Super writes them all; visitors see the
// published ones once their "show from" date comes (the database decides).
import { supabase } from "@/lib/supabaseClient";

export type PostKind = "news" | "qualifier" | "advert";

export const POST_KIND_LABEL: Record<PostKind, string> = {
  news: "News",
  qualifier: "Qualifier",
  advert: "Advert",
};

export type EventPost = {
  id: string;
  organiser_id: string;
  year: number;
  kind: PostKind;
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  qualifier_event_id: string | null;
  show_from: string;
  pinned: boolean;
  published: boolean;
  created_at: string;
};

export type PostInput = Omit<EventPost, "id" | "created_at">;

// Pinned first, then newest first
export function orderPosts<T extends Pick<EventPost, "pinned" | "show_from" | "created_at">>(posts: T[]): T[] {
  return [...posts].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) || b.show_from.localeCompare(a.show_from) || b.created_at.localeCompare(a.created_at)
  );
}

export async function listPosts(organiserId: string, year: number): Promise<EventPost[]> {
  const { data, error } = await supabase
    .from("event_posts")
    .select("*")
    .eq("organiser_id", organiserId)
    .eq("year", year);
  if (error) throw error;
  return orderPosts((data ?? []) as EventPost[]);
}

export async function getPost(id: string): Promise<EventPost | null> {
  const { data, error } = await supabase.from("event_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as EventPost | null) ?? null;
}

export function postProblem(p: Pick<PostInput, "kind" | "title" | "link_url">): string | null {
  if (!p.title.trim()) return p.kind === "advert" ? "Enter the advertiser's name." : "Enter a headline.";
  if (p.link_url && !/^https:\/\//.test(p.link_url)) return "The link should start with https://";
  return null;
}

export async function savePost(id: string | null, input: PostInput): Promise<void> {
  const problem = postProblem(input);
  if (problem) throw new Error(problem);
  const row = { ...input, title: input.title.trim(), body: input.body?.trim() || null, link_url: input.link_url?.trim() || null };
  const { error } = id
    ? await supabase.from("event_posts").update(row).eq("id", id)
    : await supabase.from("event_posts").insert(row);
  if (error) throw error;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from("event_posts").delete().eq("id", id);
  if (error) throw error;
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Uploads a post's picture to the public "event-images" folder
export async function uploadEventImage(file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("The picture needs to be a PNG, JPG, WebP or GIF.");
  if (file.size > 5 * 1024 * 1024) throw new Error("That picture is too big - it needs to be under 5 MB.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("event-images").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from("event-images").getPublicUrl(path).data.publicUrl;
}
