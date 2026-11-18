/**
 * Finds every firing order that solves a Mirror Maze (Rotation) puzzle.
 * Used by `npm run mirror-test`.
 *
 * Tries the pairs in every order, dropping an order as soon as one of its
 * shots fails, and keeps the orders where every pair connects.
 */
import { fireShot, turnMirror } from "../../src/mirror-maze/light.js";

/** The mirrors printed in the grid: "x,y" -> "/" | "\\". */
export function startingMirrors(puzzle) {
  const mirrors = new Map();
  puzzle.grid.forEach((row, y) =>
    [...row].forEach((symbol, x) => {
      if (symbol === "/" || symbol === "\\") mirrors.set(`${x},${y}`, symbol);
    })
  );
  return mirrors;
}

/**
 * @returns {{ orders: string[][], total: number, complete: boolean, doubleHits: boolean }}
 *   doubleHits: in some working order, a beam bounces off the same mirror
 *   twice in one turn (worth knowing: it still only flips once)
 */
export function findOrders(puzzle, { keep = 50, maxCount = 10_000 } = {}) {
  const pairs = [...new Set(puzzle.letters.map((letter) => letter.letter))].sort();
  const orders = [];
  let total = 0;
  let doubleHits = false;

  function search(mirrors, order, usedDouble) {
    if (total >= maxCount) return;

    if (order.length === pairs.length) {
      total += 1;
      doubleHits ||= usedDouble;
      if (orders.length < keep) orders.push([...order]);
      return;
    }

    for (const letter of pairs) {
      if (order.includes(letter)) continue;

      const shot = fireShot(puzzle, (x, y) => mirrors.get(`${x},${y}`) ?? null, letter);
      if (!shot.ok) continue;

      const next = new Map(mirrors);
      for (const key of shot.turns) next.set(key, turnMirror(next.get(key)));

      order.push(letter);
      search(next, order, usedDouble || shot.turns.length < shot.bounces.length);
      order.pop();
    }
  }

  search(startingMirrors(puzzle), [], false);
  return { orders, total, complete: total < maxCount, doubleHits };
}
