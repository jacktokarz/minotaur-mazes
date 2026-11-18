/**
 * Draws a Mirror Maze board: the squares, the mirrors, and the light.
 * Shared by every Mirror Maze variant (styles in ./board.css).
 *
 * Expects this markup:
 *   <div class="mm-board-wrap">
 *     <div class="mm-board"></div>
 *     <svg class="mm-light" aria-hidden="true"></svg>
 *   </div>
 *
 *   const board = createBoard(document.querySelector(".mm-board-wrap"));
 *   board.build(puzzle, { hallwayButtons: true });
 *   board.showMirror(3, 1, "/");
 *   await board.drawLight(beams);
 */
import { letterColor } from "./icons.js";

const SVG = "http://www.w3.org/2000/svg";
const LETTER = /^[A-Z]$/;

/** How long the light takes to draw (keep in step with board.css). */
export const BEAM_MS = 900;
/** How long a mirror takes to turn (keep in step with board.css). */
export const TURN_MS = 450;

const keyOf = (x, y) => `${x},${y}`;

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));
}

function mirrorGlyph() {
  // Always drawn as "\"; a "/" is the same glyph turned 90 degrees, so
  // turning a mirror can be animated as a rotation.
  const glyph = document.createElement("span");
  glyph.className = "mm-mirror";
  glyph.hidden = true;
  glyph.innerHTML =
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    '<line class="mm-mirror-glow" x1="14" y1="14" x2="86" y2="86"/>' +
    '<line class="mm-mirror-glass" x1="14" y1="14" x2="86" y2="86"/>' +
    "</svg>";
  return glyph;
}

/**
 * @param {HTMLElement} wrap  The .mm-board-wrap element.
 */
