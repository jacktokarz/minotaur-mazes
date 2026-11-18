/**
 * Checks that Mirror Maze puzzles have exactly one solution.
 *
 *   npm run mirror-test             check every Mirror Maze puzzle
 *   npm run mirror-test easier      check every puzzle called Easier
 *
 * Placement: tries every way of placing mirrors where the light can reach
 *   (within the puzzle's [limits]) and lists each arrangement that works.
 *   Mirrors on squares no light touches don't count as a different solution.
 * Rotation: tries every firing order and lists each one that works.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMirrorPuzzle } from "../src/mirror-maze/puzzleParser.js";
import { iconPlural } from "../src/mirror-maze/icons.js";
import { MIRROR_VARIANTS } from "./build-mirror-puzzles.mjs";
import { findSolutions } from "./mirror/solver.mjs";
import { findOrders } from "./mirror/rotationSolver.mjs";

const SHOW = 20;
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const names = process.argv.slice(2).filter((arg) => !arg.startsWith("--")).map((n) => n.toLowerCase());

function draw(puzzle, mirrors) {
  return puzzle.grid
    .map((row, y) => "    " + [...row].map((symbol, x) => mirrors.get(`${x},${y}`) ?? symbol).join(""))
    .join("\n");
}

function describePlacement(mirrors) {
  const counts = { "\\": 0, "/": 0 };
  for (const mirror of mirrors.values()) counts[mirror] += 1;
  const where = [...mirrors]
    .map(([key, mirror]) => {
      const [x, y] = key.split(",").map(Number);
      return `${mirror} at row ${y + 1}, column ${x + 1}`;
    })
    .join("; ");
  return `\\ mirrors: ${counts["\\"]}, / mirrors: ${counts["/"]}. ${where}`;
}

function report(found, total, complete, seconds, noun) {
  if (complete && total === 1) {
    console.log(`  PASS  Exactly 1 ${noun}. (searched in ${seconds}s)`);
    return true;
  }
  if (total === 0) {
    console.log(`  FAIL  No ${noun} works. (searched in ${seconds}s)`);
  } else {
    console.log(
      `  FAIL  ${complete ? total : `More than ${total}`} ${noun}s work; there should be exactly 1. ` +
        `(searched in ${seconds}s)`
    );
  }
  return false;
}

function checkPlacement(puzzle) {
  const started = Date.now();
  const { solutions, total, complete } = findSolutions(puzzle, { keep: SHOW });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const passed = report(solutions, total, complete, seconds, "solution");

  solutions.forEach((mirrors, i) => {
    console.log(`\n  Solution ${i + 1}: ${describePlacement(mirrors)}`);
    console.log(draw(puzzle, mirrors));
  });
  if (solutions.length < total) console.log(`\n  ...and ${total - solutions.length} more.`);
  return passed;
}

function checkRotation(puzzle) {
  const started = Date.now();
  const { orders, total, complete, doubleHits } = findOrders(puzzle, { keep: SHOW });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const passed = report(orders, total, complete, seconds, "firing order");

  for (const order of orders) {
    console.log(`    ${order.join(" ")}   (${order.map(iconPlural).join(", ")})`);
  }
  if (orders.length < total) console.log(`    ...and ${total - orders.length} more.`);
  if (doubleHits) {
    console.log(
      "  NOTE  In a working order, a beam bounces off the same mirror twice in one turn. " +
        "It stays put while the light travels, then flips once at the end of the turn."
    );
  }
  return passed;
}

const results = [];

for (const { slug, variant } of MIRROR_VARIANTS) {
  const directory = path.join(projectDirectory, "puzzles", slug);
  if (!fs.existsSync(directory)) continue;

  const files = fs
    .readdirSync(directory)
    .filter((file) => path.extname(file).toLowerCase() === ".txt")
    .filter((file) => !names.length || names.includes(path.basename(file, ".txt").toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  for (const file of files) {
    const name = path.basename(file, ".txt");
    console.log(`\n=== ${slug}: ${name}  (puzzles/${slug}/${file})`);

    let passed = false;
    try {
      const puzzle = parseMirrorPuzzle(fs.readFileSync(path.join(directory, file), "utf8"), name, variant);
      passed = variant === "rotation" ? checkRotation(puzzle) : checkPlacement(puzzle);
    } catch (error) {
      console.log(`  FAIL  The file has a mistake: ${error.message}`);
    }
    results.push([`${slug}: ${name}`, passed]);
  }
}

if (results.length === 0) {
  console.error(names.length ? `No Mirror Maze puzzle called "${names.join(", ")}".` : "No Mirror Maze puzzles found.");
  process.exit(2);
}

if (results.length > 1) {
  console.log("\n=== Summary");
  for (const [label, passed] of results) console.log(`  ${passed ? "PASS" : "FAIL"}  ${label}`);
}

process.exit(results.every(([, passed]) => passed) ? 0 : 1);
