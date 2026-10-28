
import maps from "./maps-index.json";
import { loadMapText } from "./mapParser.js";
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

const restartButton = document.querySelector("#restart-button");

// ------------------------------------------------------------
// Game settings
// ------------------------------------------------------------

const DEFAULT_MAP = "Test";
const TILE_SIZE = 64;
const MINOTAUR_STEPS_PER_TURN = 2;

const TILE_ANIMATION_MS = 200;

const ASSET_PATHS = {
  floor: "/assets/floor.png",
  wall: "/assets/wall.png",
  theseus: "/assets/theseus.png",
  minotaur: "/assets/minotaur.png",
  portal: "/assets/portal.png",
};

// ------------------------------------------------------------
// Assets
// ------------------------------------------------------------

const assets = {};

function loadAsset(name, url) {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      assets[name] = image;
      resolve(image);
    };

    image.onerror = () => {
      console.warn(`Could not load artwork: ${url}`);
      assets[name] = null;
      resolve(null);
    };

    image.src = url;
  });
}

async function loadAssets() {
  await Promise.all(
    Object.entries(ASSET_PATHS).map(([name, url]) =>
      loadAsset(name, url)
    )
  );
}

// ------------------------------------------------------------
// Game state
// ------------------------------------------------------------

let currentMapDefinition = null;
let currentMapName = "";
let currentMapUrl = "";

let tiles = [];
let width = 0;
let height = 0;

let initialTheseus = null;
let initialMinotaurs = [];
let initialExits = [];

let theseus = null;
let minotaurs = [];
let exits = [];

let gameOver = false;
let gameWon = false;
let moveCount = 0;
let isAnimatingTurn = false;

// ------------------------------------------------------------
// General helpers
// ------------------------------------------------------------

function copyPosition(position) {
  return {
    x: position.x,
    y: position.y,
  };
}

function samePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}

function positionKey(position) {
  return `${position.x},${position.y}`;
}

function isInsideBoard(position) {
  return (
    position.x >= 0 &&
    position.x < width &&
    position.y >= 0 &&
    position.y < height
  );
}

function tileAt(position) {
  if (!isInsideBoard(position)) {
    return "wall";
  }

  return tiles[position.y][position.x];
}

function isWall(position) {
  return tileAt(position) === "wall";
}

function isExit(position) {
  return exits.some((exit) => samePosition(exit, position));
}

function isMinotaurAt(position) {
  return minotaurs.some((minotaur) =>
    samePosition(minotaur, position)
  );
}

function setStatus(message, type = "") {
  gameStatus.textContent = message;
  gameStatus.dataset.state = type;
}

function updateAddress(mapName, replace = false) {
  const encodedName = encodeURIComponent(mapName);
  const url = mapName ? `/${encodedName}` : "/";

  if (replace) {
    history.replaceState({ mapName }, "", url);
  } else if (location.pathname !== url) {
    history.pushState({ mapName }, "", url);
  }
}

// ------------------------------------------------------------
// Map selection and loading
// ------------------------------------------------------------


function findMapByName(name) {
  return maps.find((map) => map.name.toLowerCase() === name.toLowerCase());
}

function getRequestedMapName() {
  const segment = location.pathname
    .split("/")
    .filter(Boolean)
    .pop();

  if (!segment) {
    return null;
  }
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

async function selectMap(mapName, options = {}) {
  const { updateHistory = true } = options;
  const definition = findMapByName(mapName);

  if (!definition) {
    setStatus(`Map "${mapName}" was not found.`, "error");
    return;
  }
  try {
    setStatus("Loading maze…");

    const parsedMap = await loadMapText(definition.image);

    currentMapDefinition = definition;
    currentMapName = definition.name;
    currentMapUrl = definition.image;

    width = parsedMap.width;
    height = parsedMap.height;
    tiles = parsedMap.tiles;

    initialTheseus = copyPosition(parsedMap.theseus);

    initialMinotaurs = parsedMap.minotaurs.map(copyPosition);

    initialExits = parsedMap.exits.map(copyPosition);

    gameTitle.textContent = definition.title;

    resetGame();

    if (updateHistory) {
      updateAddress(definition.name);
    }
  } catch (error) {
    console.error(error);

    setStatus(
      `Could not load map: ${error.message}`,
      "error"
    );
  }
}

// ------------------------------------------------------------
// Game initialization
// ------------------------------------------------------------

function resetGame() {
  theseus = copyPosition(initialTheseus);

  minotaurs = initialMinotaurs.map(copyPosition);

  exits = initialExits.map(copyPosition);

  moveCount = 0;
  gameOver = false;
  gameWon = false;
  isAnimatingTurn = false;

  resizeCanvas();
  drawBoard();

  setStatus(
    "Your turn. Guide Theseus to an exit without being caught."
  );
  boardMessage.hidden = true;
  boardMessage.textContent = "";
}

// ------------------------------------------------------------
// Canvas sizing
// ------------------------------------------------------------

function resizeCanvas() {
  const maxWidth = Math.max(
    240,
    Math.min(window.innerWidth - 64, 900)
  );

  const tileSize = Math.min(
    TILE_SIZE,
    Math.floor(maxWidth / width)
  );

  const boardWidth = width * tileSize;
  const boardHeight = height * tileSize;

  canvas.width = boardWidth;
  canvas.height = boardHeight;

  canvas.style.width = `${boardWidth}px`;
  canvas.style.height = `${boardHeight}px`;

  boardStage.style.width = `${boardWidth}px`;
  boardStage.style.height = `${boardHeight}px`;
}

// ------------------------------------------------------------
// Drawing
// ------------------------------------------------------------

function drawImageTile(image, x, y) {
  const tileSize = canvas.width / width;

  if (image) {
    ctx.drawImage(
      image,
      x * tileSize,
      y * tileSize,
      tileSize,
      tileSize
    );

    return;
  }

  // Fallback if an asset has not been copied into public/assets/.
  ctx.fillStyle = "#555";
  ctx.fillRect(
    x * tileSize,
    y * tileSize,
    tileSize,
    tileSize
  );
}

function drawFallbackCharacter(position, color, letter) {
  const tileSize = canvas.width / width;
  const centerX = (position.x + 0.5) * tileSize;
  const centerY = (position.y + 0.5) * tileSize;
  const radius = tileSize * 0.32;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.floor(tileSize * 0.35)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, centerX, centerY);
}

