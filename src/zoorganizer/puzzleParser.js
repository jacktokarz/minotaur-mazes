/**
 * Parser for zoOrganizer puzzle files (puzzles/zoorganizer/*.txt).
 *
 * This runs at build time (scripts/build-zoo-puzzles.mjs), so mistakes in a
 * puzzle file stop the build with a clear message instead of breaking the
 * page for players. See puzzles/zoorganizer/README.md for the file format.
 */

/**
 * Ground types an enclosure can have, and the word shown on its sign.
 * Each has a tile in public/zoorganizer/tiles/terrain-<type>.png.
 */
export const TERRAIN_LABELS = {
  grass: "Grass",
  sand: "Sand",
  water: "Water",
  rock: "Rock",
  snow: "Snow",
  dirt: "Dirt",
  jungle: "Jungle",
};

export const TERRAINS = Object.keys(TERRAIN_LABELS);

/** Layout symbols that are not enclosures. */
export const SCENERY = {
  ".": "path",
  ",": "lawn",
  "^": "tree",
};

// Enclosures are identified by a capital letter; animals by a number.
const ENCLOSURE_ID = /^[A-Z]$/;
const SECTION_HEADER = /^\[\s*([a-z ]+?)\s*\]$/i;
const KNOWN_SECTIONS = new Set([
  "clues",
  "rules",
  "enclosures",
  "layout",
  "animals",
  "solution",
]);

export class PuzzleError extends Error {
  constructor(message, line) {
    super(line ? `Line ${line}: ${message}` : message);
    this.line = line;
  }
}

/** "Snow Leopard" -> "snow-leopard" (used for image filenames and solution checks). */
export function speciesKey(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitList(text) {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// ------------------------------------------------------------
// Splitting the file into header + sections
// ------------------------------------------------------------

function splitSections(text) {
  const header = [];
  const sections = [];
  let current = null;

  text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const line = { text: raw.trim(), number: index + 1 };

      // Lines starting with # are comments.
      if (line.text.startsWith("#")) {
        return;
      }

      const match = line.text.match(SECTION_HEADER);

      if (match) {
        const name = match[1].toLowerCase();

        if (!KNOWN_SECTIONS.has(name)) {
          throw new PuzzleError(
            `Unknown section "[${match[1]}]". ` +
              `Expected one of: ${[...KNOWN_SECTIONS].map((s) => `[${s}]`).join(", ")}.`,
            line.number
          );
        }

        current = { name, line: line.number, lines: [] };
        sections.push(current);
        return;
      }

      (current ? current.lines : header).push(line);
    });

  return { header, sections };
}

function onlySection(sections, name, required) {
  const matches = sections.filter((section) => section.name === name);

  if (matches.length > 1) {
    const why =
      name === "solution"
        ? " Every puzzle must have exactly one solution."
        : "";
    throw new PuzzleError(`The [${name}] section appears more than once.${why}`, matches[1].line);
  }

  if (required && matches.length === 0) {
    throw new PuzzleError(`The puzzle needs a [${name}] section.`);
  }

  return matches[0] ?? null;
}

const nonBlank = (lines) => lines.filter((line) => line.text !== "");

// ------------------------------------------------------------
// Individual sections
// ------------------------------------------------------------

function parseHeader(lines) {
  const settings = {};

  for (const line of nonBlank(lines)) {
    const match = line.text.match(/^([a-z-]+)\s*:\s*(.*)$/i);

    if (!match) {
      throw new PuzzleError(
        `Expected a setting like "title: My Zoo" before the first [section], ` +
          `but found "${line.text}".`,
        line.number
      );
    }

    const key = match[1].toLowerCase();

    if (!["title", "post", "post-text", "signs"].includes(key)) {
      throw new PuzzleError(
        `Unknown setting "${match[1]}". Expected title, post, post-text or signs.`,
        line.number
      );
    }

    settings[key] = { value: match[2].trim(), line: line.number };
  }

  const signs = settings.signs?.value.toLowerCase() ?? "on";

  if (!["on", "off"].includes(signs)) {
    throw new PuzzleError(`"signs" must be "on" or "off".`, settings.signs.line);
  }

  const post = settings.post?.value || null;

  if (post && !/^https?:\/\//i.test(post)) {
    throw new PuzzleError(`"post" must be a full link starting with https://`, settings.post.line);
  }

  return {
    title: settings.title?.value || null,
    post,
    postText: settings["post-text"]?.value || null,
    signs: signs === "on",
  };
}

