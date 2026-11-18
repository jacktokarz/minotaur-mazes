/**
 * Parser for Space Roundup puzzle files (puzzles/space-roundup/*.txt).
 *
 * Runs at build time (scripts/build-space-puzzles.mjs), so a mistake in a
 * puzzle file stops the build with the file name and line number.
 * See puzzles/space-roundup/README.md for the file format.
 *
 * A file is a grid, optionally followed by [info] and [hints]:
 *
 *   #########
 *   #P..#..F#
 *   ...
 *
 *   [info]
 *   title: Test
 *
 *   [hints]
 *   minor: ...
 *   major: ...
 */

import { parseHintSection } from "../shared/hintSection.js";

export const SYMBOLS = {
  "#": "wall",   // an asteroid: stops the player
  ".": "space",  // empty space
  P: "player",   // where the player starts (exactly one)
  F: "friend",   // a friend to collect (one or more)
  E: "exit",     // the way out, locked until every friend is collected (one or more)
};

const SECTION_HEADER = /^\[\s*([a-z-]+)\s*\]$/i;
const KNOWN_SECTIONS = new Set(["info", "hints"]);
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
          fail(`Unknown section "[${header[1]}]". Expected [info] or [hints].`, line.number);
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
  let rows = [...lines];
  while (rows.length && !rows[0].text.trim()) rows.shift();
  while (rows.length && !rows.at(-1).text.trim()) rows.pop();

  if (rows.length === 0) fail("The file needs a grid before any [section].");

  const blank = rows.find((row) => !row.text.trim());
  if (blank) fail("The grid can't have a blank line in the middle.", blank.number);

  const width = rows[0].text.length;
  const found = { P: [], F: [], E: [] };

  rows.forEach((row, y) => {
    if (row.text.length !== width) {
      fail(
        `Grid row ${y + 1} has ${row.text.length} squares; expected ${width}. ` +
          "Every row must be the same length.",
        row.number
      );
    }

    [...row.text].forEach((symbol, x) => {
      if (!SYMBOLS[symbol]) {
        fail(
          `Unexpected "${symbol}" at column ${x + 1} of grid row ${y + 1}. ` +
            'Use "#" (wall), "." (space), "P" (player), "F" (friend) or "E" (exit).',
          row.number
        );
      }
      if (found[symbol]) found[symbol].push({ x, y, line: row.number });
    });
  });

  if (found.P.length !== 1) {
    fail(
      found.P.length === 0
        ? 'The grid needs a "P" where the player starts.'
        : `The grid has ${found.P.length} "P"s; there must be exactly one player.`,
      found.P[1]?.line ?? rows[0].number
    );
  }
  if (found.F.length === 0) fail('The grid needs at least one friend ("F").', rows[0].number);
  if (found.E.length === 0) fail('The grid needs at least one exit ("E").', rows[0].number);

  const strip = ({ x, y }) => ({ x, y });

  return {
    width,
    height: rows.length,
    // Only walls matter for movement; the rest are listed separately.
    grid: rows.map((row) => row.text.replace(/[PFE]/g, ".")),
    start: strip(found.P[0]),
    friends: found.F.map(strip),
    exits: found.E.map(strip),
  };
}

function parseInfo(section) {
  const info = {};

  for (const line of section.lines) {
    const text = line.text.trim();
    if (!text) continue;

    const match = text.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    const key = match?.[1].toLowerCase();

    if (!match || !INFO_KEYS.includes(key)) {
      fail(`Expected a setting like "title: Test" (title, post or post-text), found "${text}".`, line.number);
    }
    if (key === "post" && !/^https?:\/\//i.test(match[2].trim())) {
      fail(`"post" must be a full link starting with https://`, line.number);
    }
    info[key] = match[2].trim() || null;
  }

  return info;
}

/**
 * Parse a Space Roundup puzzle file.
 *
 * @param {string} text  File contents
 * @param {string} name  Puzzle name (filename without .txt)
 */
export function parseSpacePuzzle(text, name) {
  const { grid: gridLines, sections } = splitFile(text);
  const grid = parseGrid(gridLines);

  const infoSection = sections.find((section) => section.name === "info");
  const hintsSection = sections.find((section) => section.name === "hints");
  const info = infoSection ? parseInfo(infoSection) : {};

  return {
    name,
    title: info.title ?? name,
    post: info.post ?? null,
    postText: info["post-text"] ?? null,
    ...grid,
    hints: hintsSection ? parseHintSection(hintsSection.lines, hintsSection.line, fail) : null,
  };
}
