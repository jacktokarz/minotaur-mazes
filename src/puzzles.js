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
];
