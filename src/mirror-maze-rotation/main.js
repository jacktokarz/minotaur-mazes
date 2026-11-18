import puzzles from "./puzzles-index.json";
import { fireShot, turnMirror } from "../mirror-maze/light.js";
import { createBoard } from "../mirror-maze/board.js";
import { iconName, iconPlural, iconSvg } from "../mirror-maze/icons.js";
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

// Every URL for this puzzle type lives under this path, e.g. /mirror-maze-rotation/Easier
const PAGE_PATH = "/mirror-maze-rotation";
const DEFAULT_PUZZLE = "easier";

function ordinal(n) {
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th";
  return `${n}${suffix}`;
}

const capital = (text) => text[0].toUpperCase() + text.slice(1);

const MESSAGES = {
  numbering: (done, total) =>
    done === total
      ? "Ready! Press Check."
      : `Number the pairs in firing order (${done} of ${total}).`,
  firing: (letter) => `Firing the ${iconPlural(letter)}…`,
  connected: (letter) => `${capital(iconPlural(letter))} connected! Continue to turn the mirrors.`,
  connectedNoMirrors: (letter, next) =>
    `${capital(iconPlural(letter))} connected! Continue to fire the ${iconPlural(next)}.`,
  turned: (next) => `Mirrors turned. Continue to fire the ${iconPlural(next)}.`,
  failed: (letter) => `Not quite right! The ${iconPlural(letter)} missed.`,
  renumber: (from, to) =>
    from === to
      ? `Number ${from} cleared. Pick again, then Check.`
      : `Numbers ${from}–${to} cleared. Pick again, then Check.`,
  won: (total) => `All ${total} pairs connected. You're so smart!`,
};

// ------------------------------------------------------------
// DOM elements
// ------------------------------------------------------------

const board = createBoard(document.querySelector(".mm-board-wrap"));
const gameTitle = document.querySelector("#game-title");
const orderSlots = document.querySelector("#order-slots");
const checkButton = document.querySelector("#check-button");
const continueButton = document.querySelector("#continue-button");
const clearButton = document.querySelector("#clear-button");

const setStatus = createStatus(document.querySelector("#game-status"));
const hints = createHints(document.querySelector("#hint-button"));

// ------------------------------------------------------------
// State
// ------------------------------------------------------------

let puzzle = null;
let pairs = [];                 // letters, e.g. ["A", "B", ...]
let startMirrors = new Map();   // "x,y" -> "/" | "\\" as printed in the puzzle
let mirrors = new Map();        // the mirrors right now
let order = new Map();          // letter -> firing number (1, 2, ...)

// Each turn: the light travels, the player presses Continue, the mirrors the
// light bounced off turn, the player presses Continue, the next pair fires.
//   "numbering"  choosing the order
//   "busy"       light or mirrors animating
//   "lit"        a shot connected; Continue turns its mirrors
//   "turned"     mirrors turned; Continue fires the next pair
//   "failed"     a shot missed; Continue goes back to numbering
//   "solved"     every pair connected
let mode = "numbering";
// { sequence: [letters], step: index of the next shot, current: index of the
//   shot on show, turning: ["x,y"] mirrors to flip at the end of this turn }
let run = null;

const keyOf = (x, y) => `${x},${y}`;

function mirrorAt(x, y) {
  return mirrors.get(keyOf(x, y)) ?? null;
}

// ------------------------------------------------------------
// Drawing
// ------------------------------------------------------------

function drawLetter(square, letter) {
  square.append(iconSvg(letter.letter));
  const badge = document.createElement("span");
  badge.className = "mm-order-badge";
  badge.hidden = true;
  square.append(badge);
}

function describePair(letter) {
  const number = order.get(letter);
  return `${iconName(letter)} pair: ${number ? `fires ${ordinal(number)}` : "no number yet"}`;
}

