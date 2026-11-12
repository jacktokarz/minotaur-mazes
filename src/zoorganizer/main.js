import puzzles from "./puzzles-index.json";
import { hashArrangement } from "./solutionCheck.js";
import { renderSourceBanner } from "../shared/sourceBanner.js";
import "../shared/base.css";
import "../shared/game.css";
import "./style.css";

// ------------------------------------------------------------
// DOM elements
// ------------------------------------------------------------

const canvas = document.querySelector("#game-board");
const ctx = canvas.getContext("2d");

const boardStage = document.querySelector("#board-stage");
const boardMessage = document.querySelector("#board-message");

const gameTitle = document.querySelector("#game-title");
const gameStatus = document.querySelector("#game-status");
const cluesElement = document.querySelector("#puzzle-clues");

const submitButton = document.querySelector("#submit-button");
const resetButton = document.querySelector("#reset-button");

// ------------------------------------------------------------
// Settings
// ------------------------------------------------------------

// Every URL for this puzzle type lives under this path, e.g. /zoorganizer/Test
const PAGE_PATH = "/zoorganizer";
const DEFAULT_PUZZLE = "easier";

const MAX_TILE_SIZE = 64;      // pixels per layout cell on a large screen
const ANIMAL_SCALE = 0.95;     // animal size relative to one cell
const SNAP_ANIMATION_MS = 170;
const TOUCH_LIFT = 0.6;        // while dragging by touch, hold the animal above the finger (in cells)

// Name labels under each animal
const LABEL_MAX_LINES = 3;
const LABEL_MIN_FONT = 7;            // px; smallest name text in New Arrivals
const LABEL_MIN_FONT_CROWDED = 6;    // px; smallest name text in a crowded enclosure
const LABEL_MAX_SHARE = 0.42;        // in an enclosure, a name may use this much of the animal's space

const TILE_PATHS = {
  path: "path.png",
  lawn: "lawn.png",
  tree: "tree.png",
  planks: "planks.png",
  straw: "straw.png",
  fenceH: "fence-h.png",
  fenceV: "fence-v.png",
  fencePost: "fence-post.png",
  "terrain-grass": "terrain-grass.png",
  "terrain-sand": "terrain-sand.png",
  "terrain-water": "terrain-water.png",
  "terrain-rock": "terrain-rock.png",
  "terrain-snow": "terrain-snow.png",
  "terrain-dirt": "terrain-dirt.png",
  "terrain-jungle": "terrain-jungle.png",
};

const SCENERY = { ".": "path", ",": "lawn", "^": "tree" };

const MESSAGES = {
  start:
    "Drag each animal into an enclosure. When every animal has a home, press Submit.",
  allPlaced:
    "Every animal has a home. Press Submit when you're happy with the arrangement.",
  won: "Congratulations! Every animal is happy in its new home. You're so smart!",
  wrong:
    "That's not the correct solution. Reset the board to try again.",
};

// ------------------------------------------------------------
// Images
// ------------------------------------------------------------

const tiles = {};
const animalImages = new Map(); // species -> Image | null

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      console.warn(`Could not load artwork: ${url}`);
      resolve(null);
    };
    image.src = url;
  });
}

async function loadTiles() {
  await Promise.all(
    Object.entries(TILE_PATHS).map(async ([name, file]) => {
      tiles[name] = await loadImage(`${PAGE_PATH}/tiles/${file}`);
    })
  );
}

async function loadAnimalImages(animalList) {
  await Promise.all(
    animalList
      .filter((animal) => animal.image && !animalImages.has(animal.species))
      .map(async (animal) => {
        animalImages.set(animal.species, null);
        animalImages.set(animal.species, await loadImage(animal.image));
      })
  );
}

// ------------------------------------------------------------
// Game state
// ------------------------------------------------------------

let currentDefinition = null;
let puzzle = null;

let enclosures = new Map(); // id -> { id, terrain, label, cells, box, anchor }
let animals = [];           // see createAnimals()

let locked = false;         // true after Submit, until Reset
let placementCounter = 0;   // keeps animals in the order they were placed
let drag = null;            // the animal currently being dragged, if any
let hoverTarget = undefined; // where the dragged animal would land

// Board geometry (CSS pixels); recalculated on resize.
const geometry = {
  tile: MAX_TILE_SIZE,
  border: 0,   // strip of lawn around the zoo, so edge fences and signs fit
  zooX: 0,     // where layout cell (0, 0) starts
  zooY: 0,
  zooWidth: 0,
  zooHeight: 0,
  holdingTop: 0,
  holdingHeight: 0,
  titleHeight: 0,  // the "NEW ARRIVALS" heading
  fontSize: 12,    // name label text size
  spriteSize: 0,   // full animal size (in the arrivals area / roomy enclosures)
  slotWidth: 0,    // one animal's spot in the arrivals area
  slotHeight: 0,
  slotGap: 0,
  rowGap: 0,
  perRow: 1,
  width: 0,
  height: 0,
};

