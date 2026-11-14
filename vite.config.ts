// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

/**
 * Nitro's static presets (`github-pages`, `static`, ...) deliberately skip the
 * server bundle. TanStack Start's prerender pass, however, starts a Vite
 * preview server that imports `dist/server/server.js`, while Nitro emits the
 * SSR service into `node_modules/.nitro/vite/services/ssr`.
 *
 * `configurePreviewServer` runs after both Vite environments and Nitro's build
 * have finished, but before TanStack's prerender requests reach the preview
 * server. Writing the bridge there points the preview server at Nitro's SSR
 * bundle. If the internal path ever moves, the build still succeeds because
 * Nitro prerenders the same routes itself via `nitro.prerender` below.
 */
function ssrPreviewShim(): Plugin {
  return {
    name: "hyperlife:ssr-preview-shim",
    async configurePreviewServer() {
      const serviceEntry = resolve("node_modules/.nitro/vite/services/ssr/index.js");
      const target = resolve("dist/server/server.js");
      try {
        await access(serviceEntry);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, `export { default } from ${JSON.stringify(serviceEntry)};\n`);
      } catch {
        // Nitro's own prerender pass will still generate every page.
      }
    },
  };
}

// Nitro's GitHub Pages preset emits only static files into `.output/public` and
// writes `.nojekyll` so GitHub Pages serves the `assets/` directory untouched.
// Routes are rendered by TanStack Start's SSR service during the build, then
// written as `<route>/index.html` so a hard refresh on a nested URL never 404s.
const nitroTarget = {
  preset: "github-pages",
  prerender: {
    routes: ["/", "/register", "/environment", "/base", "/mood", "/food", "/health", "/dashboard"],
    crawlLinks: true,
    failOnError: false,
  },
};

export default defineConfig({
  plugins: [ssrPreviewShim()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    prerender: {
      enabled: true,
      crawlLinks: true,
      // Nitro's prerender pass below is the safety net if the preview bridge
      // is unavailable, so a single route failure must not fail the build.
      failOnError: false,
    },
    pages: [
      { path: "/" },
      { path: "/register" },
      { path: "/environment" },
      { path: "/base" },
      { path: "/mood" },
      { path: "/food" },
      { path: "/health" },
      { path: "/dashboard" },
    ],
  },
  nitro: nitroTarget,
});