export function createBoard(wrap) {
  const boardElement = wrap.querySelector(".mm-board");
  const light = wrap.querySelector(".mm-light");
  const squares = new Map(); // "x,y" -> element

  // Crosses marking where light went wrong sit above everything, even the
  // letter squares (which sit above the light).
  const marks = document.createElementNS(SVG, "svg");
  marks.setAttribute("class", "mm-light mm-marks");
  marks.setAttribute("aria-hidden", "true");
  wrap.append(marks);
  let puzzle = null;

  /**
   * Draw the grid.
   *
   * @param options.hallwayButtons  hallway squares are buttons (Placement)
   * @param options.letterButtons   letter squares are buttons (Rotation)
   * @param options.drawLetter      (element, letter) => void; fills in a
   *                                letter square (default: shows the letter)
   * @param options.rotating        printed mirrors turn (Rotation) rather
   *                                than being fixed in place (Placement)
   */
  function build(newPuzzle, options = {}) {
    const {
      hallwayButtons = false,
      letterButtons = false,
      drawLetter = (element, letter) => { element.textContent = letter.letter; },
      rotating = false,
    } = options;

    puzzle = newPuzzle;
    squares.clear();
    boardElement.replaceChildren();
    wrap.style.setProperty("--cols", puzzle.width);
    boardElement.setAttribute(
      "aria-label",
      `Mirror maze, ${puzzle.width} by ${puzzle.height} squares`
    );

    const letterAt = new Map(puzzle.letters.map((letter) => [keyOf(letter.x, letter.y), letter]));

    puzzle.grid.forEach((row, y) => {
      [...row].forEach((symbol, x) => {
        let square;

        if (symbol === "#") {
          square = document.createElement("div");
          square.className = "mm-cell mm-wall";
          square.setAttribute("aria-hidden", "true");
        } else if (LETTER.test(symbol)) {
          const letter = letterAt.get(keyOf(x, y));
          square = document.createElement(letterButtons ? "button" : "div");
          if (letterButtons) square.type = "button";
          square.className = "mm-cell mm-letter";
          square.dataset.letter = symbol;
          square.style.setProperty("--letter-color", letterColor(symbol));
          drawLetter(square, letter);
        } else {
          const printed = symbol === "/" || symbol === "\\";
          const isButton = hallwayButtons && !printed;

          square = document.createElement(isButton ? "button" : "div");
          if (isButton) square.type = "button";
          // Three floor tiles, mixed so the floor doesn't look copy-pasted.
          square.className = `mm-cell mm-floor mm-floor-${((x * 7 + y * 3) % 3) + 1}`;
          if (printed) square.classList.add(rotating ? "mm-rotating" : "mm-fixed");
          square.append(mirrorGlyph());
        }

        square.dataset.x = x;
        square.dataset.y = y;
        squares.set(keyOf(x, y), square);
        boardElement.append(square);

        if (symbol === "/" || symbol === "\\") showMirror(x, y, symbol, { animate: false });
      });
    });

    light.setAttribute("viewBox", `0 0 ${puzzle.width} ${puzzle.height}`);
    marks.setAttribute("viewBox", `0 0 ${puzzle.width} ${puzzle.height}`);
    clearLight();
  }

  function square(x, y) {
    return squares.get(keyOf(x, y)) ?? null;
  }

  /**
   * Show a mirror ("/", "\\") or nothing (null) on a square. Changing "/" to
   * "\\" (or back) turns the mirror a quarter turn.
   */
  function showMirror(x, y, type, { animate = true } = {}) {
    const glyph = square(x, y)?.querySelector(".mm-mirror");
    if (!glyph) return;

    const previous = glyph.dataset.type || null;
    let angle = Number(glyph.dataset.angle ?? 0);

    if (!type) {
      glyph.hidden = true;
      glyph.dataset.type = "";
      return;
    }

    if (previous && previous !== type) angle += 90;
    else if (!previous) angle = type === "/" ? 90 : 0;

    glyph.classList.toggle("mm-no-animation", !animate || !previous);
    glyph.hidden = false;
    glyph.dataset.type = type;
    glyph.dataset.angle = angle;
    glyph.style.setProperty("--angle", `${angle}deg`);
  }

  /**
   * Highlight the mirrors that are about to turn (pass [] to clear).
   * @param {{ x: number, y: number }[]} squares
   */
  function markMirrors(squares) {
    for (const marked of boardElement.querySelectorAll(".mm-will-turn")) {
      marked.classList.remove("mm-will-turn");
    }
    for (const { x, y } of squares) square(x, y)?.classList.add("mm-will-turn");
  }

  /**
   * Turn several mirrors at once. The light dims as they turn, since it no
   * longer matches them. Resolves when they've finished turning.
   */
  async function turnMirrors(changes) {
    markMirrors([]);
    dimLight();
    for (const { x, y, type } of changes) showMirror(x, y, type);
    await wait(TURN_MS);
  }

  /** Dim the light that's showing (e.g. once the mirrors it used have turned). */
  function dimLight() {
    light.classList.add("mm-light-dim");
  }

  function clearLight() {
    light.classList.remove("mm-light-dim");
    light.replaceChildren();
    marks.replaceChildren();
  }

  /**
   * Where a beam goes wrong: the first letter of another kind it touches
   * ({ letter }), or the spot where it hits a wall / leaves the grid ({ x, y }).
   */
  function problemOf(beam) {
    const wrong = beam.letters.find((letter) => letter.letter !== beam.start.letter);
    if (wrong) return { letter: wrong };
    if (beam.end !== "letter") return beam.drawn.at(-1);
    return null;
  }

  function cross(x, y, r, className) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", `M${x - r} ${y - r} L${x + r} ${y + r} M${x + r} ${y - r} L${x - r} ${y + r}`);
    path.setAttribute("class", className);
    return path;
  }

  /** Red cross where light stopped; red frame + small cross on a wrong letter. */
  function markProblem(problem) {
    if (!problem.letter) {
      marks.append(cross(problem.x, problem.y, 0.2, "mm-problem"));
      return;
    }

    const { x, y } = problem.letter;
    const frame = document.createElementNS(SVG, "rect");
    frame.setAttribute("x", x + 0.06);
    frame.setAttribute("y", y + 0.06);
    frame.setAttribute("width", 0.88);
    frame.setAttribute("height", 0.88);
    frame.setAttribute("rx", 0.1);
    frame.setAttribute("class", "mm-problem mm-problem-frame");

    // Top-left corner (Rotation puts the firing number in the top-right).
    const badge = document.createElementNS(SVG, "circle");
    badge.setAttribute("cx", x + 0.14);
    badge.setAttribute("cy", y + 0.14);
    badge.setAttribute("r", 0.16);
    badge.setAttribute("class", "mm-problem-badge");

    marks.append(frame, badge, cross(x + 0.14, y + 0.14, 0.07, "mm-problem mm-problem-small"));
  }

  /**
   * Draw beams of light (from traceBeam). Beams that go wrong are drawn
   * dashed, with a cross where they went wrong. Resolves when the light has
   * finished drawing.
   */
  function drawLight(beams, { replace = true } = {}) {
    if (replace) clearLight();

    for (const beam of beams) {
      const points = beam.points.map((point) => ({ x: point.x + 0.5, y: point.y + 0.5 }));

      // A beam that hits a wall or leaves the grid stops at the edge of that square.
      if (beam.end !== "letter" && points.length >= 2) {
        const last = points.at(-1);
        const before = points.at(-2);
        points[points.length - 1] = { x: (last.x + before.x) / 2, y: (last.y + before.y) / 2 };
      }
      beam.drawn = points;

      const problem = problemOf(beam);
      const color = letterColor(beam.start.letter);

      const line = document.createElementNS(SVG, "polyline");
      line.setAttribute("points", points.map((p) => `${p.x},${p.y}`).join(" "));
      line.setAttribute("pathLength", "1");
      line.setAttribute("class", problem ? "mm-beam mm-beam-bad" : "mm-beam");
      line.style.setProperty("--beam-color", color);
      light.append(line);

      if (problem) markProblem(problem);
    }

    return wait(BEAM_MS);
  }

  return {
    build,
    square,
    showMirror,
    turnMirrors,
    markMirrors,
    drawLight,
    dimLight,
    clearLight,
    element: boardElement,
  };
}
