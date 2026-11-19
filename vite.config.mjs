import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { assetsInlineLimit: 0 },
  plugins: [{
    name: "project-notices",
    apply: "build",
    generateBundle() {
      for (const fileName of ["LICENSE.md", "assets/icons/LICENSE-LUCIDE.txt", "docs/ASSETS.md"]) {
        this.emitFile({
          type: "asset",
          fileName,
          source: readFileSync(new URL(fileName, import.meta.url)),
        });
      }
    },
  }],
});
