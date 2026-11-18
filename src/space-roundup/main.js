import puzzles from "./puzzles-index.json";
import { fly, startState } from "./rules.js";
import { renderSourceBanner } from "../shared/sourceBanner.js";
import { createHints } from "../shared/hints.js";
import { createStatus } from "../shared/status.js";
import "../shared/base.css";
import "../shared/game.css";
import "./style.css";

// ------------------------------------------------------------
// Settings
// ------------------------------------------------------------

// Every URL for this puzzle type lives under this path, e.g. /space-roundup/Test
const PAGE_PATH = "/space-roundup";
const DEFAULT_PUZZLE = "test";
const TILES = `${PAGE_PATH}/tiles`;

const MS_PER_SQUARE = 70;    // flying speed
const MIN_FLIGHT_MS = 140;
const COLLECT_MS = 350;      // a friend hopping aboard
const ESCAPE_MS = 500;       // flying out through the exit
const SWIPE_PX = 24;         // how far a finger must move to count as a swipe

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const MESSAGES = {
  start: (friends) => `Find ${friends === 1 ? "your friend" : `all ${friends} friends`}, then fly out the exit.`,
  found: (left) => `Found a friend! ${left} to go.`,
  allFound: "Everyone's aboard! The exit is open.",
  locked: "The exit is locked until you find every friend.",
  won: (friends, moves) =>
    `Home with ${friends === 1 ? "your friend" : `all ${friends} friends`} in ${plural(moves, "move")}. You're so smart!`,
};

// ------------------------------------------------------------
// DOM elements
// ------------------------------------------------------------

const wrap = document.querySelector("#space-board");
const boardElement = wrap.querySelector(".sr-board");
const sprites = wrap.querySelector(".sr-sprites");
const gameTitle = document.querySelector("#game-title");
const friendIcons = document.querySelector("#friend-icons");
const friendCount = document.querySelector("#friend-count");
const resetButton = document.querySelector("#reset-button");

const setStatus = createStatus(document.querySelector("#game-status"));
const hints = createHints(document.querySelector("#hint-button"));

// ------------------------------------------------------------
// State
// ------------------------------------------------------------

let puzzle = null;
let state = null;
let busy = false;          // true while flying, so moves don't overlap

let playerSprite = null;
let friendSprites = [];
let exitSprites = [];

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));
}

const friendImage = (index) => `${TILES}/friend-${(index % 4) + 1}.png`;

// ------------------------------------------------------------
// Drawing
// ------------------------------------------------------------

/** Put a sprite on a square (in % of the board, so it scales with the page). */
function place(sprite, { x, y }, ms = 0) {
  sprite.style.transitionDuration = `${reducedMotion() ? 0 : ms}ms`;
  sprite.style.left = `${(x / puzzle.width) * 100}%`;
  sprite.style.top = `${(y / puzzle.height) * 100}%`;
}

function makeSprite(className, image, label) {
  const sprite = document.createElement("div");
  sprite.className = `sr-sprite ${className}`;
  sprite.style.width = `${100 / puzzle.width}%`;
  sprite.style.height = `${100 / puzzle.height}%`;
  if (image) sprite.style.backgroundImage = `url("${image}")`;
  if (label) {
    sprite.setAttribute("role", "img");
    sprite.setAttribute("aria-label", label);
  }
  sprites.append(sprite);
  return sprite;
}

function buildBoard() {
  wrap.style.setProperty("--cols", puzzle.width);
  wrap.style.setProperty("--rows", puzzle.height);
  boardElement.replaceChildren();
  sprites.replaceChildren();

  puzzle.grid.forEach((row, y) => {
    [...row].forEach((symbol, x) => {
      const square = document.createElement("div");
      // Three tiles of each kind, mixed so the field doesn't look copy-pasted.
      square.className =
        symbol === "#"
          ? `sr-cell sr-asteroid sr-asteroid-${((x * 7 + y * 3) % 3) + 1}`
          : `sr-cell sr-space sr-space-${((x * 5 + y * 11) % 3) + 1}`;
      boardElement.append(square);
    });
  });

  exitSprites = puzzle.exits.map((exit) => {
    const sprite = makeSprite("sr-exit", null, "Exit");
    place(sprite, exit);
    return sprite;
  });

  friendSprites = puzzle.friends.map((friend, index) => {
    const sprite = makeSprite("sr-friend", friendImage(index), "A friend");
    place(sprite, friend);
    return sprite;
  });

  playerSprite = makeSprite("sr-player", `${TILES}/player.png`, "You");
}

