import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bowls Live",
    short_name: "Bowls Live",
    description: "Live knockout results for Penwortham Sports & Social Club's October singles",
    start_url: "/",
    display: "standalone",
    background_color: "#efebdd",
    theme_color: "#1f3d2b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
