# Mirror Maze (Rotation) puzzle files

Each `.txt` file in this folder is one puzzle. The filename becomes its
address: `Easier.txt` is played at `/mirror-maze-rotation/Easier`.

When the site builds (`npm run dev` / `npm run build`),
`scripts/build-mirror-puzzles.mjs` checks each file and publishes it for the
game. If a file has a mistake, the build stops and tells you the file and line
number.

The file format is the same as Mirror Maze (Placement) (see
`puzzles/mirror-maze-placement/README.md`), except:

- The mirrors (`/` and `\`) in the grid are the maze's mirrors. They turn
  during play; the player never places mirrors, so `[limits]` isn't used.
- Usually each letter is a **pair**: 2 copies on the edge. A letter can also
  have copies inside the grid (see "How it plays").

```
#F#C#D#.#B#
A....\.../E
#.#.#.#.#.#
.../.\.\...
#.#.#.#.#.#
./.......\D
#E#B#C#A#F#

[info]
title: Easier

[hints]
minor: A general idea of the strategy.
major: A specific step that gets the player partway there.
```

## Icons

Players see an icon instead of a letter (letters would look like a firing
order). Each letter always gets the same icon and colour, so you can refer to
them in hints:

| Letter | Icon | Letter | Icon | Letter | Icon |
|--------|------|--------|------|--------|------|
| A | circle (gold) | F | heart (orange) | K | ring (coral) |
| B | square (blue) | G | hexagon (teal) | L | bolt (green) |
| C | triangle (coral) | H | moon (pink) | M | leaf (lilac) |
| D | diamond (green) | I | plus (gold) | | |
| E | star (lilac) | J | drop (blue) | | |

After M the shapes repeat in different colours.

## How it plays

1. The player clicks the icons to number the pairs: the order they'll fire in.
2. Check fires the first pair. Light stops at the first icon it reaches,
   which must be its partner. For a plain pair, which end fires doesn't
   matter: light takes the same path either way. If the letter has a copy
   inside the grid, every copy on the edge fires in the same turn, and each
   beam must end at a matching icon (e.g. both outer B's shining into the B
   in the middle).
3. The mirrors don't move while the light travels, so a mirror the light hits
   twice in one turn is in the same position both times.
4. The light stays on screen, with the mirrors it bounced off glowing. The
   player presses Continue, and each of those mirrors flips once to the other
   diagonal (`/` becomes `\`, `\` becomes `/`), even if it was hit twice.
5. The player presses Continue again to fire the next pair, and so on.
6. When the last pair connects, the puzzle is solved (its light and mirrors
   stay on show; there's no final turn).
7. If a pair's light doesn't reach its partner, the shot is shown with a red
   cross. Continue puts the mirrors back the way they started and clears that
   pair's number and every number after it (if the 3rd pair misses, numbers
   3 and up are cleared), so the player has to renumber before pressing Check.

The game simulates every shot, so any order that works is accepted.

## Testing a puzzle

Every puzzle should have exactly one firing order that works. To check, run:

```
npm run mirror-test easier    # checks every Mirror Maze puzzle called Easier
npm run mirror-test           # checks every Mirror Maze puzzle
```

It tries every order and lists the ones that work:

```
=== mirror-maze-rotation: Easier  (puzzles/mirror-maze-rotation/Easier.txt)
  FAIL  4 firing orders work; there should be exactly 1. (searched in 0.0s)
    A B C D E F   (circles, squares, triangles, diamonds, stars, hearts)
    A B D C E F   (circles, squares, diamonds, triangles, stars, hearts)
    ...
```
