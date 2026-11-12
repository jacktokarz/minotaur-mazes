/**
 * The [rules] section of a zoOrganizer puzzle: the clues written in a small,
 * exact language that `npm run zoo-test` can check.
 *
 * See puzzles/zoorganizer/README.md ("Testing a puzzle") for the full list.
 *
 *   group predators: 1, 5          name a set of animals
 *   group prey: all except predators
 *   2 in sand                      animal 2 lives on sand
 *   2 with no predators            ...and shares with no predator
 *   3 next to at least 4 animals   4+ animals in the enclosures next door
 *   5 alone                        nobody else in animal 5's enclosure
 *   1 in F                         a specific enclosure (by its letter)
 *   nobody in water
 */
import { PuzzleError, TERRAINS } from "../../src/zoorganizer/puzzleParser.js";

const NUMBER_WORDS = { no: 0, none: 0, zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

// "with at least 2 baboons", "next to no predators", "with 2 or more animals", ...
const AMOUNT = "(no|none|at least \\w+|at most \\w+|exactly \\w+|\\w+ or more|\\w+ or (?:fewer|less))";
const AMOUNT_RULE = new RegExp(`^(with|next to) ${AMOUNT} (.+)$`);

function toNumber(word) {
  if (/^\d+$/.test(word)) return Number(word);
  return NUMBER_WORDS[word] ?? null;
}

/** Which enclosures are next door to which (they share a fence). */
export function adjacency(puzzle) {
  const next = Object.fromEntries(puzzle.enclosures.map((e) => [e.id, new Set()]));
  const grid = puzzle.grid;

  grid.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
        const other = grid[ny]?.[nx];
        if (next[cell] && next[other] && other !== cell) {
          next[cell].add(other);
          next[other].add(cell);
        }
      }
    });
  });

  return next;
}

/**
 * Parse and check the [rules] section.
 * Returns { rules: [...], groups } or null if the puzzle has no [rules].
 *
 * Each rule is one of:
 *   { kind: "place",  animal, places: Set(enclosure ids) }
 *   { kind: "count",  animal, where: "with" | "next", members: [ids], min, max }
 *   { kind: "pair",   animal, other, relation: "with" | "not with" | "next" | "not next" }
 * and has `line` and `text` so problems can be reported.
 */
