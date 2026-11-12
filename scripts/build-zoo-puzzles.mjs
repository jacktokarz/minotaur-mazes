/**
 * Builds the zoOrganizer puzzles.
 *
 * Reads   puzzles/zoorganizer/*.txt          (your puzzle files – NOT published)
 * Writes  public/zoorganizer/puzzles/*.json  (what the game loads; answers hashed)
 *         src/zoorganizer/puzzles-index.json (list of puzzles, for routing + landing page)
 *
 * Runs automatically as part of `npm run dev` and `npm run build`.
 * If a puzzle file has a mistake, this stops with the file name and line number.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePuzzle } from "../src/zoorganizer/puzzleParser.js";
import { hashArrangement } from "../src/zoorganizer/solutionCheck.js";
import { parseRules } from "./zoo/rules.mjs";

const PUZZLE_SLUG = "zoorganizer";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(projectDirectory, "puzzles", PUZZLE_SLUG);
const animalsDirectory = path.join(projectDirectory, "public", PUZZLE_SLUG, "animals");
const outputDirectory = path.join(projectDirectory, "public", PUZZLE_SLUG, "puzzles");
const indexFile = path.join(projectDirectory, "src", PUZZLE_SLUG, "puzzles-index.json");

function relative(file) {
  return path.relative(projectDirectory, file).split(path.sep).join("/");
}

const IMAGE_EXTENSIONS = [".png", ".gif", ".webp"];

/** Sprite files in public/zoorganizer/animals/, e.g. { baboon: "baboon.png" }. */
function listSprites() {
  if (!fs.existsSync(animalsDirectory)) return {};

  return Object.fromEntries(
    fs
      .readdirSync(animalsDirectory)
      .filter((file) => IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
      .map((file) => [path.basename(file, path.extname(file)).toLowerCase(), file])
  );
}

/**
 * Which sprite an animal uses:
 *   1. a sprite with exactly its name ("Snow Leopard" -> snow-leopard.png), or
 *   2. the longest sprite name its name ends with
 *      ("Silly Baboon" -> baboon.png, "Golden Lion Tamarin" -> tamarin.png, not lion.png).
 */
function findAnimalImage(species, sprites) {
  let match = sprites[species] ? species : null;

  if (!match) {
    match = Object.keys(sprites)
      .filter((sprite) => species.endsWith(`-${sprite}`))
      .sort((a, b) => b.length - a.length)[0] ?? null;
  }

  return match ? { sprite: match, url: `/${PUZZLE_SLUG}/animals/${sprites[match]}` } : null;
}

function build() {
  fs.mkdirSync(sourceDirectory, { recursive: true });

  const files = fs
    .readdirSync(sourceDirectory)
    .filter((filename) => path.extname(filename).toLowerCase() === ".txt")
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  // Start fresh so deleted puzzles disappear from the site.
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });

  const index = [];
  const missingArt = new Set();
  const sprites = listSprites();
  let failed = false;

  for (const filename of files) {
    const name = path.basename(filename, path.extname(filename));
    const sourceFile = path.join(sourceDirectory, filename);

    let puzzle;

    try {
      puzzle = parsePuzzle(fs.readFileSync(sourceFile, "utf8"), name);
      // Check the [rules] section (if any) so mistakes are caught at build time.
      parseRules(puzzle);
    } catch (error) {
      console.error(`\n✗ ${relative(sourceFile)}\n  ${error.message}\n`);
      failed = true;
      continue;
    }

    const enclosureIds = puzzle.enclosures.map((enclosure) => enclosure.id);
    // Publish neither the answer nor the rules.
    const { solution, solutionById, rules, ...published } = puzzle;

    // Publish only a fingerprint of the one correct arrangement.
    published.solutionHash = hashArrangement(name, solution, enclosureIds);

    const shared = [];

    published.animals = puzzle.animals.map((animal) => {
      const image = findAnimalImage(animal.species, sprites);
      if (!image) missingArt.add(animal.species);
      else if (image.sprite !== animal.species) shared.push(`${animal.name} -> ${image.sprite}`);
      return { ...animal, image: image?.url ?? null };
    });

    const outputFile = path.join(outputDirectory, `${name}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(published) + "\n", "utf8");

    index.push({
      name,
      title: puzzle.title,
      data: `/${PUZZLE_SLUG}/puzzles/${encodeURIComponent(name)}.json`,
      url: `/${PUZZLE_SLUG}/${encodeURIComponent(name)}`,
    });

    console.log(
      `  - ${puzzle.title}: ${puzzle.enclosures.length} enclosures, ` +
        `${puzzle.animals.length} animals`
    );

    if (shared.length) {
      console.log(`      sprites: ${shared.join(", ")}`);
    }
  }

  if (failed) {
    console.error("zoOrganizer: fix the puzzle file(s) above and try again.");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(indexFile), { recursive: true });
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + "\n", "utf8");

  console.log(`zoOrganizer: built ${index.length} puzzle(s) into ${relative(outputDirectory)}.`);

  if (missingArt.size) {
    console.log(
      `zoOrganizer: no artwork yet for ${[...missingArt].join(", ")} ` +
        `(add PNGs to ${relative(animalsDirectory)}/). They will show as name tags until then.`
    );
  }
}

build();