function drawCharacter(image, position, color, letter) {
  const tileSize = canvas.width / width;
  const pixelX = position.x * tileSize;
  const pixelY = position.y * tileSize;

  if (image) {
    ctx.drawImage(
      image,
      pixelX,
      pixelY,
      tileSize,
      tileSize
    );
  } else {
    const centerX = pixelX + tileSize / 2;
    const centerY = pixelY + tileSize / 2;
    const radius = tileSize * 0.32;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.floor(tileSize * 0.35)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, centerX, centerY);
  }
}


function drawBoard(
  visualTheseus = theseus,
  visualMinotaurs = minotaurs
) {
  if (!tiles.length || !canvas.width || !canvas.height) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the floor and walls.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (tiles[y][x] === "wall") {
        drawImageTile(assets.wall, x, y);
      } else {
        drawImageTile(assets.floor, x, y);
      }
    }
  }

  // Draw portals above the floor.
  for (const exit of exits) {
    drawImageTile(assets.portal, exit.x, exit.y);
  }

  // Draw Theseus at the current visual position.
  drawCharacter(
    assets.theseus,
    visualTheseus,
    "#218c44",
    "T"
  );

  // Draw each Minotaur at its current visual position.
  for (const minotaur of visualMinotaurs) {
    drawCharacter(
      assets.minotaur,
      minotaur,
      "#c0392b",
      "M"
    );
  }

  // Highlight Theseus's current visual tile.
  const tileSize = canvas.width / width;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = Math.max(1, tileSize * 0.025);

  ctx.strokeRect(
    visualTheseus.x * tileSize + 2,
    visualTheseus.y * tileSize + 2,
    tileSize - 4,
    tileSize - 4
  );
}