const background = document.createElement("canvas");

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function setStatus(message, type = "") {
  gameStatus.textContent = message;
  gameStatus.dataset.state = type;
}

function cellAt(x, y) {
  return puzzle.grid[y]?.[x] ?? null;
}

function isEnclosureCell(symbol) {
  return symbol !== null && enclosures.has(symbol);
}

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

// ------------------------------------------------------------
// Puzzle setup
// ------------------------------------------------------------

/**
 * For each enclosure, find its cells, bounding box, and the largest
 * rectangle that fits inside it. Animals are arranged in that rectangle,
 * so they stay inside the fence even for L-shaped enclosures.
 */
function buildEnclosures() {
  enclosures = new Map();

  for (const definition of puzzle.enclosures) {
    enclosures.set(definition.id, { ...definition, cells: [] });
  }

  puzzle.grid.forEach((row, y) => {
    [...row].forEach((symbol, x) => {
      enclosures.get(symbol)?.cells.push({ x, y });
    });
  });

  for (const enclosure of enclosures.values()) {
    const xs = enclosure.cells.map((cell) => cell.x);
    const ys = enclosure.cells.map((cell) => cell.y);
    const box = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs) + 1,
      h: Math.max(...ys) - Math.min(...ys) + 1,
    };

    enclosure.box = box;
    enclosure.anchor = largestRectangle(enclosure, box);
  }
}

function largestRectangle(enclosure, box) {
  const inside = (x, y) => cellAt(x, y) === enclosure.id;
  const centerX = box.x + box.w / 2;
  const centerY = box.y + box.h / 2;
  let best = null;

  for (let y0 = box.y; y0 < box.y + box.h; y0 += 1) {
    for (let x0 = box.x; x0 < box.x + box.w; x0 += 1) {
      for (let y1 = y0; y1 < box.y + box.h; y1 += 1) {
        for (let x1 = x0; x1 < box.x + box.w; x1 += 1) {
          let full = true;

          for (let y = y0; y <= y1 && full; y += 1) {
            for (let x = x0; x <= x1 && full; x += 1) {
              full = inside(x, y);
            }
          }

          if (!full) continue;

          const w = x1 - x0 + 1;
          const h = y1 - y0 + 1;
          // Prefer bigger, then more central rectangles.
          const distance = Math.hypot(x0 + w / 2 - centerX, y0 + h / 2 - centerY);
          const score = w * h * 1000 - distance;

          if (!best || score > best.score) {
            best = { x: x0, y: y0, w, h, score };
          }
        }
      }
    }
  }

  return best;
}

function createAnimals() {
  animals = puzzle.animals.map((animal, index) => ({
    index,
    name: animal.name,
    species: animal.species,
    location: null, // null = waiting in the arrivals area, otherwise an enclosure id
    order: 0,
    x: 0,
    y: 0,
    size: 0,
    label: null, // { lines, font, lineHeight, height } - the name under the animal
    tween: null,
  }));
}

// ------------------------------------------------------------
// Layout: where each animal should be drawn
// ------------------------------------------------------------

// ------------------------------------------------------------
// Name labels
// ------------------------------------------------------------

const labelCache = new Map();

function labelFont(size) {
  return `800 ${size}px system-ui, sans-serif`;
}

/** "Ring-Tailed Lemur" -> ["Ring-", "Tailed ", "Lemur"] (places a line may break). */
function labelPieces(text) {
  const pieces = [];
  let current = "";

  for (const character of text) {
    current += character;
    if (character === " " || character === "-") {
      pieces.push(current);
      current = "";
    }
  }

  if (current) pieces.push(current);
  return pieces;
}

/**
 * Fit an animal's name into `maxWidth` pixels (and, optionally, `maxHeight`):
 * break it onto up to three lines (at spaces and hyphens), shrinking the
 * text only as much as needed.
 */
function wrapLabel(text, maxWidth, maxHeight = Infinity, minFont = LABEL_MIN_FONT) {
  const key = `${text}|${Math.round(maxWidth)}|${Math.round(maxHeight)}|${minFont}|${geometry.fontSize}`;
  if (labelCache.has(key)) return labelCache.get(key);

  const pieces = labelPieces(text);
  let result = null;

  for (let font = geometry.fontSize; font >= minFont; font -= 0.5) {
    ctx.font = labelFont(font);
    const width = (line) => ctx.measureText(line.trimEnd()).width;
    const lines = [];
    let line = "";

    for (const piece of pieces) {
      if (line && width(line + piece) > maxWidth) {
        lines.push(line.trimEnd());
        line = piece;
      } else {
        line += piece;
      }
    }

    lines.push(line.trimEnd());

    const lineHeight = Math.ceil(font * 1.15);
    result = { lines, font, lineHeight, height: lines.length * lineHeight };

    if (
      lines.length <= LABEL_MAX_LINES &&
      result.height <= maxHeight &&
      lines.every((l) => width(l) <= maxWidth)
    ) {
      break;
    }
  }

  labelCache.set(key, result);
  return result;
}

