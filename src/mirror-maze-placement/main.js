import puzzles from "./puzzles-index.json";
import { checkPuzzle } from "../mirror-maze/light.js";
import { createBoard } from "../mirror-maze/board.js";
import { renderSourceBanner } from "../shared/sourceBanner.js";
import { createHints } from "../shared/hints.js";
import { createStatus } from "../shared/status.js";
import "../shared/base.css";
import "../shared/game.css";
import "../mirror-maze/board.css";
import "./style.css";

// ------------------------------------------------------------
// Settings
// ------------------------------------------------------------

// Every URL for this puzzle type lives under this path, e.g. /mirror-maze-placement/Easier
const PAGE_PATH = "/mirror-maze-placement";
const DEFAULT_PUZZLE = "easier";

// Clicking a hallway square cycles through these (right-click goes backwards).
const CYCLE = [null, "/", "\\"];

const MIRROR_NAMES = {
  "/": "/ mirror",
  "\\": "\\ mirror",
};

const MESSAGES = {
  start: "Place mirrors to connect the matching letters, then press Check.",
  wrong: "Not quite right! Adjust your mirrors and check again.",
  won: (count) =>
    `Every letter is connected, using ${count} mirror${count === 1 ? "" : "s"}. You're so smart!`,
};

// ------------------------------------------------------------
// DOM elements
// ------------------------------------------------------------

const board = createBoard(document.querySelector(".mm-board-wrap"));
const gameTitle = document.querySelector("#game-title");
const checkButton = document.querySelector("#check-button");
const clearButton = document.querySelector("#clear-button");
const limitRule = document.querySelector("#limit-rule");
const countElements = {
  "\\": document.querySelector("#count-backslash"),
  "/": document.querySelector("#count-slash"),
  total: document.querySelector("#count-total"),
};

const setStatus = createStatus(document.querySelector("#game-status"));
const hints = createHints(document.querySelector("#hint-button"));

// ------------------------------------------------------------
// State
// ------------------------------------------------------------

let puzzle = null;
let mirrors = new Map(); // "x,y" -> "/" | "\\"  (only the ones the player placed)

const keyOf = (x, y) => `${x},${y}`;

function mirrorAt(x, y) {
  return mirrors.get(keyOf(x, y)) ?? null;
}

function describeSquare(x, y, type) {
  return `Row ${y + 1}, column ${x + 1}: ${type ? MIRROR_NAMES[type] : "empty"}`;
}

// ------------------------------------------------------------
// Mirror limits ([limits] in the puzzle file)
// ------------------------------------------------------------

function counts(map = mirrors) {
  const values = [...map.values()];
  return {
    "\\": values.filter((type) => type === "\\").length,
    "/": values.filter((type) => type === "/").length,
    total: values.length,
  };
}

/** Would putting `type` on this square stay within the limits? */
function allowed(x, y, type) {
  if (!type || !puzzle.limits) return true;

  const after = new Map(mirrors);
  after.set(keyOf(x, y), type);
  const used = counts(after);

  return ["total", "\\", "/"].every(
    (key) => puzzle.limits[key] === null || used[key] <= puzzle.limits[key]
  );
}

/** e.g. "at most 5 mirrors" or "at most 3 \ mirrors and 2 / mirrors". */
function describeLimits(limits) {
  const parts = [];
  if (limits["\\"] !== null) parts.push(`${limits["\\"]} \\ mirror${limits["\\"] === 1 ? "" : "s"}`);
  if (limits["/"] !== null) parts.push(`${limits["/"]} / mirror${limits["/"] === 1 ? "" : "s"}`);

  const each = parts.join(" and ");
  if (limits.total === null) return `at most ${each}`;

  const total = `${limits.total} mirror${limits.total === 1 ? "" : "s"}`;
  return each ? `at most ${total} in total (and no more than ${each})` : `at most ${total}`;
}

function limitMessage() {
  return `That's the limit: ${describeLimits(puzzle.limits)}.`;
}

function showLimitRule() {
  limitRule.hidden = !puzzle.limits;
  if (puzzle.limits) {
    limitRule.replaceChildren(
      Object.assign(document.createElement("strong"), { textContent: "Mirror limit: " }),
      `in this maze you can use ${describeLimits(puzzle.limits)}.`
    );
  }
}

// ------------------------------------------------------------
// Drawing
// ------------------------------------------------------------

function buildBoard() {
  board.build(puzzle, { hallwayButtons: true });

  for (const button of board.element.querySelectorAll("button.mm-floor")) {
    button.setAttribute("aria-label", describeSquare(Number(button.dataset.x), Number(button.dataset.y), null));
  }
  for (const square of board.element.querySelectorAll(".mm-letter")) {
    square.setAttribute(
      "aria-label",
      `Row ${Number(square.dataset.y) + 1}, column ${Number(square.dataset.x) + 1}: letter ${square.dataset.letter}`
    );
  }
  for (const square of board.element.querySelectorAll(".mm-fixed")) {
    const { x, y } = square.dataset;
    square.setAttribute(
      "aria-label",
      `Row ${Number(y) + 1}, column ${Number(x) + 1}: ${MIRROR_NAMES[puzzle.grid[y][x]]} (part of the puzzle)`
    );
  }
}

function updateCounter() {
  const used = counts();
  const limits = puzzle?.limits ?? { total: null, "\\": null, "/": null };

  for (const key of ["\\", "/"]) {
    countElements[key].textContent = limits[key] === null ? used[key] : `${used[key]} / ${limits[key]}`;
  }

  countElements.total.parentElement.hidden = limits.total === null;
  countElements.total.textContent = `${used.total} / ${limits.total}`;
}

