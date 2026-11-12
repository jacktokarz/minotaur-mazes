/**
 * Checks that a zoOrganizer puzzle has exactly one solution.
 *
 *   npm run zoo-test expert          check puzzles/zoorganizer/Expert.txt
 *   npm run zoo-test                 check every puzzle
 *   npm run zoo-test expert -- --all list every solution, however many
 *
 * It tries every possible arrangement of the animals against the puzzle's
 * [rules] section and lists each arrangement that follows all of them. The
 * check passes when there is exactly one, and it is the puzzle's [solution].
 *
 * Note: it checks the [rules], not the English [clues], so keep the two in
 * step (see puzzles/zoorganizer/README.md, "Testing a puzzle").
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePuzzle, TERRAIN_LABELS } from "../src/zoorganizer/puzzleParser.js";
import { arrangementKey } from "../src/zoorganizer/solutionCheck.js";
import { parseRules, adjacency, ruleHolds } from "./zoo/rules.mjs";
import { findSolutions } from "./zoo/solver.mjs";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const puzzleDirectory = path.join(projectDirectory, "puzzles", "zoorganizer");

const SHOW_BY_DEFAULT = 50;       // solutions listed unless --all is given
const MAX_COUNT = 10_000;         // stop counting after this many (a puzzle this loose needs more clues anyway)

// ------------------------------------------------------------
// Command line
// ------------------------------------------------------------

const args = process.argv.slice(2);
const showAll = args.includes("--all");
const names = args.filter((arg) => !arg.startsWith("--"));

const available = fs
  .readdirSync(puzzleDirectory)
  .filter((file) => path.extname(file).toLowerCase() === ".txt")
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

function findFile(name) {
  const wanted = name.toLowerCase().replace(/\.txt$/, "");
  return available.find((file) => path.basename(file, ".txt").toLowerCase() === wanted);
}

let files;

if (names.length === 0) {
  files = available;
} else {
  files = names.map((name) => {
    const file = findFile(name);
    if (!file) {
      console.error(
        `No puzzle called "${name}" in puzzles/zoorganizer/.\n` +
          `Available: ${available.map((f) => path.basename(f, ".txt")).join(", ")}`
      );
      process.exit(2);
    }
    return file;
  });
}

// ------------------------------------------------------------
// Checking one puzzle
// ------------------------------------------------------------

function describe(puzzle, at, intended) {
  const names = Object.fromEntries(puzzle.animals.map((a) => [a.id, `${a.id} ${a.name}`]));
  const width = Math.max(...Object.values(TERRAIN_LABELS).map((l) => l.length));
  const lines = puzzle.enclosures.map((e) => {
    const residents = puzzle.animals.filter((a) => at[a.id] === e.id).map((a) => names[a.id]);
    return `    ${e.id}  ${e.label.padEnd(width)}  ${residents.join(", ") || "(empty)"}`;
  });

  if (intended) {
    const moved = puzzle.animals
      .filter((a) => at[a.id] !== intended[a.id])
      .map((a) => `${names[a.id]} in ${at[a.id]} (yours: ${intended[a.id]})`);
    if (moved.length) lines.push(`    Different from your [solution]: ${moved.join("; ")}`);
  }

  return lines.join("\n");
}

function keyOf(puzzle) {
  const species = Object.fromEntries(puzzle.animals.map((a) => [a.id, a.species]));
  const ids = puzzle.enclosures.map((e) => e.id);

  return (at) => {
    const placement = {};
    for (const [animal, enclosure] of Object.entries(at)) {
      (placement[enclosure] ??= []).push(species[animal]);
    }
    return arrangementKey(placement, ids);
  };
}

function checkPuzzle(file) {
  const relative = `puzzles/zoorganizer/${file}`;
  const text = fs.readFileSync(path.join(puzzleDirectory, file), "utf8");
  let puzzle;
  let parsed;

  console.log(`\n=== ${path.basename(file, ".txt")}  (${relative})`);

  try {
    puzzle = parsePuzzle(text, path.basename(file, ".txt"));
    parsed = parseRules(puzzle);
  } catch (error) {
    console.log(`  FAIL  The file has a mistake: ${error.message}`);
    return false;
  }

  if (!parsed) {
    console.log(
      "  FAIL  This puzzle has no [rules] section, so it can't be checked yet.\n" +
        '        Add the clues as rules (see "Testing a puzzle" in puzzles/zoorganizer/README.md).'
    );
    return false;
  }

  const { rules } = parsed;
  const ruleLines = new Set(rules.map((r) => r.line)).size;
  console.log(
    `  ${puzzle.animals.length} animals, ${puzzle.enclosures.length} enclosures, ` +
      `${ruleLines} rule${ruleLines === 1 ? "" : "s"}`
  );

  // 1. Does the intended solution follow the rules?
  const next = adjacency(puzzle);
  const broken = [...new Map(
    rules.filter((rule) => !ruleHolds(rule, puzzle.solutionById, next)).map((r) => [r.line, r])
  ).values()];

  if (broken.length) {
    console.log("  FAIL  Your [solution] breaks these rules (a rule or the solution has a mistake):");
    for (const rule of broken) console.log(`          line ${rule.line}: ${rule.text}`);
  } else {
    console.log("  ok    Your [solution] follows every rule.");
  }

  // 2. Find every arrangement that follows the rules.
  const started = Date.now();
  const sameAs = keyOf(puzzle);
  const { solutions, total, complete } = findSolutions(puzzle, rules, {
    keep: showAll ? MAX_COUNT : SHOW_BY_DEFAULT,
    maxCount: MAX_COUNT,
    keyOf: sameAs,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const intendedKey = sameAs(puzzle.solutionById);
  const countText = complete ? `${total}` : `More than ${MAX_COUNT.toLocaleString()}`;
  const passed = !broken.length && complete && total === 1 && sameAs(solutions[0]) === intendedKey;

  if (passed) {
    console.log(`  PASS  Exactly 1 possible solution, and it is your [solution]. (searched in ${seconds}s)`);
  } else if (total === 0) {
    console.log(`  FAIL  No arrangement follows all of the rules. (searched in ${seconds}s)`);
  } else if (total === 1 && complete) {
    console.log(
      `  FAIL  Exactly 1 possible solution, but it is not your [solution]. (searched in ${seconds}s)`
    );
  } else {
    console.log(
      `  FAIL  ${countText} possible solution${total === 1 ? "" : "s"} found; there should be exactly 1. ` +
        `(searched in ${seconds}s)`
    );
  }

  // 3. List them.
  solutions.forEach((at, i) => {
    const mine = sameAs(at) === intendedKey;
    console.log(`\n  Solution ${i + 1}${mine ? "  (your [solution])" : ""}`);
    console.log(describe(puzzle, at, mine ? null : puzzle.solutionById));
  });

  if (!complete) {
    console.log(
      `\n  ...and many more (stopped counting at ${MAX_COUNT.toLocaleString()}). ` +
        "Add more clues and rules, then run the test again."
    );
  } else if (solutions.length < total) {
    console.log(
      `\n  ...and ${total - solutions.length} more. ` +
        `Run "npm run zoo-test ${path.basename(file, ".txt")} -- --all" to list them all.`
    );
  }

  return passed;
}

const results = files.map((file) => [file, checkPuzzle(file)]);

if (results.length > 1) {
  console.log("\n=== Summary");
  for (const [file, passed] of results) {
    console.log(`  ${passed ? "PASS" : "FAIL"}  ${path.basename(file, ".txt")}`);
  }
}

process.exit(results.every(([, passed]) => passed) ? 0 : 1);