// ------------------------------------------------------------
// Layout: where each animal should be drawn
// ------------------------------------------------------------

function availableBoardWidth() {
  const container = boardStage.parentElement;
  const styles = getComputedStyle(container);
  const inner =
    container.clientWidth -
    parseFloat(styles.paddingLeft) -
    parseFloat(styles.paddingRight);

  return Number.isFinite(inner) && inner > 0 ? inner : window.innerWidth - 64;
}

function calculateGeometry() {
  const maxWidth = Math.max(240, Math.min(availableBoardWidth(), 900));
  const tile = Math.max(
    16,
    Math.min(MAX_TILE_SIZE, Math.floor(maxWidth / (puzzle.width + 0.4)))
  );
  const border = Math.round(tile * 0.2);

  geometry.tile = tile;
  geometry.border = border;
  geometry.zooX = border;
  geometry.zooY = border;
  geometry.zooWidth = puzzle.width * tile;
  geometry.zooHeight = puzzle.height * tile;
  geometry.width = geometry.zooWidth + border * 2;

  geometry.fontSize = Math.min(13, Math.max(9, Math.round(tile * 0.2)));
  geometry.spriteSize = Math.round(tile * ANIMAL_SCALE);
  geometry.titleHeight = Math.round(tile * 0.6);

  // Arrivals area: one spot per animal, wide enough for its name.
  geometry.slotWidth = Math.max(Math.round(tile * 1.35), 48);
  geometry.slotGap = Math.round(tile * 0.1);
  geometry.rowGap = Math.round(tile * 0.2);
  geometry.perRow = Math.max(
    1,
    Math.floor((geometry.width - geometry.slotGap) / (geometry.slotWidth + geometry.slotGap))
  );

  const tallestLabel = Math.max(
    ...animals.map((animal) => wrapLabel(animal.name, geometry.slotWidth - 2).height)
  );

  geometry.slotHeight = geometry.spriteSize + 2 + tallestLabel;

  const rows = Math.ceil(animals.length / geometry.perRow);

  geometry.holdingTop = geometry.zooY + geometry.zooHeight;
  geometry.holdingHeight =
    geometry.titleHeight +
    rows * geometry.slotHeight +
    (rows - 1) * geometry.rowGap +
    Math.round(tile * 0.3);

  geometry.height = geometry.holdingTop + geometry.holdingHeight;
}

/** Centre of the animal's picture when it is waiting in its arrivals spot. */
function slotCenter(index) {
  const { perRow, slotWidth, slotHeight, slotGap, rowGap, width, holdingTop, titleHeight, spriteSize } = geometry;
  const row = Math.floor(index / perRow);
  const column = index % perRow;
  const inRow = Math.min(perRow, animals.length - row * perRow);
  const rowWidth = inRow * slotWidth + (inRow - 1) * slotGap;
  const left = (width - rowWidth) / 2;

  return {
    x: left + column * (slotWidth + slotGap) + slotWidth / 2,
    y: holdingTop + titleHeight + row * (slotHeight + rowGap) + spriteSize / 2,
  };
}

/**
 * Work out where every animal belongs: its home spot if unplaced, or an
 * evenly spaced arrangement centred in its enclosure. Each animal takes up
 * its picture plus its name label underneath.
 */
