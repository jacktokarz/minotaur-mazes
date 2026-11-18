/**
 * Colours and pair icons for Mirror Maze letters.
 *
 * Placement shows letters (A, B, C...). Rotation shows an icon instead,
 * because the letters would look like a firing order. Puzzle files still use
 * letters; each letter always gets the same icon and colour:
 *
 *   A circle    B square    C triangle   D diamond   E star     F heart
 *   G hexagon   H moon      I plus       J drop      K ring     L bolt
 *   M leaf      (then the shapes repeat in different colours)
 */

const COLORS = [
  "#f6c453", // gold
  "#5fc4e8", // sky blue
  "#f08a7e", // coral
  "#9bd17a", // green
  "#c59cf0", // lilac
  "#f5a25d", // orange
  "#6fd6c0", // teal
  "#e887c2", // pink
];

function starPoints(cx, cy, outer, inner, points = 5) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
}

// Each shape is SVG markup in a 100x100 box.
const SHAPES = [
  ["circle", '<circle cx="50" cy="50" r="30"/>'],
  ["square", '<rect x="22" y="22" width="56" height="56" rx="6"/>'],
  ["triangle", '<polygon points="50,16 86,80 14,80"/>'],
  ["diamond", '<polygon points="50,12 84,50 50,88 16,50"/>'],
  ["star", `<polygon points="${starPoints(50, 53, 38, 16)}"/>`],
  ["heart", '<path d="M50 84 C22 64 12 48 20 33 C28 18 45 20 50 33 C55 20 72 18 80 33 C88 48 78 64 50 84 Z"/>'],
  ["hexagon", '<polygon points="50,14 81,32 81,68 50,86 19,68 19,32"/>'],
  ["moon", '<path d="M60 14 A36 36 0 1 0 86 62 A28 28 0 1 1 60 14 Z"/>'],
  ["plus", '<polygon points="40,14 60,14 60,40 86,40 86,60 60,60 60,86 40,86 40,60 14,60 14,40 40,40"/>'],
  ["drop", '<path d="M50 12 C50 12 78 46 78 62 A28 28 0 0 1 22 62 C22 46 50 12 50 12 Z"/>'],
  ["ring", '<path fill-rule="evenodd" d="M50 16 A34 34 0 1 1 49.9 16 Z M50 32 A18 18 0 1 0 50.1 32 Z"/>'],
  ["bolt", '<polygon points="58,10 22,56 46,56 38,90 78,40 54,40"/>'],
  ["leaf", '<path d="M18 82 C18 40 44 16 84 16 C84 56 60 82 18 82 Z"/>'],
];

function letterIndex(letter) {
  return letter.charCodeAt(0) - 65;
}

/** The colour used for a letter's squares and light. */
export function letterColor(letter) {
  return COLORS[letterIndex(letter) % COLORS.length];
}

/** The name of a letter's icon, e.g. "circle". */
export function iconName(letter) {
  return SHAPES[letterIndex(letter) % SHAPES.length][0];
}

/** Plural for messages: "circles", "squares", ... */
export function iconPlural(letter) {
  return `${iconName(letter)}s`;
}

/** An <svg> of the letter's icon, filled with its colour. */
export function iconSvg(letter, className = "mm-icon") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.style.setProperty("--icon-color", letterColor(letter));
  svg.innerHTML = SHAPES[letterIndex(letter) % SHAPES.length][1];
  return svg;
}