function updateOrderDisplay() {
  for (const square of board.element.querySelectorAll(".mm-letter")) {
    const letter = square.dataset.letter;
    const number = order.get(letter);
    const badge = square.querySelector(".mm-order-badge");

    badge.hidden = !number;
    badge.textContent = number ?? "";
    square.classList.toggle("mm-numbered", Boolean(number));
    square.setAttribute("aria-label", describePair(letter));
  }

  // One slot per number: the pair that fires then, or an empty slot.
  const byNumber = new Map([...order].map(([letter, number]) => [number, letter]));

  orderSlots.replaceChildren(
    ...pairs.map((_, index) => {
      const number = index + 1;
      const letter = byNumber.get(number);
      const slot = document.createElement("li");
      slot.className = `mm-slot${letter ? "" : " mm-slot-empty"}`;
      slot.dataset.number = number;

      const label = document.createElement("span");
      label.className = "mm-slot-number";
      label.textContent = number;
      slot.append(label);

      if (letter) {
        slot.append(iconSvg(letter, "mm-slot-icon"));
        slot.setAttribute("aria-label", `${ordinal(number)}: ${iconPlural(letter)}`);
        if (run && mode !== "numbering") {
          const position = run.sequence.indexOf(letter);
          slot.classList.toggle("mm-slot-done", position < run.step);
          slot.classList.toggle("mm-slot-current", position === run.current);
        }
      } else {
        slot.setAttribute("aria-label", `${ordinal(number)}: not chosen yet`);
      }
      return slot;
    })
  );
}

function updateControls() {
  const numbering = mode === "numbering" || mode === "solved";
  const allNumbered = order.size === pairs.length;

  checkButton.disabled = !(numbering && allNumbered);
  clearButton.disabled = !numbering;
  continueButton.hidden = numbering;
  continueButton.disabled = mode === "busy";

  for (const square of board.element.querySelectorAll(".mm-letter")) {
    square.disabled = !numbering;
  }
}

function highlightPair(letter) {
  for (const square of board.element.querySelectorAll(".mm-letter")) {
    square.classList.toggle("mm-firing", square.dataset.letter === letter);
  }
}

/** Put every mirror back the way the puzzle starts (no animation). */
function resetMirrors() {
  mirrors = new Map(startMirrors);
  for (const [key, type] of mirrors) {
    const [x, y] = key.split(",").map(Number);
    board.showMirror(x, y, type, { animate: false });
  }
}

// ------------------------------------------------------------
// Choosing the order
// ------------------------------------------------------------

function leaveResults() {
  // After a solve, changing the order starts again from the original mirrors.
  if (mode === "solved") {
    resetMirrors();
    board.clearLight();
    board.markMirrors([]);
    highlightPair(null);
    run = null;
    mode = "numbering";
  }
}

function togglePair(letter) {
  if (mode !== "numbering" && mode !== "solved") return;
  leaveResults();

  if (order.has(letter)) {
    order.delete(letter);
  } else {
    // The lowest number nobody has yet.
    const taken = new Set(order.values());
    let number = 1;
    while (taken.has(number)) number += 1;
    order.set(letter, number);
  }

  updateOrderDisplay();
  updateControls();
  setStatus(MESSAGES.numbering(order.size, pairs.length));
}

board.element.addEventListener("click", (event) => {
  const square = event.target.closest?.("button.mm-letter");
  if (square && !square.disabled) togglePair(square.dataset.letter);
});

clearButton.addEventListener("click", () => {
  if (mode !== "numbering" && mode !== "solved") return;
  leaveResults();
  order = new Map();
  updateOrderDisplay();
  updateControls();
  setStatus(MESSAGES.numbering(0, pairs.length));
});

// ------------------------------------------------------------
// Firing
// ------------------------------------------------------------