function calculateTargets() {
  const { tile, spriteSize } = geometry;
  const targets = new Map();

  for (const animal of animals) {
    if (animal.location === null) {
      targets.set(animal, {
        ...slotCenter(animal.index),
        size: spriteSize,
        label: wrapLabel(animal.name, geometry.slotWidth - 2),
      });
    }
  }

  for (const enclosure of enclosures.values()) {
    const residents = animals
      .filter((animal) => animal.location === enclosure.id)
      .sort((a, b) => a.order - b.order);

    if (residents.length === 0) continue;

    const padding = tile * 0.08;
    // Keep animals clear of the sign hanging on the enclosure's top fence.
    const signClearance =
      puzzle.signs && enclosure.anchor.y === enclosure.box.y
        ? Math.max(0, signHeight() / 2 - padding + 1)
        : 0;
    const area = {
      x: geometry.zooX + enclosure.anchor.x * tile + padding,
      y: geometry.zooY + enclosure.anchor.y * tile + padding + signClearance,
      w: enclosure.anchor.w * tile - padding * 2,
      h: enclosure.anchor.h * tile - padding * 2 - signClearance,
    };

    // Try every grid (columns x rows) and keep the one where the animals,
    // with their names underneath, can be drawn largest.
    let best = null;

    for (let columns = 1; columns <= residents.length; columns += 1) {
      const rows = Math.ceil(residents.length / columns);
      const cellWidth = area.w / columns;
      const cellHeight = area.h / rows;
      const labels = residents.map((animal) =>
        wrapLabel(animal.name, cellWidth - 2, cellHeight * LABEL_MAX_SHARE, LABEL_MIN_FONT_CROWDED)
      );
      const labelHeight = Math.max(...labels.map((label) => label.height)) + 2;
      const size = Math.min(spriteSize, cellWidth * 0.94, (cellHeight - labelHeight) * 0.96);

      if (!best || size > best.size) {
        best = { columns, rows, cellWidth, cellHeight, labels, labelHeight, size };
      }
    }

    const size = Math.max(best.size, tile * 0.3);
    const groupHeight = size + best.labelHeight;
    const top = area.y + (area.h - best.rows * best.cellHeight) / 2;

    residents.forEach((animal, i) => {
      const row = Math.floor(i / best.columns);
      const column = i % best.columns;
      const inRow = Math.min(best.columns, residents.length - row * best.columns);
      const left = area.x + (area.w - inRow * best.cellWidth) / 2;
      const cellTop = top + row * best.cellHeight;

      targets.set(animal, {
        x: left + (column + 0.5) * best.cellWidth,
        y: cellTop + (best.cellHeight - groupHeight) / 2 + size / 2,
        size,
        label: best.labels[i],
      });
    });
  }

  return targets;
}

/** Move every animal to where it belongs, animated unless `instant`. */
function settleAnimals(instant = false) {
  const targets = calculateTargets();
  const now = performance.now();

  for (const animal of animals) {
    if (drag?.animal === animal) continue;

    const target = targets.get(animal);
    animal.label = target.label;

    if (instant || animal.size === 0) {
      Object.assign(animal, { x: target.x, y: target.y, size: target.size, tween: null });
      continue;
    }

    if (animal.x === target.x && animal.y === target.y && animal.size === target.size) {
      continue;
    }

    animal.tween = {
      start: now,
      from: { x: animal.x, y: animal.y, size: animal.size },
      to: target,
    };
  }

  requestRender();
}

// ------------------------------------------------------------
// Drawing
// ------------------------------------------------------------

function setSmoothing(context, scale) {
  // Keep pixel art crisp when enlarging; smooth it when shrinking.
  context.imageSmoothingEnabled = scale < 1;
  context.imageSmoothingQuality = "high";
}

