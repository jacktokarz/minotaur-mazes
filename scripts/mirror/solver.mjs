/**
 * Finds every way to place mirrors so a Mirror Maze is solved.
 * Used by `npm run mirror-test`.
 *
 * It follows each beam from the edge letters. Whenever light reaches an
 * empty hallway square it tries all three options (no mirror, "/", "\"),
 * and gives up on a branch as soon as light hits a wall, leaves the grid,
 * or touches the wrong letter. Squares no light reaches are left empty, so
 * each solution lists only the mirrors that matter; mirrors anywhere else
 * can't change the result. Mirror limits ([limits]) are respected.
 */
import { DIRECTIONS, REFLECT, checkPuzzle } from "../../src/mirror-maze/light.js";

const LETTER = /^[A-Z]$/;

/**
 * @returns {{ solutions: Map<string, string>[], total: number, complete: boolean }}
 *   each solution maps "x,y" -> "/" | "\\" (only the mirrors that matter)
 */
export function findSolutions(puzzle, { keep = 50, maxCount = 10_000 } = {}) {
  const letterAt = new Map(puzzle.letters.map((letter) => [`${letter.x},${letter.y}`, letter]));
  const edgeLetters = puzzle.letters.filter((letter) => letter.edge);
  const decided = new Map(); // "x,y" -> "/" | "\\" | null (null = no mirror)
  const done = new Set();    // edge letters whose beam is already traced
  const solutions = [];
  let total = 0;

  const mirrorAt = (x, y) => decided.get(`${x},${y}`) ?? null;
  const used = { total: 0, "/": 0, "\\": 0 };
  const limits = puzzle.limits ?? { total: null, "/": null, "\\": null };
  const fits = (option) =>
    !option ||
    ((limits.total === null || used.total < limits.total) &&
      (limits[option] === null || used[option] < limits[option]));
  const stop = () => total >= maxCount;

  function nextBeam() {
    if (stop()) return;

    const start = edgeLetters.find((letter) => !done.has(letter));

    if (!start) {
      // Every beam lands on a matching letter; check the letters are all joined up.
      if (checkPuzzle(puzzle, mirrorAt).solved) {
        total += 1;
        if (solutions.length < keep) {
          solutions.push(new Map([...decided].filter(([, mirror]) => mirror)));
        }
      }
      return;
    }

    done.add(start);
    follow(start, start.x, start.y, start.dir);
    done.delete(start);
  }

  function follow(start, x, y, dir) {
    for (;;) {
      if (stop()) return;

      x += DIRECTIONS[dir].x;
      y += DIRECTIONS[dir].y;

      if (x < 0 || y < 0 || x >= puzzle.width || y >= puzzle.height) return; // lost
      const symbol = puzzle.grid[y][x];
      if (symbol === "#") return; // lost

      if (LETTER.test(symbol)) {
        // Light stops at the first letter it reaches; it must be a match.
        const letter = letterAt.get(`${x},${y}`);
        if (letter.letter !== start.letter) return; // wrong letter

        // An edge letter's own beam is this one in reverse, so it's done too.
        const wasDone = done.has(letter);
        if (letter.edge) done.add(letter);
        nextBeam();
        if (letter.edge && !wasDone) done.delete(letter);
        return;
      }

      if (REFLECT[symbol]) {
        dir = REFLECT[symbol][dir];
        continue;
      }

      const key = `${x},${y}`;

      if (decided.has(key)) {
        const mirror = decided.get(key);
        if (mirror) dir = REFLECT[mirror][dir];
        continue;
      }

      // A new square: try every option from here.
      for (const option of [null, "/", "\\"]) {
        if (!fits(option)) continue;
        decided.set(key, option);
        if (option) { used.total += 1; used[option] += 1; }
        follow(start, x, y, option ? REFLECT[option][dir] : dir);
        if (option) { used.total -= 1; used[option] -= 1; }
        decided.delete(key);
        if (stop()) return;
      }
      return;
    }
  }

  nextBeam();
  return { solutions, total, complete: total < maxCount };
}
