/**
 * Finds every arrangement of animals in enclosures that follows a puzzle's
 * [rules]. Used by `npm run zoo-test`.
 *
 * This is an exhaustive search: it considers every way of putting every
 * animal in every enclosure, but skips whole groups of arrangements as soon
 * as a rule can no longer be satisfied, so even large puzzles finish quickly.
 */
import { adjacency, ruleHolds } from "./rules.mjs";

/**
 * @returns {{ solutions: object[], total: number, complete: boolean }}
 *   solutions: arrangements (animal id -> enclosure id), up to `keep` of them
 *   total:     how many were found (stops counting at `maxCount`)
 *   complete:  false if the search stopped early because of `maxCount`
 *
 * `keyOf` decides when two arrangements count as the same one (e.g. when two
 * identical animals just swap places); each different key is counted once.
 */
export function findSolutions(
  puzzle,
  rules,
  { keep = Infinity, maxCount = 1_000_000, keyOf = (at) => JSON.stringify(at) } = {}
) {
  const next = adjacency(puzzle);
  const enclosures = puzzle.enclosures.map((e) => e.id);
  const animals = puzzle.animals.map((a) => a.id);

  // Start with every enclosure possible for every animal, then apply the
  // simple "lives in ..." rules straight away.
  const domains = new Map(animals.map((a) => [a, new Set(enclosures)]));
  const others = [];

  for (const rule of rules) {
    if (rule.kind === "place") {
      for (const e of [...domains.get(rule.animal)]) {
        if (!rule.places.has(e)) domains.get(rule.animal).delete(e);
      }
    } else {
      others.push(rule);
    }
  }

  const rulesFor = new Map(animals.map((a) => [a, []]));
  for (const rule of others) {
    rulesFor.get(rule.animal).push(rule);
    if (rule.other) rulesFor.get(rule.other).push(rule);
    if (rule.members) for (const b of rule.members) rulesFor.get(b).push(rule);
  }

  const at = {};
  const seen = new Set();
  const solutions = [];
  let total = 0;
  let complete = true;

  // ---- can this rule still be satisfied, given what's been placed so far? ----
  const possible = (b, e) => (at[b] !== undefined ? at[b] === e : domains.get(b).has(e));
  const possibleNear = (b, e) => {
    if (at[b] !== undefined) return next[e].has(at[b]);
    for (const f of domains.get(b)) if (next[e].has(f)) return true;
    return false;
  };

  function countBounds(rule, e) {
    let sure = 0;
    let maybe = 0;

    for (const b of rule.members) {
      if (b === rule.animal) continue;
      if (rule.where === "with") {
        if (at[b] !== undefined) sure += at[b] === e ? 1 : 0;
        else maybe += domains.get(b).has(e) ? 1 : 0;
      } else if (at[b] !== undefined) {
        sure += next[e].has(at[b]) ? 1 : 0;
      } else {
        maybe += possibleNear(b, e) ? 1 : 0;
      }
    }

    return [sure, sure + maybe];
  }

  function stillPossible(rule) {
    const options = at[rule.animal] !== undefined ? [at[rule.animal]] : [...domains.get(rule.animal)];

    return options.some((e) => {
      if (rule.kind === "count") {
        const [low, high] = countBounds(rule, e);
        return low <= rule.max && high >= rule.min;
      }

      const b = rule.other;
      switch (rule.relation) {
        case "with":
          return possible(b, e);
        case "not with":
          return !(at[b] !== undefined ? at[b] === e : domains.get(b).size === 1 && domains.get(b).has(e));
        case "next":
          return possibleNear(b, e);
        case "not next":
          return at[b] !== undefined ? !next[e].has(at[b]) : [...domains.get(b)].some((f) => !next[e].has(f));
        default:
          return true;
      }
    });
  }

  // Place the most restricted animals first.
  const order = [...animals].sort(
    (a, b) => domains.get(a).size - domains.get(b).size || rulesFor.get(b).length - rulesFor.get(a).length
  );

  function search(index) {
    if (!complete) return;

    if (index === order.length) {
      // Double-check the finished arrangement against every rule.
      if (rules.every((rule) => ruleHolds(rule, at, next))) {
        const key = keyOf(at);
        if (seen.has(key)) return;
        seen.add(key);
        total += 1;
        if (solutions.length < keep) solutions.push({ ...at });
        if (total >= maxCount) complete = false;
      }
      return;
    }

    const a = order[index];

    for (const e of domains.get(a)) {
      at[a] = e;
      if (rulesFor.get(a).every(stillPossible)) search(index + 1);
      delete at[a];
      if (!complete) return;
    }
  }

  search(0);
  return { solutions, total, complete };
}
