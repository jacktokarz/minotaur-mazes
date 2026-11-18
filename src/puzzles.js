/**
 * Catalog of every puzzle type on the site.
 *
 * The landing page builds one card per entry, in this order.
 * To add a new puzzle type, add an entry here (and see the notes in
 * vite.config.js and vercel.json about registering its page).
 *
 * Fields:
 *   slug         URL folder for the puzzle type, e.g. "minotaur-mazes"
 *   title        Name shown on the card
 *   url          Link to the puzzle type's page
 *   image        Card image (put it in public/<slug>/)
 *   imageAlt     Text description of the image for screen readers
 *   tagline      One-line hook
 *   description  How the puzzle works, in a sentence or three
 *   count        How many puzzles of this type are on the site
 *   countLabel   [singular, plural] word for one puzzle, e.g. ["maze", "mazes"]
 */

import minotaurMaps from "./minotaur-mazes/maps-index.json";
import zooPuzzles from "./zoorganizer/puzzles-index.json";
import mirrorPlacementPuzzles from "./mirror-maze-placement/puzzles-index.json";
import mirrorRotationPuzzles from "./mirror-maze-rotation/puzzles-index.json";
import spacePuzzles from "./space-roundup/puzzles-index.json";

export const PUZZLE_TYPES = [
  {
    slug: "minotaur-mazes",
    title: "Minotaur Mazes",
    url: "/minotaur-mazes/",
    image: "/minotaur-mazes/preview.png",
    imageAlt:
      "A small stone maze with Theseus, a Minotaur, and a glowing exit portal.",
    tagline: "Guide Theseus to the exit. Don't get caught!",
    description:
      "Lead Theseus through a walled maze to an exit portal. Every time " +
      "you take a step, each Minotaur takes two steps toward you, always " +
      "trying to close the horizontal gap before the vertical one. Their " +
      "chase is completely predictable, so use the walls to trap them " +
      "and slip away.",
    // Counted automatically from the files in public/minotaur-mazes/maps/.
    count: minotaurMaps.length,
    countLabel: ["maze", "mazes"],
  },
  {
    slug: "zoorganizer",
    title: "zoOrganizer",
    url: "/zoorganizer/",
    image: "/zoorganizer/preview.png",
    imageAlt:
      "A pixel-art zoo with fenced grass, sand, water, rock and snow enclosures.",
    tagline: "Give every animal the home it wants.",
    description:
      "You run the zoo, and the new arrivals are picky. Read what each " +
      "animal wants, then drag every one of them into an enclosure. When " +
      "you think everyone is happy, submit your arrangement. If it's " +
      "wrong, you won't be told why, so think it through!",
    // Counted automatically from the files in puzzles/zoorganizer/.
    count: zooPuzzles.length,
    countLabel: ["puzzle", "puzzles"],
  },
  {
    slug: "mirror-maze-placement",
    title: "Mirror Maze (Placement)",
    url: "/mirror-maze-placement/",
    image: "/mirror-maze-placement/preview.png",
    imageAlt:
      "A grid maze with glowing beams of light bouncing off mirrors between matching letters.",
    tagline: "Bounce the light so every letter finds its match.",
    description:
      "Each letter on the edge of the maze shines a beam of light inward. " +
      "Place double-sided mirrors in the hallways so every letter is " +
      "connected to its matches, and never to a different letter. Letters " +
      "in the middle of the maze can catch light from any side.",
    // Counted automatically from the files in puzzles/mirror-maze-placement/.
    count: mirrorPlacementPuzzles.length,
    countLabel: ["maze", "mazes"],
  },
  {
    slug: "mirror-maze-rotation",
    title: "Mirror Maze (Rotation)",
    url: "/mirror-maze-rotation/",
    image: "/mirror-maze-rotation/preview.png",
    imageAlt:
      "A brick maze with pairs of coloured icons around the edge and mirrors that turn on pivots.",
    tagline: "Every bounce turns a mirror. Pick the order carefully.",
    description:
      "The mirrors are already in place, but every time light bounces off " +
      "one, it flips to the other diagonal. Choose the order the matching " +
      "pairs fire in so that every pair's light reaches its partner, then " +
      "watch them go one shot at a time.",
    // Counted automatically from the files in puzzles/mirror-maze-rotation/.
    count: mirrorRotationPuzzles.length,
    countLabel: ["maze", "mazes"],
  },
  {
    slug: "space-roundup",
    title: "Space Roundup",
    url: "/space-roundup/",
    image: "/space-roundup/preview.png",
    imageAlt:
      "A little round blue space creature in an asteroid field, with colourful friends and a glowing exit portal.",
    tagline: "Round up your friends and fly home.",
    description:
      "You're a round little space creature. Pick a direction and you fly " +
      "until you hit an asteroid or a friend. Bump into every friend to " +
      "pick them up, and the exit opens so you can all fly home.",
    // Counted automatically from the files in puzzles/space-roundup/.
    count: spacePuzzles.length,
    countLabel: ["maze", "mazes"],
  },
];
