/**
 * Space Roundup: how the player moves. Shared by the game page and by
 * `npm run space-test`, so the rules only live in one place.
 *
 * The rules:
 *   - The player picks a direction and flies as far as they can, stopping
 *     when the next square is a wall, a friend, a locked exit or the edge of
 *     the maze.
 *   - Flying into a friend collects it: the player stops in the square before
 *     it, and the friend joins them (it leaves the board).
 *   - The exit is locked until every friend has been collected. While it's
 *     locked it stops the player like a wall; once it's open, flying into it
 *     (or across it) takes the player out of the maze, and they win.
 */

export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** The starting state of a puzzle. */
export function startState(puzzle) {
  return {
    player: { ...puzzle.start },
    collected: [],   // indexes into puzzle.friends, in the order collected
    moves: 0,
    won: false,
  };
}

/**
 * Fly in one direction.
 *
 * @param puzzle  Parsed puzzle ({ width, height, grid, start, friends, exits })
 * @param state   From startState() or a previous move
 * @param {"up" | "down" | "left" | "right"} direction
 * @returns {{
 *   state,                 the new state (the old one isn't changed)
 *   path: {x, y}[],        squares flown through, starting where the player was
 *   moved: boolean,        false if nothing happened (blocked straight away)
 *   stoppedBy: "wall" | "edge" | "friend" | "locked-exit" | "exit",
 *   friend: number | null  the friend collected by this move, if any
 * }}
 */
export function fly(puzzle, state, direction) {
  const step = DIRECTIONS[direction];
  const collected = new Set(state.collected);
  const friendAt = new Map(puzzle.friends.map((friend, index) => [`${friend.x},${friend.y}`, index]));
  const isExit = (x, y) => puzzle.exits.some((exit) => exit.x === x && exit.y === y);
  const allFound = collected.size === puzzle.friends.length;

  let { x, y } = state.player;
  const path = [{ x, y }];
  let stoppedBy;
  let friend = null;

  for (;;) {
    const nx = x + step.x;
    const ny = y + step.y;

    if (nx < 0 || ny < 0 || nx >= puzzle.width || ny >= puzzle.height) {
      stoppedBy = "edge";
      break;
    }

    if (puzzle.grid[ny][nx] === "#") {
      stoppedBy = "wall";
      break;
    }

    const friendIndex = friendAt.get(`${nx},${ny}`);
    if (friendIndex !== undefined && !collected.has(friendIndex)) {
      stoppedBy = "friend";
      friend = friendIndex;
      break;
    }

    if (isExit(nx, ny)) {
      if (!allFound) {
        stoppedBy = "locked-exit";
        break;
      }
      x = nx;
      y = ny;
      path.push({ x, y });
      stoppedBy = "exit";
      break;
    }

    x = nx;
    y = ny;
    path.push({ x, y });
  }

  const moved = path.length > 1 || friend !== null;

  return {
    state: {
      player: { x, y },
      collected: friend === null ? state.collected : [...state.collected, friend],
      moves: state.moves + (moved ? 1 : 0),
      won: stoppedBy === "exit",
    },
    path,
    moved,
    stoppedBy,
    friend,
  };
}
