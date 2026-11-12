/**
 * Extra information for individual mazes, keyed by map name
 * (the .txt filename without the extension, e.g. "Test").
 *
 * substackPost  Link to the Substack post the maze comes from. When set,
 *               a banner linking to it is shown above the maze.
 * substackText  Optional custom wording for that banner.
 *
 * To add a banner to another maze, copy the Test entry and change it.
 */
export const MAP_INFO = {
  Test: {
    substackPost:
      "https://propuzz.substack.com/p/minotaur-and-theseus-mazes-appear",
    substackText:
      "The original post also has links to the other mazes.",
  },
};