export function parseRules(puzzle) {
  if (!puzzle.rules) return null;

  const animalIds = new Set(puzzle.animals.map((a) => a.id));
  const allAnimals = [...animalIds];
  const enclosureIds = puzzle.enclosures.map((e) => e.id);
  const groups = new Map();
  const rules = [];

  for (const { text: rawText, number: line } of puzzle.rules) {
    // Allow notes after a rule: "1 in F   # the bigger rock enclosure"
    const text = rawText.replace(/\s#.*$/, "").replace(/\s+/g, " ").replace(/\.$/, "").trim();
    const lower = text.toLowerCase();
    const fail = (message) => {
      throw new PuzzleError(`In [rules], "${text}": ${message}`, line);
    };

    // ---- helpers that need `fail` ----------------------------------------
    const animal = (word) => {
      const id = Number(word);
      if (!/^\d+$/.test(word) || !animalIds.has(id)) {
        fail(`"${word}" is not an animal number from [animals].`);
      }
      return id;
    };

    const group = (word) => {
      const name = word.toLowerCase();
      if (["animal", "animals", "other animal", "other animals", "others", "all", "everyone"].includes(name)) {
        return allAnimals;
      }
      for (const candidate of [name, name.replace(/s$/, ""), `${name}s`]) {
        if (groups.has(candidate)) return groups.get(candidate);
      }
      if (/^\d+$/.test(name)) return [animal(name)];
      fail(`"${word}" is not a group. Define it first, e.g. "group ${name}: 1, 2".`);
    };

    const memberList = (listText) => {
      const [includePart, excludePart] = listText.split(/\bexcept\b/i);
      const collect = (part) => {
        const ids = new Set();
        for (const item of part.split(",").map((s) => s.trim()).filter(Boolean)) {
          const range = item.match(/^(\d+)\s*-\s*(\d+)$/);
          if (range) {
            for (let id = Number(range[1]); id <= Number(range[2]); id += 1) ids.add(animal(String(id)));
          } else {
            for (const id of group(item)) ids.add(id);
          }
        }
        return ids;
      };
      const include = collect(includePart);
      if (excludePart !== undefined) {
        for (const id of collect(excludePart)) include.delete(id);
      }
      return [...include].sort((a, b) => a - b);
    };

    const places = (listText) => {
      const result = new Set();
      for (const item of listText.split(",").map((s) => s.trim()).filter(Boolean)) {
        const lowerItem = item.toLowerCase();
        if (TERRAINS.includes(lowerItem)) {
          for (const e of puzzle.enclosures) if (e.terrain === lowerItem) result.add(e.id);
        } else if (enclosureIds.includes(item.toUpperCase()) && item.length === 1) {
          result.add(item.toUpperCase());
        } else {
          fail(`"${item}" is not a ground type (${TERRAINS.join(", ")}) or an enclosure letter.`);
        }
      }
      return result;
    };

    const quantity = (words) => {
      // "no", "at least 2", "at most 4", "exactly 1", "2 or more", "2 or fewer"
      let m;
      if ((m = words.match(/^(no|none)$/))) return [0, 0];
      if ((m = words.match(/^at least (\w+)$/)) && toNumber(m[1]) !== null) return [toNumber(m[1]), Infinity];
      if ((m = words.match(/^at most (\w+)$/)) && toNumber(m[1]) !== null) return [0, toNumber(m[1])];
      if ((m = words.match(/^exactly (\w+)$/)) && toNumber(m[1]) !== null) return [toNumber(m[1]), toNumber(m[1])];
      if ((m = words.match(/^(\w+) or more$/)) && toNumber(m[1]) !== null) return [toNumber(m[1]), Infinity];
      if ((m = words.match(/^(\w+) or (fewer|less)$/)) && toNumber(m[1]) !== null) return [0, toNumber(m[1])];
      return null;
    };

    // ---- group definitions -------------------------------------------------
    const groupMatch = text.match(/^group\s+([a-z][a-z -]*?)\s*:\s*(.+)$/i);
    if (groupMatch) {
      const name = groupMatch[1].toLowerCase();
      if (groups.has(name)) fail(`the group "${name}" is defined twice.`);
      const members = memberList(groupMatch[2]);
      if (!members.length) fail("the group has no animals in it.");
      groups.set(name, members);
      continue;
    }

    // ---- subject -------------------------------------------------------------
    const subjectMatch = lower.match(/^(everyone|everybody|nobody|no one|\d+|[a-z][a-z -]*?)\s+(alone|not |in |with |next |is |lives )/);
    if (!subjectMatch) {
      fail('expected a rule like "4 in jungle", "5 alone" or "3 next to at least 2 animals".');
    }

    const subjectWord = subjectMatch[1];
    let condition = lower.slice(subjectWord.length).trim().replace(/^(is|lives)\s+/, "");
    let subjects;
    let negateSubject = false;

    if (["everyone", "everybody"].includes(subjectWord)) subjects = allAnimals;
    else if (["nobody", "no one"].includes(subjectWord)) { subjects = allAnimals; negateSubject = true; }
    else if (/^\d+$/.test(subjectWord)) subjects = [animal(subjectWord)];
    else subjects = group(subjectWord);

    // "next door to" means the same as "next to"
    condition = condition.replace(/\bnext door to\b/g, "next to");

    const base = { line, text };
    const add = (rule) => {
      for (const a of subjects) rules.push({ ...base, ...rule, animal: a });
    };

    let m;
    if (negateSubject) {
      if (!(m = condition.match(/^in (.+)$/))) fail('"nobody" can only be used as "nobody in <places>".');
      const bad = places(text.slice(text.toLowerCase().indexOf(" in ") + 4));
      add({ kind: "place", places: new Set(enclosureIds.filter((id) => !bad.has(id))) });
    } else if (condition === "alone") {
      add({ kind: "count", where: "with", members: allAnimals, min: 0, max: 0 });
    } else if ((m = condition.match(/^(not )?in (.+)$/))) {
      const listed = places(text.slice(text.toLowerCase().lastIndexOf(" in ") + 4));
      add({
        kind: "place",
        places: m[1] ? new Set(enclosureIds.filter((id) => !listed.has(id))) : listed,
      });
    } else if ((m = condition.match(/^(not )?(with|next to) (\d+)$/))) {
      const other = animal(m[3]);
      if (subjects.includes(other) && subjects.length === 1) fail("an animal can't be compared with itself.");
      const relation = `${m[1] ? "not " : ""}${m[2] === "with" ? "with" : "next"}`;
      add({ kind: "pair", other, relation });
    } else if ((m = condition.match(AMOUNT_RULE))) {
      const range = quantity(m[2]);
      if (!range) {
        fail(`"${m[2]}" is not an amount. Use "no", "at least 2", "at most 2" or "exactly 2".`);
      }
      const who = m[3].replace(/^other /, "");
      const members = /^\d/.test(who) ? memberList(who) : group(who);
      add({ kind: "count", where: m[1] === "with" ? "with" : "next", members, min: range[0], max: range[1] });
    } else if ((m = condition.match(/^(with|next to) (.+)$/))) {
      const counted = m[2].match(/^(\w+) (.+)$/);
      const n = counted ? toNumber(counted[1]) : null;
      if (n !== null) {
        fail(
          `say which amount you mean: "${m[1]} exactly ${n} ${counted[2]}", ` +
            `"${m[1]} at least ${n} ${counted[2]}" or "${m[1]} at most ${n} ${counted[2]}".`
        );
      }
      fail(
        `"${m[2]}" needs an amount, like "${m[1]} at least 2 ${m[2]}", "${m[1]} exactly 1 ${m[2]}" ` +
          `or "${m[1]} no ${m[2]}". (To mean one particular animal, use its number: "${m[1]} 3".)`
      );
    } else {
      fail(
        'not understood. Rules look like "4 in jungle", "4 not in water", "5 alone", ' +
          '"2 with 1", "3 not next to 12", "4 with at least 1 prey", "6 next to at most 4 animals".'
      );
    }
  }

  return { rules, groups };
}

/** Does a complete arrangement (animal id -> enclosure id) follow this rule? */
export function ruleHolds(rule, at, next) {
  const here = at[rule.animal];

  switch (rule.kind) {
    case "place":
      return rule.places.has(here);
    case "pair": {
      const there = at[rule.other];
      if (rule.relation === "with") return here === there;
      if (rule.relation === "not with") return here !== there;
      if (rule.relation === "next") return next[here].has(there);
      return !next[here].has(there);
    }
    case "count": {
      const count = rule.members.filter((b) =>
        b !== rule.animal && (rule.where === "with" ? at[b] === here : next[here].has(at[b]))
      ).length;
      return count >= rule.min && count <= rule.max;
    }
    default:
      throw new Error(`unknown rule kind ${rule.kind}`);
  }
}
