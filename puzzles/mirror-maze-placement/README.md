# Mirror Maze (Placement) puzzle files

Each `.txt` file in this folder is one puzzle. The filename becomes its
address: `Easier.txt` is played at `/mirror-maze-placement/Easier`.

When the site builds (`npm run dev` / `npm run build`),
`scripts/build-mirror-puzzles.mjs` checks each file and publishes it for the
game. If a file has a mistake, the build stops and tells you the file and line
number.

## Format

The file starts with the grid. Everything else is optional.

```
#C#.#.#
B......
#.#.#.#
...B..C
#.#.#.#
A.....B
#.#.#A#

[info]
title: Easier
post: https://propuzz.substack.com/p/your-post
post-text: The original post also has the harder version.

[limits]
mirrors: 5

[hints]
minor: A general idea of the strategy.
major: A specific step that gets the player partway there.
```

### The grid

| Symbol | Meaning |
|--------|---------|
| `#` | Wall: blocks light, can't hold a mirror |
| `.` | Hallway: light passes through; the player can put a mirror here |
| `A`–`Z` | A letter to connect |
| `/` or `\` | A mirror that's already in place (the player can't move it) |

Every row must be the same length. Blank lines before or after the grid are
fine; a blank line in the middle of it isn't.

### How the light works

- Each letter **on the edge** of the grid shines one beam straight into the
  grid (a letter on the top edge shines down, and so on). Letters can't go in
  the corners, since it wouldn't be clear which way they shine.
- Light travels in straight lines through hallways. Walls stop it, and light
  that leaves the grid is lost.
- Mirrors are double-sided and turn light 90°: `/` runs from top-right to
  bottom-left, and `\` runs from top-left to bottom-right.
- Light stops at the first letter it reaches, on the edge or inside the grid.
  A letter **inside** the grid doesn't shine, but it can catch light from any
  side (and from more than one beam).

The puzzle is solved when:

1. every edge letter's light ends at a letter of the same kind, and
2. all copies of each letter are connected to each other (directly, or through
   other copies of the same letter; e.g. two edge B's both shining into the B
   in the middle).

Extra mirrors that no light touches don't matter (use `[limits]` if you don't
want players to have spare mirrors).

When the player presses Check, the light is drawn either way. Light that goes
wrong is dashed, with a red cross where it hits a wall or leaves the maze, and
a red frame on any letter it shouldn't have touched.

Every letter needs at least one copy on the edge (light only starts there).
The build stops with a message if a letter breaks this rule, appears only
once, sits in a corner, or faces straight into a wall.

### `[info]` (optional)

| Setting     | Meaning |
|-------------|---------|
| `title`     | Shown above the puzzle. Defaults to the filename. |
| `post`      | Link to the Substack post. Shows the "From the Professional Puzzles Substack" banner. |
| `post-text` | Custom wording for that banner. |

### `[limits]` (optional)

How many mirrors the player may place. Once they reach a limit they can't
place another (a message tells them), and the limit is added to the puzzle's
How to play list and shown in the mirror counter under the board.

```
[limits]
mirrors: 5
\ mirrors: 3
/ mirrors: 2
```

`mirrors:` is the total, `\ mirrors:` and `/ mirrors:` limit each type. Use
any combination of the three lines. Mirrors already printed in the grid
don't count. `npm run mirror-test` respects the limits.

### `[hints]` (optional)

The hints behind the Hint button. The button unlocks after the puzzle has
been on screen for 30 seconds and offers the minor hint. Once the player has
seen it, the button stays available: it shows the minor hint again and offers
the major hint.

- If you add `[hints]`, it needs one `minor:` and one `major:` line. Repeat
  either one to add more paragraphs to that hint.
- Without `[hints]` there's no Hint button, and the build prints a reminder.
- Hints are published with the puzzle, so anyone digging through the page's
  files can read them early.

## Testing a puzzle

Every puzzle should have exactly one solution. To check, run:

```
npm run mirror-test easier    # checks every Mirror Maze puzzle called Easier
npm run mirror-test           # checks every Mirror Maze puzzle
```

The test tries every way of placing mirrors where light can reach and lists
each arrangement that solves the puzzle. It passes when there is exactly
**one**:

```
=== mirror-maze-placement: Easier  (puzzles/mirror-maze-placement/Easier.txt)
  PASS  Exactly 1 solution. (searched in 0.0s)

  Solution 1: \ mirrors: 5, / mirrors: 0. \ at row 2, column 2; ...
    #C#.#.#
    B\...\.
    ...
```

If there's more than one, each is printed so you can see where to add a wall
or a fixed mirror. Mirrors on squares that no light reaches aren't counted as
different solutions.