function animatePosition(from, to, renderFrame) {
  return new Promise((resolve) => {
    const startTime = performance.now();

    function frame(now) {
      const progress = Math.min(
        (now - startTime) / TILE_ANIMATION_MS,
        1
      );

      // Smooth acceleration and deceleration.
      const eased = progress * progress * (3 - 2 * progress);

      const position = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
      };

      renderFrame(position);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}


// ------------------------------------------------------------
// Movement
// ------------------------------------------------------------

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function getDestination(position, direction) {
  const delta = DIRECTIONS[direction];

  return {
    x: position.x + delta.x,
    y: position.y + delta.y,
  };
}


async function moveTheseus(direction) {
  if (gameOver || isAnimatingTurn || !theseus) {
    return;
  }

  const destination = getDestination(theseus, direction);

  if (isWall(destination)) {
    setStatus("A wall blocks the way.");
    return;
  }

  isAnimatingTurn = true;

  const startingPosition = copyPosition(theseus);

  // Update the logical position while displaying the animation.
  theseus = destination;
  moveCount += 1;

  await animatePosition(
    startingPosition,
    destination,
    (visualPosition) => {
      drawBoard(visualPosition, minotaurs);
    }
  );

  // Capture is checked before the Minotaurs move.
  if (isMinotaurAt(theseus)) {
    finishGame(false);
    return;
  }

  // Reaching any portal wins immediately.
  if (isExit(theseus)) {
    finishGame(true);
    return;
  }

  setStatus("The Minotaurs pursue Theseus…");

  await runMinotaurTurn();
}


// ------------------------------------------------------------
// Minotaur AI
// ------------------------------------------------------------

/**
 * Choose one step for a Minotaur.
 *
 * The Minotaur prefers horizontal movement toward Theseus.
 * If that movement is blocked, it tries vertical movement.
 *
 * If horizontal movement is unavailable, vertical movement is tried.
 * If neither direction is available, the Minotaur stays in place.
 */
function chooseMinotaurStep(minotaur) {
  const horizontalDifference = theseus.x - minotaur.x;
  const verticalDifference = theseus.y - minotaur.y;

  const candidates = [];

  if (horizontalDifference !== 0) {
    candidates.push({
      x: minotaur.x + Math.sign(horizontalDifference),
      y: minotaur.y,
    });
  }

  if (verticalDifference !== 0) {
    candidates.push({
      x: minotaur.x,
      y: minotaur.y + Math.sign(verticalDifference),
    });
  }

  for (const candidate of candidates) {
    if (!isWall(candidate)) {
      return candidate;
    }
  }

  return copyPosition(minotaur);
}

async function runMinotaurTurn() {
  if (gameOver) {
    isAnimatingTurn = false;
    return;
  }

  for (let i = 0; i < minotaurs.length; i += 1) {
    for (
      let step = 0;
      step < MINOTAUR_STEPS_PER_TURN;
      step += 1
    ) {
      const startingPosition = copyPosition(minotaurs[i]);
      const destination = chooseMinotaurStep(startingPosition);

      if (samePosition(destination, startingPosition)) {
        break;
      }

      // Update the logical position, then animate only this Minotaur.
      minotaurs[i] = destination;

      await animatePosition(
        startingPosition,
        destination,
        (visualPosition) => {
          const visualMinotaurs = minotaurs.map(copyPosition);
          visualMinotaurs[i] = visualPosition;

          drawBoard(theseus, visualMinotaurs);
        }
      );

      // Check for capture after every individual step.
      if (samePosition(minotaurs[i], theseus)) {
        finishGame(false);
        return;
      }
    }
  }

  isAnimatingTurn = false;
  drawBoard();

  setStatus(`Turn ${moveCount} complete. Find an exit!`);
}

// ------------------------------------------------------------
// Victory and defeat
// ------------------------------------------------------------

function finishGame(won) {
  gameOver = true;
  gameWon = won;
  isAnimatingTurn = false;

  drawBoard();

  if (won) {
    const message =
      `You escaped through the portal in ${moveCount} move` +
      `${moveCount === 1 ? "" : "s"}!`;

    setStatus(message, "won");

    boardMessage.textContent = "You escaped!";
    boardMessage.dataset.state = "won";
  } else {
    setStatus(
      "The Minotaur caught Theseus. Restart to try again.",
      "lost"
    );

    boardMessage.textContent = "Caught by the Minotaur!";
    boardMessage.dataset.state = "lost";
  }

  boardMessage.hidden = false;
}

// ------------------------------------------------------------
// Input handlers
// ------------------------------------------------------------

function handleKeyDown(event) {
  const key = event.key.toLowerCase();

  const keyToDirection = {
    arrowup: "up",
    w: "up",

    arrowdown: "down",
    s: "down",

    arrowleft: "left",
    a: "left",

    arrowright: "right",
    d: "right",
  };

  const direction = keyToDirection[key];

  if (!direction) {
    return;
  }

  // Prevent page scrolling when the player uses arrow keys.
  event.preventDefault();

  moveTheseus(direction);
}

function handleTouchControl(event) {
  const button = event.target.closest("[data-move]");

  if (!button) {
    return;
  }

  moveTheseus(button.dataset.move);
}

restartButton.addEventListener("click", () => {
  if (currentMapDefinition) {
    resetGame();
  }
});

document.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement
  ) {
    return;
  }

  handleKeyDown(event);
});

document
  .querySelector(".touch-controls")
  .addEventListener("click", handleTouchControl);

window.addEventListener("resize", () => {
  if (currentMapDefinition) {
    resizeCanvas();
    drawBoard();
  }
});

window.addEventListener("popstate", () => {
  const requestedMap = getRequestedMapName();
  if (requestedMap && findMapByName(requestedMap)) {
    selectMap(requestedMap, { updateHistory: false });
  } else if (maps.length > 0) {
    selectMap(maps[0].name, { updateHistory: false });
  }
});

// ------------------------------------------------------------
// Start the game
// ------------------------------------------------------------

async function startGame() {

  await loadAssets();

  const requestedMap = getRequestedMapName();

  const startingMap = findMapByName(requestedMap)
    ? requestedMap
    : DEFAULT_MAP;

  await selectMap(startingMap, {
    updateHistory: !requestedMap,
  });
}

startGame();