function parseClues(section) {
  return nonBlank(section.lines).map((line) =>
    // Allow "- clue", "* clue" or "1. clue" list styles.
    line.text.replace(/^([-*\u2022]|\d+[.)])\s+/, "")
  );
}

function parseEnclosures(section) {
  const enclosures = [];

  for (const line of nonBlank(section.lines)) {
    const match = line.text.match(/^([^:]+):\s*(.*)$/);

    if (!match) {
      throw new PuzzleError(
        `Expected an enclosure like "A: grass", found "${line.text}".`,
        line.number
      );
    }

    const id = match[1].trim();
    const terrainText = match[2].trim();
    const terrain = terrainText.toLowerCase();

    if (!ENCLOSURE_ID.test(id)) {
      throw new PuzzleError(
        `Enclosure IDs must be a single capital letter (A-Z), found "${id}".`,
        line.number
      );
    }

    if (terrainText.includes(",")) {
      throw new PuzzleError(
        `Write just the ground type, like "${id}: ${terrainText.split(",")[0].trim()}". ` +
          "Each enclosure's sign shows its ground type automatically.",
        line.number
      );
    }

    if (!TERRAINS.includes(terrain)) {
      throw new PuzzleError(
        `Enclosure ${id} has unknown ground "${terrainText}". ` +
          `Choose one of: ${TERRAINS.join(", ")}.`,
        line.number
      );
    }

    if (enclosures.some((enclosure) => enclosure.id === id)) {
      throw new PuzzleError(`Enclosure ${id} is defined twice.`, line.number);
    }

    // The sign on each enclosure shows its ground type ("Sand", "Snow", ...).
    enclosures.push({ id, terrain, label: TERRAIN_LABELS[terrain], line: line.number });
  }

  if (enclosures.length === 0) {
    throw new PuzzleError("The [enclosures] section is empty.", section.line);
  }

  return enclosures;
}