async function fireNext() {
  const letter = run.sequence[run.step];
  const total = run.sequence.length;

  run.current = run.step;
  mode = "busy";
  updateControls();
  board.clearLight();
  highlightPair(letter);
  setStatus(MESSAGES.firing(letter));

  const shot = fireShot(puzzle, mirrorAt, letter);
  await board.drawLight(shot.beams);

  if (!shot.ok) {
    mode = "failed";
    updateOrderDisplay();
    updateControls();
    setStatus(MESSAGES.failed(letter), "lost");
    continueButton.focus();
    return;
  }

  run.step += 1;
  updateOrderDisplay();

  if (run.step === total) {
    // Solved: leave the last light and the mirrors that made it on show.
    mode = "solved";
    highlightPair(null);
    updateOrderDisplay();
    updateControls();
    setStatus(MESSAGES.won(pairs.length), "won");
    return;
  }

  // The mirrors stay as they were (matching the light) until Continue.
  run.turning = shot.turns;

  if (run.turning.length === 0) {
    mode = "turned";
    setStatus(MESSAGES.connectedNoMirrors(letter, run.sequence[run.step]));
  } else {
    mode = "lit";
    board.markMirrors(run.turning.map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    }));
    setStatus(MESSAGES.connected(letter));
  }

  updateControls();
  continueButton.focus();
}

/** End of a turn: every mirror the light bounced off flips once. */
async function turnMirrors() {
  mode = "busy";
  updateControls();
  highlightPair(null);

  const changes = run.turning.map((key) => {
    mirrors.set(key, turnMirror(mirrors.get(key)));
    const [x, y] = key.split(",").map(Number);
    return { x, y, type: mirrors.get(key) };
  });
  await board.turnMirrors(changes);

  mode = "turned";
  updateControls();
  setStatus(MESSAGES.turned(run.sequence[run.step]));
  continueButton.focus();
}

checkButton.addEventListener("click", () => {
  if (checkButton.disabled) return;

  resetMirrors();
  board.markMirrors([]);
  run = {
    sequence: [...order].sort((a, b) => a[1] - b[1]).map(([letter]) => letter),
    step: 0,
    current: -1,
    turning: [],
  };
  fireNext();
});

continueButton.addEventListener("click", () => {
  if (mode === "lit") {
    turnMirrors();
    return;
  }

  if (mode === "turned") {
    fireNext();
    return;
  }

  if (mode === "failed") {
    // Back to choosing: original mirrors, and the pair that missed loses its
    // number, along with every pair numbered after it.
    const failedNumber = run.step + 1;
    const lastNumber = run.sequence.length;
    for (const [letter, number] of [...order]) {
      if (number >= failedNumber) order.delete(letter);
    }
    run = null;
    mode = "numbering";

    resetMirrors();
    board.clearLight();
    board.markMirrors([]);
    highlightPair(null);
    updateOrderDisplay();
    updateControls();
    setStatus(MESSAGES.renumber(failedNumber, lastNumber), "warning");
  }
});

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
    pairs = [...new Set(puzzle.letters.map((letter) => letter.letter))].sort();
    order = new Map();
    run = null;
    mode = "numbering";

    startMirrors = new Map();
    puzzle.grid.forEach((row, y) =>
      [...row].forEach((symbol, x) => {
        if (symbol === "/" || symbol === "\\") startMirrors.set(keyOf(x, y), symbol);
      })
    );
    mirrors = new Map(startMirrors);

    gameTitle.textContent = puzzle.title;
    document.title = `${puzzle.title} · Mirror Maze (Rotation)`;

    renderSourceBanner(
      puzzle.post ? { url: puzzle.post, text: puzzle.postText ?? undefined } : null,
      "Read the original post for more puzzles."
    );

    board.build(puzzle, { letterButtons: true, drawLetter, rotating: true });
    updateOrderDisplay();
    updateControls();
    setStatus(MESSAGES.numbering(0, pairs.length));
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
  setStatus("There are no Mirror Maze (Rotation) puzzles yet.", "error");
}