// ------------------------------------------------------------
// Placing mirrors
// ------------------------------------------------------------

function atLimitNow() {
  if (!puzzle.limits) return false;
  const used = counts();
  return puzzle.limits.total !== null && used.total === puzzle.limits.total;
}

function setMirror(x, y, type) {
  if ((mirrorAt(x, y) ?? null) === type) return;

  if (!allowed(x, y, type)) {
    setStatus(limitMessage(), "warning");
    return;
  }

  if (type) mirrors.set(keyOf(x, y), type);
  else mirrors.delete(keyOf(x, y));

  board.showMirror(x, y, type);
  board.square(x, y).setAttribute("aria-label", describeSquare(x, y, type));
  board.clearLight();
  updateCounter();

  if (type && atLimitNow()) {
    setStatus(`That's all ${puzzle.limits.total} mirrors.`);
  } else {
    setStatus(MESSAGES.start);
  }
}

/** Next mirror type in the cycle that the limits allow (skipping the others). */
function cycleMirror(x, y, step = 1) {
  const current = mirrorAt(x, y);
  let index = CYCLE.indexOf(current);

  for (let tries = 0; tries < CYCLE.length; tries += 1) {
    index = (index + step + CYCLE.length) % CYCLE.length;
    const type = CYCLE[index];

    if (allowed(x, y, type)) {
      // From an empty square, if nothing is allowed we end up back at empty.
      if (type === null && current === null) break;
      setMirror(x, y, type);
      return;
    }
  }

  setStatus(limitMessage(), "warning");
}

function squareFromEvent(event) {
  const square = event.target.closest?.("button.mm-floor");
  return square ? { x: Number(square.dataset.x), y: Number(square.dataset.y) } : null;
}

board.element.addEventListener("click", (event) => {
  const square = squareFromEvent(event);
  if (square) cycleMirror(square.x, square.y);
});

// Right-click turns the other way.
board.element.addEventListener("contextmenu", (event) => {
  const square = squareFromEvent(event);
  if (!square) return;
  event.preventDefault();
  cycleMirror(square.x, square.y, -1);
});

board.element.addEventListener("keydown", (event) => {
  const square = squareFromEvent(event);
  if (!square) return;

  const type = { "/": "/", "\\": "\\", Delete: null, Backspace: null }[event.key];
  if (type === undefined) return;

  event.preventDefault();
  setMirror(square.x, square.y, type);
});

// ------------------------------------------------------------
// Check and clear
// ------------------------------------------------------------

function checkMirrors() {
  if (!puzzle) return;

  const result = checkPuzzle(puzzle, mirrorAt);

  // Show where the light goes either way; wrong beams get a red cross.
  board.drawLight(result.beams);

  if (result.solved) {
    setStatus(MESSAGES.won(mirrors.size), "won");
  } else {
    setStatus(MESSAGES.wrong, "lost");
  }
}

function clearMirrors() {
  if (!puzzle) return;

  for (const key of mirrors.keys()) {
    const [x, y] = key.split(",").map(Number);
    board.showMirror(x, y, null);
    board.square(x, y).setAttribute("aria-label", describeSquare(x, y, null));
  }

  mirrors = new Map();
  board.clearLight();
  updateCounter();
  setStatus(MESSAGES.start);
}

checkButton.addEventListener("click", checkMirrors);
clearButton.addEventListener("click", clearMirrors);

// ------------------------------------------------------------
// Routing and loading
// ------------------------------------------------------------

function findPuzzleByName(name) {
  return puzzles.find((entry) => entry.name.toLowerCase() === name?.toLowerCase());
}

function getRequestedPuzzleName() {
  const pathname = location.pathname.startsWith(PAGE_PATH)
    ? location.pathname.slice(PAGE_PATH.length)
    : location.pathname;
  const segment = pathname.split("/").filter(Boolean).pop();

  if (!segment) return null;

  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function updateAddress(name) {
  const url = `${PAGE_PATH}/${encodeURIComponent(name)}`;
  if (location.pathname !== url) history.replaceState({ name }, "", url);
}

async function selectPuzzle(name, { updateHistory = true } = {}) {
  const definition = findPuzzleByName(name);

  if (!definition) {
    setStatus(`Puzzle "${name}" was not found.`, "error");
    return;
  }

  try {
    setStatus("Loading the maze…");

    const response = await fetch(definition.data);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    puzzle = await response.json();
    mirrors = new Map();

    gameTitle.textContent = puzzle.title;
    document.title = `${puzzle.title} · Mirror Maze (Placement)`;

    renderSourceBanner(
      puzzle.post ? { url: puzzle.post, text: puzzle.postText ?? undefined } : null,
      "Read the original post for more puzzles."
    );

    showLimitRule();
    buildBoard();
    updateCounter();
    setStatus(MESSAGES.start);
    hints.load(puzzle.hints ?? null);

    if (updateHistory) updateAddress(definition.name);
  } catch (error) {
    console.error(error);
    setStatus(`Could not load puzzle: ${error.message}`, "error");
  }
}

function startingPuzzle() {
  const requested = getRequestedPuzzleName();
  if (findPuzzleByName(requested)) return requested;
  if (findPuzzleByName(DEFAULT_PUZZLE)) return DEFAULT_PUZZLE;
  return puzzles[0]?.name ?? null;
}

window.addEventListener("popstate", () => {
  const name = startingPuzzle();
  if (name) selectPuzzle(name, { updateHistory: false });
});

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------

const first = startingPuzzle();

if (first) {
  selectPuzzle(first, { updateHistory: !getRequestedPuzzleName() });
} else {
  setStatus("There are no Mirror Maze puzzles yet.", "error");
}
