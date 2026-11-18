/**
 * Builds the Mirror Maze puzzles.
 *
 * For each Mirror Maze variant (mirror-maze-placement, mirror-maze-rotation):
 *   Reads   puzzles/<variant>/*.txt             (your puzzle files)
 *   Writes  public/<variant>/puzzles/*.json     (what the game loads)
 *           src/<variant>/puzzles-index.json    (list of puzzles, for routing + landing page)
 *
 * Runs automatically as part of `npm run dev` and `npm run build`.
 * If a puzzle file has a mistake, this stops with the file name and line number.
 * To check a puzzle has exactly one solution, run `npm run mirror-test`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMirrorPuzzle } from "../src/mirror-maze/puzzleParser.js";

// Every Mirror Maze variant that has its own page. Add new ones here.
// slug: folder name / URL; variant: which rules the parser checks.
export const MIRROR_VARIANTS = [
  { slug: "mirror-maze-placement", variant: "placement" },
  { slug: "mirror-maze-rotation", variant: "rotation" },
];

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function relative(file) {
  return path.relative(projectDirectory, file).split(path.sep).join("/");
}

function buildVariant({ slug, variant }) {
  const sourceDirectory = path.join(projectDirectory, "puzzles", slug);
  const outputDirectory = path.join(projectDirectory, "public", slug, "puzzles");
  const indexFile = path.join(projectDirectory, "src", slug, "puzzles-index.json");

  fs.mkdirSync(sourceDirectory, { recursive: true });

  const files = fs
    .readdirSync(sourceDirectory)
    .filter((filename) => path.extname(filename).toLowerCase() === ".txt")
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  // Start fresh so deleted puzzles disappear from the site.
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });

  const index = [];
  const missingHints = [];
  let failed = false;

  for (const filename of files) {
    const name = path.basename(filename, path.extname(filename));
    const sourceFile = path.join(sourceDirectory, filename);
    let puzzle;

    try {
      puzzle = parseMirrorPuzzle(fs.readFileSync(sourceFile, "utf8"), name, variant);
    } catch (error) {
      console.error(`\n✗ ${relative(sourceFile)}\n  ${error.message}\n`);
      failed = true;
      continue;
    }

    if (!puzzle.hints) missingHints.push(name);

    fs.writeFileSync(path.join(outputDirectory, `${name}.json`), JSON.stringify(puzzle) + "\n", "utf8");

    index.push({
      name,
      title: puzzle.title,
      data: `/${slug}/puzzles/${encodeURIComponent(name)}.json`,
      url: `/${slug}/${encodeURIComponent(name)}`,
    });

    const kinds = [...new Set(puzzle.letters.map((letter) => letter.letter))].sort();
    console.log(`  - ${puzzle.title}: ${puzzle.width}x${puzzle.height} grid, letters ${kinds.join(", ")}`);
  }

  if (failed) {
    console.error(`${slug}: fix the puzzle file(s) above and try again.`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(indexFile), { recursive: true });
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + "\n", "utf8");

  console.log(`${slug}: built ${index.length} puzzle(s) into ${relative(outputDirectory)}.`);

  if (missingHints.length) {
    console.log(
      `${slug}: no [hints] for ${missingHints.join(", ")}. ` +
        "Those puzzles won't show a Hint button."
    );
  }
}

// Only build when run directly (mirror-test imports MIRROR_VARIANTS).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  MIRROR_VARIANTS.forEach(buildVariant);
}
