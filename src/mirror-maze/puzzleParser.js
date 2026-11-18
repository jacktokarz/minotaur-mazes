/**
 * Parser for Mirror Maze puzzle files (puzzles/mirror-maze-<variant>/*.txt).
 *
 * Shared by every Mirror Maze variant. It runs at build time
 * (scripts/build-mirror-puzzles.mjs), so a mistake in a puzzle file stops the
 * build with the file name and line number instead of breaking the page.
 * See puzzles/mirror-maze-placement/README.md for the file format.
 *
 * A file is a grid, optionally followed by [info], [limits] and [hints]:
 *
 *   #C#.#.#
 *   B......
 *   ...
 *
 *   [info]
 *   title: Easier
 *   post: https://propuzz.substack.com/p/...
 *
 *   [limits]          (Placement only: how many mirrors the player may use)
 *   mirrors: 5
 *
 *   [hints]
 *   minor: ...
 *   major: ...
 *
 * Variants:
 *   "placement"  the player places mirrors in the hallways.
 *   "rotation"   the mirrors in the grid turn each time light bounces off
 *                them; the player picks the order the letters fire in.
 */

import { parseHintSection } from "../shared/hintSection.js";

/** What each grid symbol means. Letters A-Z are handled separately. */
export const SYMBOLS = {
  "#": "wall",    // blocks light, can't hold a mirror
  ".": "hallway", // light passes through; a mirror can go here
  "/": "mirror",  // a mirror that's already in place: bottom-left to top-right
  "\\": "mirror", // a mirror that's already in place: top-left to bottom-right
};

const LETTER = /^[A-Z]$/;
const SECTION_HEADER = /^\[\s*([a-z-]+)\s*\]$/i;
const KNOWN_SECTIONS = new Set(["info", "limits", "hints"]);
const INFO_KEYS = ["title", "post", "post-text"];

export class PuzzleError extends Error {
  constructor(message, line) {
    super(line ? `Line ${line}: ${message}` : message);
    this.line = line;
  }
}

const fail = (message, line) => {
  throw new PuzzleError(message, line);
};

/**
 * Which way an edge letter shines: into the grid, away from its edge.
 * Returns null for letters inside the grid, and "corner" for corners.
 */
function inwardDirection(x, y, width, height) {
  const sides = [
    y === 0 && "down",
    y === height - 1 && "up",
    x === 0 && "right",
    x === width - 1 && "left",
  ].filter(Boolean);

  if (sides.length > 1) return "corner";
  return sides[0] ?? null;
}

function splitFile(text) {
  const grid = [];
  const sections = [];
  let current = null;

  text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const line = { text: raw.trimEnd(), number: index + 1 };
      const header = line.text.trim().match(SECTION_HEADER);

      if (header) {
        const name = header[1].toLowerCase();

        if (!KNOWN_SECTIONS.has(name)) {
          fail(
            `Unknown section "[${header[1]}]". Expected [info], [limits] or [hints].`,
            line.number
          );
        }

        if (sections.some((section) => section.name === name)) {
          fail(`The [${name}] section appears more than once.`, line.number);
        }

        current = { name, line: line.number, lines: [] };
        sections.push(current);
        return;
      }

      (current ? current.lines : grid).push(line);
    });

  return { grid, sections };
}

function parseGrid(lines) {
  // Ignore blank lines before and after the grid.
  let rows = [...lines];
  while (rows.length && !rows[0].text.trim()) rows.shift();
  while (rows.length && !rows.at(-1).text.trim()) rows.pop();

  if (rows.length === 0) {
    fail("The file needs a grid before any [section].");
  }

  const blank = rows.find((row) => !row.text.trim());
  if (blank) {
    fail("The grid can't have a blank line in the middle.", blank.number);
  }

  const width = rows[0].text.length;

  rows.forEach((row, y) => {
    if (row.text.length !== width) {
      fail(
        `Grid row ${y + 1} has ${row.text.length} squares; expected ${width}. ` +
          "Every row must be the same length.",
        row.number
      );
    }

    [...row.text].forEach((symbol, x) => {
      if (!SYMBOLS[symbol] && !LETTER.test(symbol)) {
        fail(
          `Unexpected "${symbol}" at column ${x + 1} of grid row ${y + 1}. ` +
            'Use "#" (wall), "." (hallway), "/" or "\\" (mirror), or a capital letter A-Z.',
          row.number
        );
      }
    });
  });

  return { rows, width, height: rows.length };
}

