
/**
 * Parse a plain-text Minotaur maze.
 *
 * Symbols:
 *   # = wall
 *   . = walkable floor
 *   T = Theseus (exactly one)
 *   M = Minotaur (one or more)
 *   E = exit / portal (one or more)
 */

const VALID_SYMBOLS = new Set(["#", ".", "T", "M", "E"]);

export function parseMapText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("The map is empty.");
  }

  // Ignore blank lines at the beginning/end, but preserve the grid.
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim());

  const width = lines[0].length;

  if (width === 0) {
    throw new Error("The map has no columns.");
  }

  // All rows must be rectangular.
  for (let y = 0; y < lines.length; y += 1) {
    if (lines[y].length !== width) {
      throw new Error(
        `Row ${y + 1} has ${lines[y].length} cells; ` +
        `expected ${width}. Check that every row has equal length.`
      );
    }
  }

  const tiles = [];
  const theseusPositions = [];
  const minotaurs = [];
  const exits = [];

  for (let y = 0; y < lines.length; y += 1) {
    const row = [];

    for (let x = 0; x < width; x += 1) {
      const symbol = lines[y][x];

      if (!VALID_SYMBOLS.has(symbol)) {
        throw new Error(
          `Invalid symbol "${symbol}" at column ${x + 1}, ` +
          `row ${y + 1}. Allowed symbols: # . T M E`
        );
      }

      switch (symbol) {
        case "#":
          row.push("wall");
          break;

        case ".":
          row.push("floor");
          break;

        case "T":
          row.push("floor");
          theseusPositions.push({ x, y });
          break;

        case "M":
          row.push("floor");
          minotaurs.push({ x, y });
          break;

        case "E":
          row.push("floor");
          exits.push({ x, y });
          break;
      }
    }

    tiles.push(row);
  }

  // Exactly one Theseus is required.
  if (theseusPositions.length === 0) {
    throw new Error("The map must contain one Theseus (T).");
  }

  if (theseusPositions.length > 1) {
    throw new Error(
      `The map contains ${theseusPositions.length} Theseus ` +
      "starting positions. Only one T is allowed."
    );
  }

  // One or more Minotaurs are allowed.
  if (minotaurs.length === 0) {
    throw new Error("The map must contain at least one Minotaur (M).");
  }

  // One or more exits are allowed.
  if (exits.length === 0) {
    throw new Error("The map must contain at least one exit (E).");
  }

  return {
    width,
    height: lines.length,
    tiles,
    theseus: theseusPositions[0],
    minotaurs,
    exits,
  };
}

/**
 * Load and parse a map stored in a text file.
 *
 * Example:
 *   const map = await loadMapText("/maps/example.txt");
 */
export async function loadMapText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Could not load map "${url}": HTTP ${response.status}.`
    );
  }

  const text = await response.text();
  return parseMapText(text);
}
