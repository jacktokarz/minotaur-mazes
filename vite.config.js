import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

// Each puzzle type has its own page at /<slug>/, built from <slug>/index.html.
// When you add a new puzzle type, add its slug here AND add a matching
// rewrite to vercel.json.
const PUZZLE_PAGES = [
  "minotaur-mazes",
  "zoorganizer",
  "mirror-maze-placement",
  "mirror-maze-rotation",
  "space-roundup",
];

/**
 * Serve /<slug>/<anything> with that puzzle's index.html while developing
 * locally (npm run dev / npm run preview), so URLs like
 * /minotaur-mazes/Easier work the same way they do on Vercel.
 * Real files (anything with a file extension) are left alone.
 */
function puzzlePageRoutes() {
  function rewrite(req, _res, next) {
    const [pathname, query] = req.url.split("?");

    if (!path.extname(pathname)) {
      const slug = PUZZLE_PAGES.find(
        (page) => pathname === `/${page}` || pathname.startsWith(`/${page}/`)
      );

      if (slug) {
        req.url = `/${slug}/index.html${query ? `?${query}` : ""}`;
      }
    }

    next();
  }

  return {
    name: "puzzle-page-routes",
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  base: "/",

  plugins: [puzzlePageRoutes()],

  server: {
    host: "0.0.0.0",
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // The landing page at /
        main: path.resolve(root, "index.html"),
        // One page per puzzle type
        ...Object.fromEntries(
          PUZZLE_PAGES.map((slug) => [
            slug,
            path.resolve(root, slug, "index.html"),
          ])
        ),
      },
    },
  },
});