function findLetters({ rows, width, height }) {
  const letters = [];
  const at = (x, y) => rows[y]?.text[x];

  rows.forEach((row, y) => {
    [...row.text].forEach((symbol, x) => {
      if (!LETTER.test(symbol)) return;

      const dir = inwardDirection(x, y, width, height);

      if (dir === "corner") {
        fail(
          `The letter ${symbol} at column ${x + 1} of grid row ${y + 1} is in a corner, ` +
            "so it's not clear which way its light goes. Move it off the corner.",
          row.number
        );
      }

      if (dir) {
        const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
        if (at(x + step[0], y + step[1]) === "#") {
          fail(
            `The letter ${symbol} at column ${x + 1} of grid row ${y + 1} faces a wall, ` +
              "so its light can never get out.",
            row.number
          );
        }
      }

      letters.push({ letter: symbol, x, y, edge: Boolean(dir), dir, line: row.number });
    });
  });

  if (letters.length === 0) {
    fail("The grid has no letters to connect.", rows[0].number);
  }

  const counts = {};
  for (const { letter } of letters) counts[letter] = (counts[letter] ?? 0) + 1;

  for (const [letter, count] of Object.entries(counts)) {
    if (count < 2) {
      const only = letters.find((entry) => entry.letter === letter);
      fail(`There is only one ${letter}, so it has nothing to connect to.`, only.line);
    }
  }

  // Light only starts at letters on the edge, so every letter needs at least
  // one copy there. (Copies inside the grid are where beams can end.)
  for (const letter of Object.keys(counts)) {
    if (!letters.some((entry) => entry.letter === letter && entry.edge)) {
      const first = letters.find((entry) => entry.letter === letter);
      fail(
        `None of the ${letter}'s are on the edge of the grid, so no light can reach them.`,
        first.line
      );
    }
  }

  return letters.map(({ line, ...letter }) => letter);
}

function parseInfo(section) {
  const info = {};

  for (const line of section.lines) {
    const text = line.text.trim();
    if (!text) continue;

    const match = text.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    const key = match?.[1].toLowerCase();

    if (!match || !INFO_KEYS.includes(key)) {
      fail(`Expected a setting like "title: Easier" (title, post or post-text), found "${text}".`, line.number);
    }

    if (key === "post" && !/^https?:\/\//i.test(match[2].trim())) {
      fail(`"post" must be a full link starting with https://`, line.number);
    }

    info[key] = match[2].trim() || null;
  }

  return info;
}

/**
 * [limits] lines: "mirrors: 5" (in total), "\ mirrors: 3", "/ mirrors: 2".
 * Returns { total, "\\": n, "/": n } with null for "no limit".
 */
function parseLimits(section) {
  const limits = { total: null, "\\": null, "/": null };

  for (const line of section.lines) {
    const text = line.text.trim();
    if (!text) continue;

    const match = text.match(/^(\\|\/)?\s*mirrors\s*:\s*(\d+)$/i);

    if (!match) {
      fail(
        `Expected a limit like "mirrors: 5", "\\ mirrors: 3" or "/ mirrors: 2", found "${text}".`,
        line.number
      );
    }

    const key = match[1] ?? "total";
    if (limits[key] !== null) {
      fail(`The ${match[1] ? `${match[1]} ` : ""}mirror limit is given twice.`, line.number);
    }
    limits[key] = Number(match[2]);
  }

  if (Object.values(limits).every((value) => value === null)) {
    fail("The [limits] section is empty.", section.line);
  }

  return limits;
}

/**
 * Parse a Mirror Maze puzzle file.
 *
 * @param {string} text     File contents
 * @param {string} name     Puzzle name (filename without .txt)
 * @param {"placement" | "rotation"} [variant]
 */
export function parseMirrorPuzzle(text, name, variant = "placement") {
  const { grid: gridLines, sections } = splitFile(text);
  const grid = parseGrid(gridLines);
  const letters = findLetters(grid);

  const infoSection = sections.find((section) => section.name === "info");
  const limitsSection = sections.find((section) => section.name === "limits");
  const hintsSection = sections.find((section) => section.name === "hints");
  const info = infoSection ? parseInfo(infoSection) : {};

  if (limitsSection && variant !== "placement") {
    fail("[limits] only applies to Mirror Maze (Placement) puzzles.", limitsSection.line);
  }

  if (variant === "rotation" && !grid.rows.some((row) => /[\/\\]/.test(row.text))) {
    fail("A Rotation maze needs at least one mirror (/ or \\) in the grid.", grid.rows[0].number);
  }

  return {
    name,
    title: info.title ?? name,
    post: info.post ?? null,
    postText: info["post-text"] ?? null,
    width: grid.width,
    height: grid.height,
    grid: grid.rows.map((row) => row.text),
    letters,
    limits: limitsSection ? parseLimits(limitsSection) : null,
    hints: hintsSection ? parseHintSection(hintsSection.lines, hintsSection.line, fail) : null,
  };
}
