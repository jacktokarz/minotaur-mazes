/**
 * How light moves through a Mirror Maze, and whether a grid is solved.
 * Shared by every Mirror Maze variant, by the game page and by
 * `npm run mirror-test`, so the rules only live in one place.
 *
 * The rules:
 *   - Each letter on the edge of the grid shines one beam straight into the grid.
 *   - Light travels in straight lines through hallways (".").
 *   - Mirrors are double-sided and turn light 90 degrees:
 *       "/"  sends light going right upward, up -> right, left -> down, down -> left
 *       "\"  sends light going right downward, down -> right, left -> up, up -> left
 *   - Walls ("#") stop light, and light that leaves the grid is lost.
 *   - Light stops at the first letter it reaches, on the edge or inside the
 *     grid, connecting to it. (A letter inside the grid can be reached from
 *     any side, by several beams.)
 *
 * Solved when:
 *   1. every edge letter's beam ends at a letter of the same kind, and
 *   2. all copies of each letter are connected (directly, or through other
 *      copies of the same letter; e.g. two edge B's both shining into a B in
 *      the middle).
 * Mirrors that no light touches don't matter.
 */

export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const REFLECT = {
  "/": { right: "up", up: "right", left: "down", down: "left" },
  "\\": { right: "down", down: "right", left: "up", up: "left" },
};

export const MIRROR_TYPES = ["/", "\\"];

const LETTER = /^[A-Z]$/;

/**
 * Follow one beam from an edge letter.
 *
 * @param puzzle    Parsed puzzle ({ width, height, grid, letters })
 * @param mirrorAt  (x, y) => "/" | "\\" | null: the mirror on a square right
 *                  now. Where it returns null, a mirror printed in the grid
 *                  is used (so Placement only needs to report its own
 *                  mirrors, and Rotation reports the turned ones).
 * @param start     One of puzzle.letters (on the edge)
 * @returns {{
 *   start, points: {x, y}[], letters: object[],
 *   end: "letter" | "wall" | "outside", endLetter: object | null
 * }}
 *   points: the squares the beam passes through, in order (the first is the
 *   start letter). For "wall"/"outside", the last point is the wall square or
 *   the square just off the grid, so the beam can be drawn up to it.
 */
export function traceBeam(puzzle, mirrorAt, start) {
  const letterAt = new Map(puzzle.letters.map((letter) => [`${letter.x},${letter.y}`, letter]));
  const points = [{ x: start.x, y: start.y }];
  const touched = [start];

  let { x, y } = start;
  let dir = start.dir;

  // A beam from the edge can't go round in circles (light paths are
  // reversible), but cap the length just in case.
  const maxSteps = puzzle.width * puzzle.height * 4 + 4;

  for (let step = 0; step < maxSteps; step += 1) {
    x += DIRECTIONS[dir].x;
    y += DIRECTIONS[dir].y;

    if (x < 0 || y < 0 || x >= puzzle.width || y >= puzzle.height) {
      points.push({ x, y });
      return { start, points, letters: touched, end: "outside", endLetter: null };
    }

    const symbol = puzzle.grid[y][x];
    points.push({ x, y });

    if (symbol === "#") {
      return { start, points, letters: touched, end: "wall", endLetter: null };
    }

    if (LETTER.test(symbol)) {
      // Light stops at the first letter it reaches.
      const letter = letterAt.get(`${x},${y}`);
      touched.push(letter);
      return { start, points, letters: touched, end: "letter", endLetter: letter };
    }

    const mirror = mirrorAt(x, y) ?? (REFLECT[symbol] ? symbol : null);
    if (mirror) dir = REFLECT[mirror][dir];
  }

  return { start, points, letters: touched, end: "wall", endLetter: null };
}

/**
 * Shine every edge letter and check the rules.
 *
 * @returns {{ solved: boolean, beams: object[], problems: object[] }}
 *   beams: one per connection (a beam and its reverse are only listed once)
 *   problems: why it isn't solved, e.g.
 *     { type: "lost", letter }          the beam hits a wall or leaves the grid
 *     { type: "mixed", letters }        the beam ends at a different letter
 *     { type: "apart", letter }         not all copies of this letter are connected
 */
