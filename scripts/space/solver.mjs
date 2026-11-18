/**
 * Solves a Space Roundup puzzle by trying every move from every position the
 * player can reach. Used by `npm run space-test`.
 */
import { DIRECTIONS, fly, startState } from "../../src/space-roundup/rules.js";

const keyOf = (state) => `${state.player.x},${state.player.y}|${[...state.collected].sort((a, b) => a - b).join(",")}`;

/**
 * @returns {{
 *   solution: string[] | null,  shortest list of moves that wins (null: can't be won)
 *   reachable: number,          positions the player can get into
 *   deadEnds: number,           reachable positions from which winning is impossible
 *   deadEndExample: string[] | null   moves that lead into a dead end, if any
 * }}
 */
export function solve(puzzle) {
  const start = startState(puzzle);
  const seen = new Map([[keyOf(start), { state: start, from: null, move: null }]]);
  const edges = new Map(); // key -> [next keys]
  const queue = [keyOf(start)];
  let winKey = null;

  while (queue.length) {
    const key = queue.shift();
    const { state } = seen.get(key);
    const next = [];

    for (const direction of Object.keys(DIRECTIONS)) {
      const result = fly(puzzle, state, direction);
      if (!result.moved) continue;

      const nextKey = result.state.won ? "WIN" : keyOf(result.state);
      next.push(nextKey);

      if (!seen.has(nextKey)) {
        seen.set(nextKey, { state: result.state, from: key, move: direction });
        if (nextKey === "WIN") winKey ??= nextKey;
        else queue.push(nextKey);
      }
    }
    edges.set(key, next);
  }

  const pathTo = (key) => {
    const moves = [];
    for (let node = seen.get(key); node.from !== null; node = seen.get(node.from)) moves.unshift(node.move);
    return moves;
  };

  // Positions that can still win: work backwards from WIN.
  const canWin = new Set(["WIN"]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, next] of edges) {
      if (!canWin.has(key) && next.some((n) => canWin.has(n))) {
        canWin.add(key);
        changed = true;
      }
    }
  }

  const positions = [...edges.keys()];
  const dead = positions.filter((key) => !canWin.has(key));

  return {
    solution: winKey ? pathTo(winKey) : null,
    reachable: positions.length,
    deadEnds: dead.length,
    deadEndExample: dead.length ? pathTo(dead[0]) : null,
  };
}