function updateFriends() {
  const found = new Set(state.collected);

  friendIcons.replaceChildren(
    ...puzzle.friends.map((_, index) => {
      const icon = document.createElement("span");
      icon.className = `sr-friend-icon${found.has(index) ? " sr-found" : ""}`;
      icon.style.backgroundImage = `url("${friendImage(index)}")`;
      return icon;
    })
  );
  friendCount.textContent = `${found.size} / ${puzzle.friends.length}`;

  puzzle.friends.forEach((_, index) => {
    friendSprites[index].classList.toggle("sr-collected", found.has(index));
  });

  const open = found.size === puzzle.friends.length;
  for (const sprite of exitSprites) {
    sprite.classList.toggle("sr-open", open);
    sprite.setAttribute("aria-label", open ? "Exit (open)" : "Exit (locked)");
  }
}

function resetMaze() {
  state = startState(puzzle);
  busy = false;
  playerSprite.classList.remove("sr-escaped", "sr-bump");
  place(playerSprite, state.player);
  updateFriends();
  setStatus(MESSAGES.start(puzzle.friends.length));
}

// ------------------------------------------------------------
// Moving
// ------------------------------------------------------------

/** A little wobble when the player can't move that way. */
function bump(direction) {
  playerSprite.dataset.bump = direction;
  playerSprite.classList.remove("sr-bump");
  void playerSprite.offsetWidth;
  playerSprite.classList.add("sr-bump");
}

async function move(direction) {
  if (!puzzle || busy || state.won) return;

  const result = fly(puzzle, state, direction);

  if (!result.moved) {
    bump(direction);
    if (result.stoppedBy === "locked-exit") setStatus(MESSAGES.locked);
    return;
  }

  busy = true;
  state = result.state;

  // Fly along the path.
  const squares = result.path.length - 1;
  if (squares > 0) {
    const ms = Math.max(MIN_FLIGHT_MS, squares * MS_PER_SQUARE);
    place(playerSprite, state.player, ms);
    await wait(ms);
  }

  if (result.friend !== null) {
    // The friend hops aboard.
    const sprite = friendSprites[result.friend];
    sprite.classList.add("sr-hopping");
    place(sprite, state.player, COLLECT_MS);
    await wait(COLLECT_MS);
    sprite.classList.remove("sr-hopping");
    updateFriends();

    const left = puzzle.friends.length - state.collected.length;
    setStatus(left === 0 ? MESSAGES.allFound : MESSAGES.found(left));
  } else if (result.stoppedBy === "locked-exit") {
    setStatus(MESSAGES.locked);
  }

  if (state.won) {
    playerSprite.classList.add("sr-escaped");
    await wait(ESCAPE_MS);
    setStatus(MESSAGES.won(puzzle.friends.length, state.moves), "won");
  }

  busy = false;
}

// Keyboard: arrows or WASD.
const KEYS = {
  arrowup: "up", w: "up",
  arrowdown: "down", s: "down",
  arrowleft: "left", a: "left",
  arrowright: "right", d: "right",
};

document.addEventListener("keydown", (event) => {
  if (event.target.closest?.("input, textarea, select")) return;
  const direction = KEYS[event.key.toLowerCase()];
  if (!direction) return;
  event.preventDefault(); // don't scroll the page
  move(direction);
});

// On-screen arrows.
document.querySelector(".sr-touch-controls").addEventListener("click", (event) => {
  const button = event.target.closest("[data-move]");
  if (button) move(button.dataset.move);
});

// Swipes on the maze.
let swipeStart = null;

wrap.addEventListener("pointerdown", (event) => {
  swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
});

wrap.addEventListener("pointerup", (event) => {
  if (!swipeStart || event.pointerId !== swipeStart.id) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
});

wrap.addEventListener("pointercancel", () => {
  swipeStart = null;
});

resetButton.addEventListener("click", () => {
  if (puzzle) resetMaze();
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

    gameTitle.textContent = puzzle.title;
    document.title = `${puzzle.title} · Space Roundup`;

    renderSourceBanner(
      puzzle.post ? { url: puzzle.post, text: puzzle.postText ?? undefined } : null,
      "Read the original post for more puzzles."
    );

    buildBoard();
    resetMaze();
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
  setStatus("There are no Space Roundup puzzles yet.", "error");
}
