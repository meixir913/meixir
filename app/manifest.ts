import type { MetadataRoute } from "next";

// Lets people add the dashboard to their phone's home screen, which iPhones need for notifications.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hire Me ECE — Career Dashboard",
    short_name: "Hire Me ECE",
    description: "Early childhood jobs, cover letters and interview prep.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7ef",
    theme_color: "#0f1f39",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
