/**
 * Checks Space Roundup puzzles can be won.
 *
 *   npm run space-test           check every puzzle
 *   npm run space-test test      check puzzles/space-roundup/Test.txt
 *
 * Tries every move from every position the player can reach, then prints the
 * shortest win and how many reachable positions are dead ends (positions the
 * player can get into but never win from, so they'd have to reset).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSpacePuzzle } from "../src/space-roundup/puzzleParser.js";
import { fly, startState } from "../src/space-roundup/rules.js";
import { solve } from "./space/solver.mjs";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(projectDirectory, "puzzles", "space-roundup");
const names = process.argv.slice(2).filter((arg) => !arg.startsWith("--")).map((n) => n.toLowerCase());

const files = fs
  .readdirSync(directory)
  .filter((file) => path.extname(file).toLowerCase() === ".txt")
  .filter((file) => !names.length || names.includes(path.basename(file, ".txt").toLowerCase()))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

if (!files.length) {
  console.error(names.length ? `No Space Roundup puzzle called "${names.join(", ")}".` : "No Space Roundup puzzles found.");
  process.exit(2);
}

const WHY = { wall: "asteroid", edge: "edge", friend: "friend!", "locked-exit": "locked exit", exit: "escaped!" };
let allPassed = true;

for (const file of files) {
  const name = path.basename(file, ".txt");
  console.log(`\n=== ${name}  (puzzles/space-roundup/${file})`);

  try {
    const puzzle = parseSpacePuzzle(fs.readFileSync(path.join(directory, file), "utf8"), name);
    const result = solve(puzzle);

    if (!result.solution) {
      console.log(`  FAIL  This maze can't be won. (${result.reachable} positions reachable)`);
      allPassed = false;
      continue;
    }

    console.log(`  PASS  Can be won in ${result.solution.length} moves.`);
    let state = startState(puzzle);
    result.solution.forEach((direction, i) => {
      const move = fly(puzzle, state, direction);
      state = move.state;
      console.log(
        `    ${String(i + 1).padStart(2)}. ${direction.padEnd(5)}  -> row ${state.player.y + 1}, column ${state.player.x + 1}` +
          `  (stopped by: ${WHY[move.stoppedBy]})`
      );
    });
    console.log(
      `  ${result.reachable} positions reachable; ${result.deadEnds} dead end${result.deadEnds === 1 ? "" : "s"}` +
        (result.deadEndExample ? ` (e.g. ${result.deadEndExample.join(", ")})` : "") +
        "."
    );
  } catch (error) {
    console.log(`  FAIL  The file has a mistake: ${error.message}`);
    allPassed = false;
  }
}

process.exit(allPassed ? 0 : 1);
