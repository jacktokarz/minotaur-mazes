/**
 * Builds the Space Roundup puzzles.
 *
 * Reads   puzzles/space-roundup/*.txt             (your puzzle files)
 * Writes  public/space-roundup/puzzles/*.json     (what the game loads)
 *         src/space-roundup/puzzles-index.json    (list of puzzles, for routing + landing page)
 *
 * Runs automatically as part of `npm run dev` and `npm run build`.
 * If a puzzle file has a mistake, this stops with the file name and line number.
 * To check a puzzle can be won (and see the shortest way), run `npm run space-test`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSpacePuzzle } from "../src/space-roundup/puzzleParser.js";

const SLUG = "space-roundup";
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(projectDirectory, "puzzles", SLUG);
const outputDirectory = path.join(projectDirectory, "public", SLUG, "puzzles");
const indexFile = path.join(projectDirectory, "src", SLUG, "puzzles-index.json");

const relative = (file) => path.relative(projectDirectory, file).split(path.sep).join("/");

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
    puzzle = parseSpacePuzzle(fs.readFileSync(sourceFile, "utf8"), name);
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
    data: `/${SLUG}/puzzles/${encodeURIComponent(name)}.json`,
    url: `/${SLUG}/${encodeURIComponent(name)}`,
  });
  console.log(`  - ${puzzle.title}: ${puzzle.width}x${puzzle.height} grid, ${puzzle.friends.length} friend(s)`);
}

if (failed) {
  console.error(`${SLUG}: fix the puzzle file(s) above and try again.`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(indexFile), { recursive: true });
fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + "\n", "utf8");
console.log(`${SLUG}: built ${index.length} puzzle(s) into ${relative(outputDirectory)}.`);

if (missingHints.length) {
  console.log(`${SLUG}: no [hints] for ${missingHints.join(", ")}. Those puzzles won't show a Hint button.`);
}
