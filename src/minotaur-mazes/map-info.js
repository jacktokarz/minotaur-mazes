/**
 * Extra information for individual mazes, keyed by map name
 * (the .txt filename without the extension, e.g. "Test").
 *
 * substackPost  Link to the Substack post the maze comes from. When set,
 *               a banner linking to it is shown above the maze.
 * substackText  Optional custom wording for that banner.
 * hints         { minor, major } for the Hint button (see src/shared/hints.js).
 *               minor: a general idea of the strategy.
 *               major: specific moves that get the player partway there.
 *               Each can be a string, or an array of strings for several
 *               paragraphs. Mazes without hints don't show a Hint button.
 *
 * To add a banner to another maze, copy the Test entry and change it.
 */
export const MAP_INFO = {
  Test: {
    substackPost:
      "https://propuzz.substack.com/p/minotaur-and-theseus-mazes-appear",
    substackText:
      "The original post also has links to the other mazes.",
    hints: {
      minor:
        "The Minotaur is strong, but it isn't very bright. Every step, it " +
        "tries to move sideways toward you first, then up or down. If walls " +
        "block both of those, it just stands there looking confused. Use that.",
      major:
        "Move Up, then Left. The Minotaur walks right up underneath the wall " +
        "in the middle of the maze, and it can't go through the wall to " +
        "follow you north. Now make a run for it.",
    },
  },

  Easier: {
    hints: {
      minor:
        "The Minotaur starts out between you and the exit, so you can't just " +
        "make a dash for it. Look for a loop: a path that goes all the way " +
        "around in a circle. If you lead the Minotaur around one side of a " +
        "loop until it gets stuck on a wall, you can double back around the " +
        "other side.",
      major: [
        "Don't step Right first. It's a trap you can't recover from! Instead, " +
          "step Left, then take the long way over the top to the bottom-right " +
          "corner: Up, Up, Right, Right, Up, Right, Right, Down, Down, Down.",
        "The Minotaur has now come out of its room to meet you in the bottom " +
          "corridor. Go straight back up the right-hand side to the top, then " +
          "take one step Left. The Minotaur follows you and gets stuck under " +
          "a wall. It stays stuck as long as you keep to its left and out of " +
          "the bottom row.",
      ],
    },
  },

  Mediumer: {
    hints: {
      minor:
        "Any corner where two walls meet is a potential Minotaur trap. Lure " +
        "the Minotaur into one, then stand where both of the steps it wants " +
        "to take run into a wall. It'll stay stuck there until you let it " +
        "out. One trap might not be enough to get you all the way home.",
      major:
        "Step Left, then Right three times. The Minotaur is now wedged into " +
        "the little nook just above the bottom corridor. It can't get out as " +
        "long as you stay to its left and don't go above it, so head Left " +
        "along the bottom and start up the left side of the maze. Once you " +
        "climb above it, it'll break free, so have your next trap ready.",
    },
  },

  Expert: {
    hints: {
      minor:
        "Three Minotaurs is too many to outrun, so deal with them one at a " +
        "time. Trap each one behind a wall, and remember you can let a " +
        "trapped Minotaur out on purpose when it suits you. Handy trick: if " +
        "two Minotaurs ever land on the same square, they move together for " +
        "the rest of the game, which is just as good as having one fewer " +
        "Minotaur.",
      major: [
        "Start by heading up and to the left: Left, Left, Up, Up, Up, Left, " +
          "Left, Up, Up, Up, Left, Left, Left, Right.",
        "The top Minotaur is now pinned against the wall beside it, and the " +
          "bottom Minotaur has boxed itself into a nook on the left side of the " +
          "maze. Your next goal is to get those two standing on the same " +
          "square. Keep an eye on the Minotaur on the right: it'll come after " +
          "you once you head south.",
      ],
    },
  },

  // Not a real maze: it's where people land when they guess the URL of the
  // premium puzzle. (The walls spell CHEATER, and Theseus can't move.)
  Harder: {
    hints: {
      minor: "Try reading the walls. They have a message for you.",
      major: [
        "There's no way out. Theseus is surrounded, and every move gets him " +
          "caught. This maze was never going to let you win.",
        "The real Harder maze is waiting for premium subscribers on the " +
          "Professional Puzzles Substack. Subscribe, and maybe Theseus will " +
          "forgive you. The Minotaurs won't.",
      ],
    },
  },
};
