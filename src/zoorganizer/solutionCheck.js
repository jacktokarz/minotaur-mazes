/**
 * Solution checking for zoOrganizer.
 *
 * The published puzzle data never contains the answer in plain text. At
 * build time the solution is turned into a short fingerprint (hash);
 * in the browser the player's arrangement is fingerprinted the same way
 * and compared. This keeps the answer out of view-source / dev tools.
 *
 * (It is not unbreakable: a determined player could write a program to
 * try every arrangement. It just stops casual peeking.)
 *
 * Used by both scripts/build-zoo-puzzles.mjs and the game page.
 */

/**
 * A stable text form of an arrangement. Animals of the same species are
 * interchangeable, and the order inside an enclosure doesn't matter.
 *
 * @param {Record<string, string[]>} placement  enclosureId -> species list
 * @param {string[]} enclosureIds               every enclosure in the puzzle
 */
export function arrangementKey(placement, enclosureIds) {
  return [...enclosureIds]
    .sort()
    .map((id) => `${id}=${[...(placement[id] ?? [])].sort().join("+")}`)
    .join(";");
}

/** cyrb53: a small, fast 53-bit string hash (public domain, by bryc). */
function cyrb53(text, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** Fingerprint of an arrangement for a given puzzle. */
export function hashArrangement(puzzleName, placement, enclosureIds) {
  const key = arrangementKey(placement, enclosureIds);
  return cyrb53(`zoorganizer:${puzzleName.toLowerCase()}:${key}`);
}