function drawTile(context, image, x, y, size) {
  if (image) {
    context.drawImage(image, x, y, size, size);
  } else {
    context.fillStyle = "#555";
    context.fillRect(x, y, size, size);
  }
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const { width, height } = geometry;

  for (const target of [canvas, background]) {
    target.width = Math.round(width * ratio);
    target.height = Math.round(height * ratio);
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  boardStage.style.width = `${width}px`;
  boardStage.style.height = `${height}px`;
}

/** Everything that doesn't move: ground, trees, fences, signs, arrivals area. */
function drawBackground() {
  const ratio = background.width / geometry.width;
  const context = background.getContext("2d");
  const { tile } = geometry;

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  setSmoothing(context, (tile * ratio) / MAX_TILE_SIZE);
  context.clearRect(0, 0, geometry.width, geometry.height);

  // Lawn border around the whole zoo
  for (let y = 0; y < geometry.holdingTop; y += tile) {
    for (let x = 0; x < geometry.width; x += tile) {
      drawTile(context, tiles.lawn, x, y, tile);
    }
  }

  drawArrivalsArea(context);

  // From here on, draw in layout coordinates (cell (0, 0) at the zoo's corner).
  context.translate(geometry.zooX, geometry.zooY);

  // Ground
  puzzle.grid.forEach((row, y) => {
    [...row].forEach((symbol, x) => {
      const px = x * tile;
      const py = y * tile;

      if (isEnclosureCell(symbol)) {
        drawTile(context, tiles[`terrain-${enclosures.get(symbol).terrain}`], px, py, tile);
      } else if (SCENERY[symbol] === "path") {
        drawTile(context, tiles.path, px, py, tile);
      } else {
        drawTile(context, tiles.lawn, px, py, tile);
        if (SCENERY[symbol] === "tree") drawTile(context, tiles.tree, px, py, tile);
      }
    });
  });

  drawFences(context);

  if (puzzle.signs) {
    for (const enclosure of enclosures.values()) drawSign(context, enclosure);
  }
}

function drawArrivalsArea(context) {
  const { tile, width, holdingTop, holdingHeight, titleHeight } = geometry;

  // Wooden deck
  for (let y = holdingTop; y < holdingTop + holdingHeight; y += tile) {
    for (let x = 0; x < width; x += tile) {
      drawTile(context, tiles.planks, x, y, tile);
    }
  }

  // Shadow under the zoo's edge
  const shadow = context.createLinearGradient(0, holdingTop, 0, holdingTop + tile * 0.25);
  shadow.addColorStop(0, "rgb(0 0 0 / 45%)");
  shadow.addColorStop(1, "rgb(0 0 0 / 0%)");
  context.fillStyle = shadow;
  context.fillRect(0, holdingTop, width, tile * 0.25);

  // Label
  context.font = `800 ${Math.max(10, Math.round(tile * 0.22))}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgb(0 0 0 / 55%)";
  context.fillText("NEW ARRIVALS", width / 2 + 1, holdingTop + titleHeight * 0.55 + 1);
  context.fillStyle = "#e9cb88";
  context.fillText("NEW ARRIVALS", width / 2, holdingTop + titleHeight * 0.55);

  // A straw bed for each animal's home spot
  animals.forEach((animal) => {
    const center = slotCenter(animal.index);
    const size = tile;
    drawTile(context, tiles.straw, center.x - size / 2, center.y - size / 2, size);
  });
}

function drawFences(context) {
  const { tile } = geometry;
  const thickness = tile / 4; // fence sprites are 64 x 16
  const horizontal = [];
  const vertical = [];
  const posts = new Set();

  // A fence goes on every edge between an enclosure cell and anything else.
  for (let y = 0; y <= puzzle.height; y += 1) {
    for (let x = 0; x < puzzle.width; x += 1) {
      const above = cellAt(x, y - 1);
      const below = cellAt(x, y);
      if (above !== below && (isEnclosureCell(above) || isEnclosureCell(below))) {
        horizontal.push({ x, y });
        posts.add(`${x},${y}`).add(`${x + 1},${y}`);
      }
    }
  }

  for (let y = 0; y < puzzle.height; y += 1) {
    for (let x = 0; x <= puzzle.width; x += 1) {
      const left = cellAt(x - 1, y);
      const right = cellAt(x, y);
      if (left !== right && (isEnclosureCell(left) || isEnclosureCell(right))) {
        vertical.push({ x, y });
        posts.add(`${x},${y}`).add(`${x},${y + 1}`);
      }
    }
  }

  for (const { x, y } of horizontal) {
    if (tiles.fenceH) {
      context.drawImage(tiles.fenceH, x * tile, y * tile - thickness / 2, tile, thickness);
    }
  }

  for (const { x, y } of vertical) {
    if (tiles.fenceV) {
      context.drawImage(tiles.fenceV, x * tile - thickness / 2, y * tile, thickness, tile);
    }
  }

  const postSize = tile * 0.3125; // 20px at 64px tiles
  for (const key of posts) {
    const [x, y] = key.split(",").map(Number);
    if (tiles.fencePost) {
      context.drawImage(
        tiles.fencePost,
        x * tile - postSize * 0.4,
        y * tile - postSize * 0.4,
        postSize,
        postSize
      );
    }
  }
}

function signFontSize() {
  return Math.max(9, Math.round(geometry.tile * 0.22));
}

function signHeight() {
  return signFontSize() + geometry.tile * 0.1;
}

/** A little wooden sign hanging on the enclosure's top fence. */
function drawSign(context, enclosure) {
  const { tile } = geometry;
  const topRow = enclosure.cells.filter((cell) => cell.y === enclosure.box.y);
  const firstX = Math.min(...topRow.map((cell) => cell.x));
  let lastX = firstX;
  while (topRow.some((cell) => cell.x === lastX + 1)) lastX += 1;

  const fontSize = signFontSize();
  context.font = `800 ${fontSize}px system-ui, sans-serif`;

  const textWidth = context.measureText(enclosure.label).width;
  const w = Math.max(tile * 0.36, textWidth + tile * 0.2);
  const h = signHeight();
  const cx = ((firstX + lastX + 1) / 2) * tile;
  const x = Math.round(cx - w / 2);
  const y = Math.round(enclosure.box.y * tile - h / 2);

  context.fillStyle = "rgb(0 0 0 / 35%)";
  context.fillRect(x + 2, y + 2, w, h);
  context.fillStyle = "#2e1c0e";
  context.fillRect(x, y, w, h);
  context.fillStyle = "#7a4f28";
  context.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
  context.fillStyle = "#a8743f";
  context.fillRect(x + 1.5, y + 1.5, w - 3, Math.max(1, tile * 0.03));

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#f1eadb";
  context.fillText(enclosure.label, cx, y + h / 2 + 1);
}

/**
 * Shown for an animal that has no sprite yet
 * (public/zoorganizer/animals/<name>.png): a plain crate with a "?".
 * The animal's name is drawn underneath, like every other animal.
 */
function drawPlaceholderAnimal(context, animal, x, y, size) {
  const s = size * 0.8;
  const left = x - s / 2;
  const top = y - s / 2 + size * 0.08;
  const edge = Math.max(1.5, s * 0.07);

  context.fillStyle = "#1b130c";
  context.fillRect(left, top, s, s);
  context.fillStyle = "#9c8a6a";
  context.fillRect(left + edge, top + edge, s - edge * 2, s - edge * 2);
  context.fillStyle = "#7d6d52";
  context.fillRect(left + edge, top + s * 0.48, s - edge * 2, edge);

  context.font = `800 ${s * 0.55}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#1b130c";
  context.fillText("?", x, top + s / 2 + 1);
}

/** The animal's name, centred under its picture. */
function drawLabel(context, label, x, top) {
  if (!label) return;

  context.font = labelFont(label.font);
  context.textAlign = "center";
  context.textBaseline = "top";
  context.lineJoin = "round";
  context.lineWidth = Math.max(2.5, label.font * 0.32);
  context.strokeStyle = "#1b130c";
  context.fillStyle = "#fff4dc";

  label.lines.forEach((line, i) => {
    const y = top + i * label.lineHeight;
    context.strokeText(line, x, y);
    context.fillText(line, x, y);
  });
}

function drawAnimal(animal, lifted = false) {
  const image = animalImages.get(animal.species);
  const size = animal.size * (lifted ? 1.12 : 1);
  const { x, y } = animal;

  // Shadow
  ctx.beginPath();
  ctx.ellipse(
    x + (lifted ? size * 0.08 : 0),
    y + size * (lifted ? 0.5 : 0.42),
    size * 0.36,
    size * 0.12,
    0,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = lifted ? "rgb(0 0 0 / 28%)" : "rgb(0 0 0 / 35%)";
  ctx.fill();

  if (image) {
    const ratio = canvas.width / geometry.width;
    setSmoothing(ctx, (size * ratio) / Math.max(image.width, image.height));
    const scale = size / Math.max(image.width, image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
  } else {
    drawPlaceholderAnimal(ctx, animal, x, y, size);
  }
}

function drawAnimalLabel(animal, lifted = false) {
  const size = animal.size * (lifted ? 1.12 : 1);
  drawLabel(ctx, animal.label, animal.x, animal.y + size / 2 + 2);
}

/** Outline the enclosure (or arrivals area) the dragged animal is over. */
function drawDropHighlight() {
  if (!drag || hoverTarget === undefined) return;

  const { tile } = geometry;
  ctx.save();

  if (hoverTarget === null) {
    ctx.fillStyle = "rgb(233 203 136 / 12%)";
    ctx.fillRect(0, geometry.holdingTop, geometry.width, geometry.holdingHeight);
  } else {
    const enclosure = enclosures.get(hoverTarget);
    ctx.translate(geometry.zooX, geometry.zooY);
    ctx.fillStyle = "rgb(233 203 136 / 22%)";
    for (const cell of enclosure.cells) {
      ctx.fillRect(cell.x * tile, cell.y * tile, tile, tile);
    }

    ctx.strokeStyle = "#e9cb88";
    ctx.lineWidth = Math.max(2, tile * 0.05);
    ctx.beginPath();
    for (const { x, y } of enclosure.cells) {
      const edges = [
        [x, y, x + 1, y, cellAt(x, y - 1)],
        [x, y + 1, x + 1, y + 1, cellAt(x, y + 1)],
        [x, y, x, y + 1, cellAt(x - 1, y)],
        [x + 1, y, x + 1, y + 1, cellAt(x + 1, y)],
      ];
      for (const [x1, y1, x2, y2, neighbour] of edges) {
        if (neighbour !== enclosure.id) {
          ctx.moveTo(x1 * tile, y1 * tile);
          ctx.lineTo(x2 * tile, y2 * tile);
        }
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

let renderQueued = false;

function requestRender() {
  if (!renderQueued) {
    renderQueued = true;
    requestAnimationFrame(render);
  }
}

function render(now) {
  renderQueued = false;
  if (!puzzle) return;

  // Advance snap animations.
  let animating = false;
  for (const animal of animals) {
    if (!animal.tween) continue;
    const t = Math.min((now - animal.tween.start) / SNAP_ANIMATION_MS, 1);
    const e = easeInOut(Math.max(t, 0));
    const { from, to } = animal.tween;
    animal.x = from.x + (to.x - from.x) * e;
    animal.y = from.y + (to.y - from.y) * e;
    animal.size = from.size + (to.size - from.size) * e;
    if (t >= 1) animal.tween = null;
    else animating = true;
  }

  const ratio = canvas.width / geometry.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(background, 0, 0);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  drawDropHighlight();

  // Placed animals first, then waiting ones, then whatever is being dragged.
  const ordered = [...animals]
    .filter((animal) => animal !== drag?.animal)
    .sort((a, b) => (a.location === null) - (b.location === null) || a.order - b.order);

  // Names go on top of every picture so they are never hidden.
  for (const animal of ordered) drawAnimal(animal);
  for (const animal of ordered) drawAnimalLabel(animal);

  if (drag) {
    drawAnimal(drag.animal, true);
    drawAnimalLabel(drag.animal, true);
  }

  if (animating) requestRender();
}

// ------------------------------------------------------------
// Dragging
// ------------------------------------------------------------

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * geometry.width,
    y: ((event.clientY - rect.top) / rect.height) * geometry.height,
  };
}

function animalAt(point) {
  // Check the animals drawn on top first.
  const ordered = [...animals].sort(
    (a, b) => (a.location === null) - (b.location === null) || a.order - b.order
  );

  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const animal = ordered[i];
    const half = animal.size / 2;
    const labelHeight = animal.label ? animal.label.height + 2 : 0;

    // The picture or the name underneath it can be grabbed.
    if (
      Math.abs(point.x - animal.x) <= half &&
      point.y >= animal.y - half &&
      point.y <= animal.y + half + labelHeight
    ) {
      return animal;
    }
  }

  return null;
}

/**
 * Where would an animal centred on this point land?
 * Returns an enclosure id, null for the arrivals area, or undefined for
 * "nowhere" (a path, lawn or tree), in which case it goes back where it was.
 */
function dropTargetAt(point) {
  const { tile } = geometry;

  if (point.y >= geometry.holdingTop) {
    return point.y <= geometry.height + tile ? null : undefined;
  }

  const symbol = cellAt(
    Math.floor((point.x - geometry.zooX) / tile),
    Math.floor((point.y - geometry.zooY) / tile)
  );
  return isEnclosureCell(symbol) ? symbol : undefined;
}

function updateCursor(point) {
  if (drag) {
    canvas.style.cursor = "grabbing";
  } else if (!locked && point && animalAt(point)) {
    canvas.style.cursor = "grab";
  } else {
    canvas.style.cursor = "default";
  }
}

function startDrag(event) {
  if (locked || !puzzle || drag) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;

  const point = pointerPosition(event);
  const animal = animalAt(point);
  if (!animal) return;

  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);

  const lift = event.pointerType === "touch" ? geometry.tile * TOUCH_LIFT : 0;

  animal.tween = null;
  drag = {
    animal,
    pointerId: event.pointerId,
    from: animal.location,
    offsetX: animal.x - point.x,
    offsetY: lift ? -lift : animal.y - point.y,
  };

  moveDrag(event);
}

function moveDrag(event) {
  const point = pointerPosition(event);

  if (!drag) {
    updateCursor(point);
    return;
  }

  if (event.pointerId !== drag.pointerId) return;

  // Keep the animal on the board.
  drag.animal.x = Math.min(Math.max(point.x + drag.offsetX, 0), geometry.width);
  drag.animal.y = Math.min(Math.max(point.y + drag.offsetY, 0), geometry.height);

  hoverTarget = dropTargetAt(drag.animal);
  updateCursor(point);
  requestRender();
}

function endDrag(event, cancelled = false) {
  if (!drag || event.pointerId !== drag.pointerId) return;

  const { animal, from } = drag;
  const target = cancelled ? undefined : dropTargetAt(animal);

  drag = null;
  hoverTarget = undefined;

  if (target === undefined) {
    // Dropped somewhere that isn't an enclosure: put it back where it was.
    animal.location = from;
  } else {
    if (target !== from) animal.order = ++placementCounter;
    animal.location = target;
  }

  settleAnimals();
  updateCursor(pointerPosition(event));
  updateProgress();
}

canvas.addEventListener("pointerdown", startDrag);
canvas.addEventListener("pointermove", moveDrag);
canvas.addEventListener("pointerup", (event) => endDrag(event));
canvas.addEventListener("pointercancel", (event) => endDrag(event, true));
canvas.addEventListener("pointerleave", () => {
  if (!drag) canvas.style.cursor = "default";
});

// On touch screens, stop the page from scrolling when a drag starts on an
// animal (but still allow scrolling when the touch starts anywhere else).
canvas.addEventListener(
  "touchstart",
  (event) => {
    if (locked || !puzzle || event.touches.length !== 1) return;
    // The pointerdown handler runs first and may already have started a drag
    // (and lifted the animal above the finger), so check for that too.
    if (drag || animalAt(pointerPosition(event.touches[0]))) event.preventDefault();
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (event) => {
    if (drag) event.preventDefault();
  },
  { passive: false }
);

// ------------------------------------------------------------
// Progress, submitting and resetting
// ------------------------------------------------------------

function updateProgress() {
  if (locked) return;

  const placed = animals.filter((animal) => animal.location !== null).length;
  const allPlaced = placed === animals.length;

  submitButton.disabled = !allPlaced;

  if (allPlaced) {
    setStatus(MESSAGES.allPlaced);
  } else if (placed === 0) {
    setStatus(MESSAGES.start);
  } else {
    setStatus(
      `${placed} of ${animals.length} animals placed. ` +
        "Place them all, then press Submit."
    );
  }
}

function submitArrangement() {
  if (locked || !puzzle) return;
  if (animals.some((animal) => animal.location === null)) return;

  const placement = {};
  for (const animal of animals) {
    (placement[animal.location] ??= []).push(animal.species);
  }

  const enclosureIds = puzzle.enclosures.map((enclosure) => enclosure.id);
  const fingerprint = hashArrangement(puzzle.name, placement, enclosureIds);
  const correct = fingerprint === puzzle.solutionHash;

  locked = true;
  submitButton.disabled = true;
  updateCursor(null);

  if (correct) {
    setStatus(MESSAGES.won, "won");
    boardMessage.textContent = "Congratulations!\nYou're so smart!";
    boardMessage.dataset.state = "won";
  } else {
    setStatus(MESSAGES.wrong, "lost");
    boardMessage.textContent = "Not the correct solution";
    boardMessage.dataset.state = "lost";
  }

  boardMessage.hidden = false;
  resetButton.focus();
}

function resetBoard() {
  if (!puzzle) return;

  locked = false;
  drag = null;
  hoverTarget = undefined;
  placementCounter = 0;

  for (const animal of animals) {
    animal.location = null;
    animal.order = 0;
  }

  boardMessage.hidden = true;
  boardMessage.textContent = "";
  boardMessage.removeAttribute("data-state");

  settleAnimals();
  updateProgress();
}

submitButton.addEventListener("click", submitArrangement);
resetButton.addEventListener("click", resetBoard);

// ------------------------------------------------------------
// Puzzle text (the animals' preferences)
// ------------------------------------------------------------

function renderPuzzleText() {
  cluesElement.replaceChildren(
    ...puzzle.clues.map((clue) => {
      const item = document.createElement("li");
      // Show "Lion:" style prefixes in bold.
      const match = clue.match(/^([^:"]{1,40}):\s+(.*)$/);
      if (match) {
        item.append(
          Object.assign(document.createElement("strong"), { textContent: `${match[1]}: ` }),
          match[2]
        );
      } else {
        item.textContent = clue;
      }
      return item;
    })
  );
}

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
  // Replace (not push) so the Back button doesn't bounce back to /zoorganizer/.
  if (location.pathname !== url) history.replaceState({ name }, "", url);
}

function layoutBoard() {
  calculateGeometry();
  resizeCanvas();
  drawBackground();
  settleAnimals(true);
}

async function selectPuzzle(name, { updateHistory = true } = {}) {
  const definition = findPuzzleByName(name);

  if (!definition) {
    setStatus(`Puzzle "${name}" was not found.`, "error");
    return;
  }

  try {
    setStatus("Loading the zoo…");

    const response = await fetch(definition.data);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    await loadAnimalImages(data.animals);

    currentDefinition = definition;
    puzzle = data;
    gameTitle.textContent = puzzle.title;
    document.title = `${puzzle.title} · zoOrganizer`;

    renderSourceBanner(
      puzzle.post ? { url: puzzle.post, text: puzzle.postText ?? undefined } : null,
      "Read the original post for more puzzles."
    );
    renderPuzzleText();
    buildEnclosures();
    createAnimals();
    layoutBoard();
    resetBoard();

    if (updateHistory) updateAddress(definition.name);
  } catch (error) {
    console.error(error);
    setStatus(`Could not load puzzle: ${error.message}`, "error");
  }
}

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (puzzle) layoutBoard();
  }, 100);
});

window.addEventListener("popstate", () => {
  const requested = getRequestedPuzzleName();
  const name = findPuzzleByName(requested) ? requested : DEFAULT_PUZZLE;
  selectPuzzle(name, { updateHistory: false });
});

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------

async function start() {
  await loadTiles();

  const requested = getRequestedPuzzleName();
  const startingPuzzle = findPuzzleByName(requested) ? requested : DEFAULT_PUZZLE;

  await selectPuzzle(startingPuzzle, { updateHistory: !requested });
}

start();