export function checkPuzzle(puzzle, mirrorAt) {
  const beams = [];
  const problems = [];
  const covered = new Set();
  const key = (letter) => `${letter.x},${letter.y}`;

  // Union-find over letters, joined by the beams that touch them.
  const parent = new Map(puzzle.letters.map((letter) => [key(letter), key(letter)]));
  const find = (k) => (parent.get(k) === k ? k : find(parent.get(k)));
  const join = (a, b) => parent.set(find(key(a)), find(key(b)));

  for (const letter of puzzle.letters.filter((entry) => entry.edge)) {
    if (covered.has(key(letter))) continue;

    const beam = traceBeam(puzzle, mirrorAt, letter);
    beams.push(beam);
    covered.add(key(letter));

    if (beam.endLetter) covered.add(key(beam.endLetter));

    if (beam.end !== "letter") {
      problems.push({ type: "lost", letter });
    }

    const kinds = new Set(beam.letters.map((entry) => entry.letter));
    if (kinds.size > 1) {
      problems.push({ type: "mixed", letters: [...kinds] });
    }

    for (const other of beam.letters) join(letter, other);
  }

  for (const kind of new Set(puzzle.letters.map((letter) => letter.letter))) {
    const copies = puzzle.letters.filter((letter) => letter.letter === kind);
    const groups = new Set(copies.map((letter) => find(key(letter))));

    if (groups.size > 1) {
      problems.push({ type: "apart", letter: kind });
    }
  }

  return { solved: problems.length === 0, beams, problems };
}

/**
 * Mirror Maze (Rotation): fire one pair (one turn).
 *
 * Every copy of the letter on the edge fires at once. When a beam reaches
 * another edge copy, that copy's beam would be the same path in reverse, so
 * it isn't fired again (a plain pair that connects shows one beam; one that
 * misses shows both ends' light). For a letter with a copy in the middle of
 * the grid, each edge copy's beam has to reach a matching letter.
 *
 * The mirrors stay put while the light travels: a mirror the light hits
 * twice is in the same position both times. At the end of the turn, every
 * mirror the light bounced off flips once (`turns`), however many times it
 * was hit.
 *
 * The turn succeeds if every beam ends at a matching letter and all copies
 * of the letter end up connected.
 *
 * @returns {{ ok: boolean, beams: object[], bounces: string[], turns: string[] }}
 *   bounces: "x,y" of each mirror the light bounced off, in order (a mirror
 *            hit twice is listed twice)
 *   turns:   the mirrors that flip at the end of the turn, each listed once
 */
export function fireShot(puzzle, mirrorAt, letter) {
  const copies = puzzle.letters.filter((entry) => entry.letter === letter);
  const key = (entry) => `${entry.x},${entry.y}`;
  const beams = [];
  const covered = new Set();

  for (const start of copies.filter((entry) => entry.edge)) {
    if (covered.has(key(start))) continue; // already lit by the other end's beam
    const beam = traceBeam(puzzle, mirrorAt, start);
    beams.push(beam);
    covered.add(key(start));
    if (beam.endLetter?.edge) covered.add(key(beam.endLetter));
  }

  const bounces = beams.flatMap((beam) =>
    beam.points
      .slice(1, beam.end === "letter" ? undefined : -1)
      .filter(({ x, y }) => mirrorAt(x, y) ?? REFLECT[puzzle.grid[y][x]])
      .map(({ x, y }) => `${x},${y}`)
  );

  // Connected: every beam ends at a matching letter, and the beams join up
  // every copy (union-find, as in checkPuzzle).
  const parent = new Map(copies.map((copy) => [key(copy), key(copy)]));
  const find = (k) => (parent.get(k) === k ? k : find(parent.get(k)));
  let ok = true;

  for (const beam of beams) {
    if (beam.end !== "letter" || beam.endLetter.letter !== letter) {
      ok = false;
      continue;
    }
    parent.set(find(key(beam.start)), find(key(beam.endLetter)));
  }

  ok &&= new Set(copies.map((copy) => find(key(copy)))).size === 1;

  return { ok, beams, bounces, turns: [...new Set(bounces)] };
}

/** The other way round: "/" <-> "\\". */
export function turnMirror(mirror) {
  return mirror === "/" ? "\\" : "/";
}
