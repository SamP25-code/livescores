"use client";

// Backgrounds: the photo behind every public page. The site's general one is
// chosen in admin (Settings); a competition or an event can have its own,
// shown on its pages. Pages set theirs with usePageBackground; everything
// else shows the general one (or, before one's chosen, the built-in photo).
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

// Super: uploads a picture to the public "backgrounds" folder and returns
// its address
export async function uploadBackground(file: File): Promise<string> {
  if (!TYPES.includes(file.type)) throw new Error("The background needs to be a photo - JPG, PNG or WebP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("That photo is too big - it needs to be under 8 MB.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("backgrounds").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from("backgrounds").getPublicUrl(path).data.publicUrl;
}

export async function loadSiteBackground(): Promise<string | null> {
  const { data } = await supabase.from("site_settings").select("value").eq("key", "background_url").maybeSingle();
  return data?.value || null;
}

// Super: the general background (null: back to the built-in photo)
export async function saveSiteBackground(url: string | null): Promise<void> {
  const { error } = await supabase.from("site_settings").upsert({ key: "background_url", value: url });
  if (error) throw error;
}

function cssUrl(url: string): string {
  return `url("${url.replace(/["\\\n]/g, "")}")`;
}

// The general background, set once for the visit
export function useSiteBackground() {
  useEffect(() => {
    loadSiteBackground()
      .then((url) => {
        if (url) document.documentElement.style.setProperty("--site-background", cssUrl(url));
      })
      .catch(() => {});
  }, []);
}

// A page with its own background (a competition's or an event's), for as
// long as the page is open
export function usePageBackground(url: string | null | undefined) {
  useEffect(() => {
    if (!url) return;
    const root = document.documentElement;
    root.style.setProperty("--page-background", cssUrl(url));
    return () => {
      root.style.removeProperty("--page-background");
    };
  }, [url]);
}
