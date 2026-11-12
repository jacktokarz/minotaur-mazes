# zoOrganizer puzzle files

Each `.txt` file in this folder is one puzzle. The filename becomes its
address: `Test.txt` is played at `/zoorganizer/Test`.

These files are **not** published as-is. When the site builds
(`npm run dev` / `npm run build`), `scripts/build-zoo-puzzles.mjs` checks
each file and publishes a copy where the solution is replaced by a
fingerprint, so players can't read the answer in their browser. If a file
has a mistake, the build stops and tells you the file and line number.

> Note: if your GitHub repository is public, anyone can still read these
> source files (including solutions) on GitHub.

## Format

```
# Lines starting with # are comments.
title: Big Cats
post: https://propuzz.substack.com/p/your-post
post-text: The original post also has the harder version.
signs: on

[clues]
Lion: "I want the sunniest spot."
Tiger: "I must be next door to the lion."
Nobody wants to live in the water.

[enclosures]
A: grass
B: sand
C: water

[layout]
,,^,,,,
.AA.BB.
.AA.BB.
...CC..

[animals]
1: Lion
2: Tiger
3: Penguin
4: Penguin

[solution]
A: 1, 2
B: 3, 4
C:
```

### Settings (top of the file, all optional)

| Setting     | Meaning |
|-------------|---------|
| `title`     | Shown above the puzzle. Defaults to the filename. |
| `post`      | Link to the Substack post. Shows the "From the Professional Puzzles Substack" banner. |
| `post-text` | Custom wording for that banner. |
| `signs`     | `on` (default) shows each enclosure's sign; `off` hides them. |

The general rules (how to place animals, "next door" means sharing a fence,
enclosures can hold several animals or none, and so on) are already on the
page for every puzzle, so a puzzle file only needs its clues.

### `[clues]`

Each line in `[clues]` is one clue. If a clue starts with a short name and a
colon (`Lion: ...`), the name is shown in bold. List markers like `- ` or
`1. ` are removed automatically.

### `[enclosures]`

One line per enclosure: `ID: ground`.

- **ID** is a single capital letter (`A`–`Z`). It links the enclosure to its
  squares in `[layout]` and is used in `[solution]`; players never see it.
- **ground** is one of: `grass`, `sand`, `water`, `rock`, `snow`, `dirt`,
  `jungle`. The enclosure's sign shows this word ("Grass", "Sand", ...).

### `[layout]`

A grid of characters (every row the same length). Each character is one
square on the map:

| Symbol | Meaning |
|--------|---------|
| `A`–`Z` | Part of that enclosure |
| `.` | Gravel path |
| `,` | Lawn |
| `^` | Tree (on lawn) |

An enclosure can be any shape, as long as all of its squares touch. Fences are
drawn automatically around every enclosure. Animals are arranged in the
largest rectangle inside the enclosure.

### `[animals]`

One animal per line, numbered in order starting at 1: `1: Lion`, `2: Tiger`,
`3: Penguin`, ... The numbers give every animal its own ID, so a puzzle can
include more than one of the same animal (`3: Penguin`, `4: Penguin`).

Animals with the same name look identical on the board, so they are
interchangeable when an answer is checked: swapping penguin 3 and penguin 4
counts as the same arrangement. If your clues need to tell two animals apart,
give them different names.

Each animal is shown with its name underneath, both in New Arrivals and in
an enclosure.

**Artwork:** each animal's picture comes from `public/zoorganizer/animals/`.
The sprite is chosen from the animal's name (lowercase, spaces become dashes):

1. If there is a sprite with exactly that name, it is used:
   `Snow Leopard` uses `snow-leopard.png`.
