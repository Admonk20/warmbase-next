import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        entry: "src/server.ts",
      },
    }),
    // react(), // Removed potentially conflicting plugin
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    chunkSizeWarningLimit: 1024,
  },
});

