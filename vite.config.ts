import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/battle-royale/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "placeholder-map.svg", "portrait-*.svg"],
      manifest: {
        name: "Battle Royale Map Game",
        short_name: "Battle Royale",
        description: "A local-first map battle game for AI-assisted storytelling.",
        theme_color: "#15130f",
        background_color: "#15130f",
        display: "standalone",
        orientation: "any",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