function parseLayout(section, enclosures) {
  const rows = nonBlank(section.lines);

  if (rows.length === 0) {
    throw new PuzzleError("The [layout] section is empty.", section.line);
  }

  const width = rows[0].text.length;
  const ids = new Set(enclosures.map((enclosure) => enclosure.id));
  const grid = [];

  rows.forEach((row, y) => {
    if (row.text.length !== width) {
      throw new PuzzleError(
        `Layout row ${y + 1} has ${row.text.length} cells; expected ${width}. ` +
          "Every row must be the same length.",
        row.number
      );
    }

    grid.push(
      [...row.text].map((symbol, x) => {
        if (SCENERY[symbol]) {
          return symbol;
        }

        if (ids.has(symbol)) {
          return symbol;
        }

        const hint = ENCLOSURE_ID.test(symbol)
          ? `Enclosure ${symbol} is used in the layout but not listed in [enclosures].`
          : `Use enclosure letters (A-Z), "." (path), "," (lawn) or "^" (tree).`;

        throw new PuzzleError(
          `Unexpected "${symbol}" at column ${x + 1} of layout row ${y + 1}. ${hint}`,
          row.number
        );
      })
    );
  });

  // Every enclosure must appear, and its cells must be connected.
  for (const enclosure of enclosures) {
    const cells = [];

    grid.forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell === enclosure.id) cells.push([x, y]);
      })
    );

    if (cells.length === 0) {
      throw new PuzzleError(
        `Enclosure ${enclosure.id} is listed but never drawn in [layout].`,
        enclosure.line
      );
    }

    const seen = new Set([cells[0].join()]);
    const queue = [cells[0]];

    while (queue.length) {
      const [x, y] = queue.pop();

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${x + dx},${y + dy}`;

        if (grid[y + dy]?.[x + dx] === enclosure.id && !seen.has(key)) {
          seen.add(key);
          queue.push([x + dx, y + dy]);
        }
      }
    }

    if (seen.size !== cells.length) {
      throw new PuzzleError(
        `Enclosure ${enclosure.id} is split into separate pieces in [layout]. ` +
          "All of its cells must touch.",
        section.line
      );
    }
  }

  return { width, height: grid.length, grid: grid.map((row) => row.join("")) };
}

/**
 * [animals] lines look like "1: Fassa". Numbers start at 1 and go up by one,
 * so every animal has its own ID even when two animals share a name.
 */
function parseAnimals(section) {
  const animals = [];

  for (const line of nonBlank(section.lines)) {
    const match = line.text.match(/^(\d+)\s*:\s*(.*)$/);

    if (!match) {
      throw new PuzzleError(
        `Expected a numbered animal like "${animals.length + 1}: Lion", found "${line.text}".`,
        line.number
      );
    }

    const id = Number(match[1]);
    const name = match[2].trim();
    const expected = animals.length + 1;

    if (id !== expected) {
      throw new PuzzleError(
        `Animal numbers must start at 1 and go up by one. Expected ${expected} here, found ${id}.`,
        line.number
      );
    }

    if (!name || !speciesKey(name)) {
      throw new PuzzleError(`Animal ${id} needs a name, like "${id}: Lion".`, line.number);
    }

    animals.push({ id, name, species: speciesKey(name) });
  }

  if (animals.length === 0) {
    throw new PuzzleError("The [animals] section is empty.", section.line);
  }

  return animals;
}

/**
 * [solution] lines look like "C: 4, 6": an enclosure letter and the numbers
 * of the animals that belong there. Returns { enclosureId: [species, ...] }.
 */
function parseSolution(section, enclosures, animals) {
  const ids = new Set(enclosures.map((enclosure) => enclosure.id));
  const animalById = new Map(animals.map((animal) => [animal.id, animal]));
  const placement = Object.fromEntries(enclosures.map((e) => [e.id, []]));
  const listed = new Set();
  const placedAt = new Map(); // animal id -> line number
  const assignment = {};      // animal id -> enclosure id

  for (const line of nonBlank(section.lines)) {
    const match = line.text.match(/^([^:]+):\s*(.*)$/);

    if (!match) {
      throw new PuzzleError(
        `Expected a line like "A: 1, 2" (or "A:" for an empty enclosure), found "${line.text}".`,
        line.number
      );
    }

    const id = match[1].trim();

    if (!ids.has(id)) {
      throw new PuzzleError(`The solution uses enclosure "${id}", which is not listed in [enclosures].`, line.number);
    }

    if (listed.has(id)) {
      throw new PuzzleError(`Enclosure ${id} appears twice in the [solution].`, line.number);
    }

    listed.add(id);

    for (const item of splitList(match[2])) {
      if (!/^\d+$/.test(item)) {
        throw new PuzzleError(
          `Use animal numbers in the solution (e.g. "${id}: 1, 2"), found "${item}".`,
          line.number
        );
      }

      const animal = animalById.get(Number(item));

      if (!animal) {
        throw new PuzzleError(`The solution uses animal ${item}, which is not in [animals].`, line.number);
      }

      if (placedAt.has(animal.id)) {
        throw new PuzzleError(
          `Animal ${animal.id} (${animal.name}) is placed twice in the [solution].`,
          line.number
        );
      }

      placedAt.set(animal.id, line.number);
      placement[id].push(animal.species);
      assignment[animal.id] = id;
    }
  }

  const missing = animals.filter((animal) => !placedAt.has(animal.id));

  if (missing.length) {
    throw new PuzzleError(
      "The [solution] must place every animal. Missing: " +
        missing.map((animal) => `${animal.id} (${animal.name})`).join(", ") + ".",
      section.line
    );
  }

  return { placement, assignment };
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * Parse a puzzle file.
 * @param {string} text      File contents
 * @param {string} name      Puzzle name (filename without .txt)
 * @returns puzzle data, including the plain-text `solution` (build time only)
 */
export function parsePuzzle(text, name) {
  const { header, sections } = splitSections(text);
  const settings = parseHeader(header);

  const enclosures = parseEnclosures(onlySection(sections, "enclosures", true));
  const layout = parseLayout(onlySection(sections, "layout", true), enclosures);
  const animals = parseAnimals(onlySection(sections, "animals", true));
  const clues = parseClues(onlySection(sections, "clues", true));
  // Exactly one [solution] section: every puzzle has exactly one answer.
  const { placement: solution, assignment: solutionById } = parseSolution(
    onlySection(sections, "solution", true),
    enclosures,
    animals
  );

  // [rules] (optional): the clues written in a form `npm run zoo-test` can
  // check. They are interpreted by scripts/zoo/rules.mjs, not published.
  const rulesSection = onlySection(sections, "rules", false);

  return {
    name,
    title: settings.title ?? name,
    post: settings.post,
    postText: settings.postText,
    signs: settings.signs,
    clues,
    ...layout,
    enclosures: enclosures.map(({ id, terrain, label }) => ({ id, terrain, label })),
    animals,
    solution,
    solutionById,
    rules: rulesSection ? nonBlank(rulesSection.lines) : null,
  };
}
