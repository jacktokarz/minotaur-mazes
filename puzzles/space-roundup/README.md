# Space Roundup puzzle files

Each `.txt` file in this folder is one puzzle. The filename becomes its
address: `Test.txt` is played at `/space-roundup/Test`.

When the site builds (`npm run dev` / `npm run build`),
`scripts/build-space-puzzles.mjs` checks each file and publishes it for the
game. If a file has a mistake, the build stops and tells you the file and line
number.

## Format

The file starts with the grid. Everything else is optional.

```
#########
#.#....##
#.....F.#
#.#.....#
#E.#....#
#.F..F..#
#.......#
#.P.....#
#########

[info]
title: Test
post: https://propuzz.substack.com/p/your-post
post-text: The original post also has the harder version.

[hints]
minor: A general idea of the strategy.
major: A specific step that gets the player partway there.
```

| Symbol | Meaning |
|--------|---------|
| `#` | Asteroid (wall) |
| `.` | Empty space |
| `P` | Where the player starts (exactly one) |
| `F` | A friend to collect (one or more) |
| `E` | The exit (one or more) |

Every row must be the same length. The edge of the grid stops the player like
an asteroid, so you don't have to surround the maze with `#` (but it looks
nicer if you do).

`[info]` and `[hints]` work the same as in the other puzzle types: `title`,
`post` and `post-text`; and `minor:` / `major:` lines (both needed if you add
`[hints]`; without it there's no Hint button).

## How it plays

- The player picks a direction (arrow keys, WASD, the on-screen arrows, or a
  swipe) and flies as far as they can.
- They stop when the next square is an asteroid, a friend, a locked exit, or
  the edge of the grid.
- Flying into a friend collects it: the player stops in the square before it,
  and the friend joins them (it leaves the board). A friend right next to the
  player is collected without moving.
- The exit is locked until every friend has been collected, and while it's
  locked it stops the player like an asteroid. Once it's open, flying into it
  (or across it) takes the player out of the maze: they win.
- Moves are unlimited, and Reset puts everything back at any time.

## Testing a puzzle

To check a puzzle can be won, run:

```
npm run space-test test     # checks Test.txt
npm run space-test          # checks every puzzle
```

It tries every move from every position the player can reach, then prints the
shortest win, step by step, and how many reachable positions are **dead ends**
(the player can get there but can never win from there, so they'd have to
reset):

```
=== Test  (puzzles/space-roundup/Test.txt)
  PASS  Can be won in 9 moves.
     1. up     -> row 7, column 3  (stopped by: friend!)
     2. left   -> row 7, column 2  (stopped by: asteroid)
     3. up     -> row 6, column 2  (stopped by: locked exit)
     ...
  55 positions reachable; 4 dead ends (e.g. right, up, left, left, up).
```