2. Otherwise the longest sprite name that the animal's name **ends with** is
   used. So you can give animals their own names with an adjective in front:
   `Bossy Baboon` and `Grumpy Baboon` both use `baboon.png`, and
   `Hungry Orangutan` uses `orangutan.png`. (`Golden Lion Tamarin` uses
   `golden-lion-tamarin.png`; it would never pick `lion.png`, because the
   name doesn't end with "Lion".)

When the build runs it lists which animals share a sprite, e.g.
`sprites: Bossy Baboon -> baboon`, so you can check it picked the right one.
An animal with no matching sprite is shown as a plain crate with a "?" (and
the build prints a reminder).

Sprites so far: lion, zebra, camel, penguin, goat, fossa, monitor lizard,
snowy owl, ring-tailed lemur, brown bear, snake-necked turtle, baboon,
gorilla, chimpanzee, orangutan, gibbon, golden lion tamarin, pygmy marmoset.

### `[solution]`

Exactly one `[solution]` section: every puzzle has exactly one correct
arrangement, and the game accepts only that one. One line per enclosure:
the enclosure's letter, then the numbers of the animals that belong there,
e.g. `C: 4, 6`. Enclosures you leave out (or write as `C:`) must be empty.
Every animal must be placed exactly once.

The build can't read clues written in plain English, so it can't tell whether
your clues really lead to only this arrangement. That depends on writing the
clues carefully (the `Test` puzzle was checked by trying every possible
arrangement against its clues).

## Testing a puzzle

Every puzzle must have exactly one solution. To check, run:

```
npm run zoo-test expert      # checks puzzles/zoorganizer/Expert.txt
npm run zoo-test             # checks every puzzle
```

The test tries every possible way of putting the animals in the enclosures,
keeps each arrangement that follows all of the puzzle's `[rules]`, and lists
them. It passes when there is exactly **one**, and it is your `[solution]`:

```
=== Expert  (puzzles/zoorganizer/Expert.txt)
  12 animals, 8 enclosures, 17 rules
  ok    Your [solution] follows every rule.
  PASS  Exactly 1 possible solution, and it is your [solution].
```

If there is more than one, each is listed (with what differs from your
`[solution]`), so you can see which clue needs tightening. The first 50 are
shown; add `-- --all` to list all of them (`npm run zoo-test expert -- --all`).
If your `[solution]` breaks a rule, the test tells you which line, which
usually means a typo in a rule or in the solution.

### The `[rules]` section

The test can't read English, so each puzzle also lists its clues as rules in
a simple, exact form. **The test checks the rules, not the `[clues]`**, so
whenever you change a clue, change its rule too. Players never see the rules.

Put `[rules]` after `[clues]`. Animals are referred to by their number from
`[animals]`; places by ground type (`jungle`) or enclosure letter (`F`).
Anything after `#` is a note for yourself.

```
[rules]
group predators: 1, 5                # name a set of animals...
group prey: all except predators     # ...("all except", ranges like 1-5 work too)
2 in sand                       # Monitor Lizard: somewhere sandy...
2 with no predators             # ...without any predators
3 next to at least 4 animals    # Snowy Owl: next door to at least 4 other animals
4 with at least 1 prey          # Lemur: a friend who is not a predator
5 alone                         # Brown Bear: can't be trusted with anybody
5 not in jungle
nobody in water                 # Everyone: none of us can swim
```

| Rule | Meaning |
|------|---------|
| `4 in jungle` / `4 in jungle, grass` | animal 4 lives on one of these ground types |
| `4 in F` / `4 in B, F` | animal 4 lives in one of these enclosures |
| `4 not in water` | animal 4 does not live on water (or `not in C`) |
| `nobody in water` | no animal lives on water |
| `5 alone` | nobody else is in animal 5's enclosure |
| `2 with 1` / `2 not with 1` | animals 2 and 1 share (don't share) an enclosure |
| `4 next to 6` / `3 not next to 12` | their enclosures are (aren't) next door |
| `1 with at least 2 baboons` | how many **other** animals of a group share its enclosure |
| `12 next to at most 3 animals` | how many animals of a group live in the enclosures next door |

- Amounts: `no`, `at least 2`, `at most 2`, `exactly 2`, `2 or more`, `2 or fewer`.
- Groups: `animals` (everyone) is built in; make others with `group name: ...`.
  A group can be used as the subject too: `baboons not in water`.
- "Next door" means sharing a fence, as in the rules shown to players;
  `next door to` works as well as `next to`.
- If a clue can't be written as a rule, write the closest rule you can. Any
  mistake in a rule stops the build and points at the line.

Animals with the same name count as interchangeable (like the game), so two
penguins swapping places is not counted as a second solution.
