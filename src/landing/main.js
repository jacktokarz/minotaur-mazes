import { PUZZLE_TYPES } from "../puzzles.js";
import minotaurMaps from "../minotaur-mazes/maps-index.json";
import "../shared/base.css";
import "./landing.css";

// ------------------------------------------------------------
// Old links
// ------------------------------------------------------------

// Before the landing page existed, mazes lived at the top level of the
// site (e.g. /Easier). Links like that may already be in Substack posts,
// so send them to the maze's new address (/minotaur-mazes/Easier).
function findLegacyMazeUrl(pathname) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length !== 1) {
    return null;
  }

  let name = segments[0];

  try {
    name = decodeURIComponent(name);
  } catch {
    // Leave malformed names as they are.
  }

  const map = minotaurMaps.find(
    (entry) => entry.name.toLowerCase() === name.toLowerCase()
  );

  return map ? map.url : null;
}

function isHomePath(pathname) {
  return pathname === "/" || pathname === "/index.html";
}

// ------------------------------------------------------------
// Puzzle cards
// ------------------------------------------------------------

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function formatCount(count, [singular, plural]) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function createPuzzleCard(puzzle) {
  const card = createElement("article", "puzzle-card");
  const inner = createElement("div", "puzzle-card-inner");

  // Image
  const media = createElement("div", "puzzle-card-media");
  const image = createElement("img");
  image.src = puzzle.image;
  image.alt = puzzle.imageAlt ?? "";
  image.loading = "lazy";
  media.append(image);

  // Text
  const body = createElement("div", "puzzle-card-body");

  const title = createElement("h3", "puzzle-card-title");
  const link = createElement("a", "puzzle-card-link", puzzle.title);
  link.href = puzzle.url;
  title.append(link);

  const tagline = createElement("p", "puzzle-card-tagline", puzzle.tagline);

  const howItWorks = createElement("p", "puzzle-card-description");
  howItWorks.append(
    createElement("strong", "", "How it works: "),
    puzzle.description
  );

  const footer = createElement("div", "puzzle-card-footer");
  footer.append(
    createElement(
      "span",
      "puzzle-card-count",
      formatCount(puzzle.count, puzzle.countLabel)
    ),
    createElement("span", "puzzle-card-cta", "Play \u2192")
  );

  body.append(title, tagline, howItWorks, footer);
  inner.append(media, body);
  card.append(inner);

  return card;
}

function renderPuzzleGrid() {
  const grid = document.querySelector("#puzzle-grid");
  grid.replaceChildren(...PUZZLE_TYPES.map(createPuzzleCard));
}

function showNotFoundNotice(pathname) {
  let readablePath = pathname;

  try {
    readablePath = decodeURIComponent(pathname);
  } catch {
    // Show the raw path if it can't be decoded.
  }

  const notice = document.querySelector("#page-notice");
  notice.textContent =
    `There's no page at "${readablePath}". Pick a puzzle below!`;
  notice.hidden = false;
}

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------

const legacyMazeUrl = findLegacyMazeUrl(location.pathname);

if (legacyMazeUrl) {
  location.replace(legacyMazeUrl + location.search + location.hash);
} else {
  renderPuzzleGrid();

  if (!isHomePath(location.pathname)) {
    showNotFoundNotice(location.pathname);
  }
}
