import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // CodeMirror, KaTeX and three.js are reached only through lazy imports
    // (the Solve page, the maths renderer, the landing scene), so Vite splits
    // them out of the entry chunk by itself. A manual "editor" chunk used to
    // be named here; it made index.html preload the whole editor on every
    // page, so only the router keeps a chunk of its own.
    rollupOptions: {
      output: {
        // Function form: the object form is not accepted by Vite's typings
        // when `output` may also be an array.
        manualChunks(id: string) {
          if (id.includes("react-router")) return "router";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
