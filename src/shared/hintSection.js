/**
 * Reads the optional [hints] section of a puzzle file (used at build time by
 * every puzzle type whose puzzles are text files):
 *
 *   [hints]
 *   minor: A general idea of the strategy.
 *   major: A specific step that gets the player partway there.
 *   major: Repeat minor: or major: to add another paragraph.
 *
 * Returns { minor: [paragraphs], major: [paragraphs] }, the shape
 * src/shared/hints.js expects.
 *
 * @param {{ text: string, number: number }[]} lines  The section's lines.
 * @param {number} sectionLine  Line number of the [hints] header.
 * @param {(message: string, line?: number) => never} fail
 *   Throws the caller's error type, so messages include the line number.
 */
export function parseHintSection(lines, sectionLine, fail) {
  const hints = { minor: [], major: [] };

  for (const line of lines) {
    if (!line.text.trim()) continue;

    const match = line.text.trim().match(/^(minor|major)\s*:\s*(.*)$/i);

    if (!match) {
      fail(`Expected a hint like "minor: ..." or "major: ...", found "${line.text.trim()}".`, line.number);
    }

    const kind = match[1].toLowerCase();

    if (!match[2].trim()) {
      fail(`The ${kind} hint is empty.`, line.number);
    }

    hints[kind].push(match[2].trim());
  }

  for (const kind of ["minor", "major"]) {
    if (hints[kind].length === 0) {
      fail(`The [hints] section needs a ${kind} hint, like "${kind}: ...".`, sectionLine);
    }
  }

  return hints;
}
