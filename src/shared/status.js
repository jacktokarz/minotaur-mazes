/**
 * The status message under each puzzle board (next to the buttons).
 *
 *   import { createStatus } from "../shared/status.js";
 *   const setStatus = createStatus(document.querySelector("#game-status"));
 *   setStatus("Your turn.");
 *   setStatus("Not quite right.", "lost");
 *
 * Types: ""        normal message
 *        "won"     solved (green, with a tick)
 *        "lost"    wrong / caught (red, with a cross, and a shake)
 *        "warning" not allowed right now, e.g. a limit was reached (amber)
 *        "error"   something failed to load
 *
 * Results ("won", "lost", "warning") replay their animation every time, even
 * if the same message is shown twice in a row, and the message is scrolled
 * into view if it's off screen.
 */

const RESULT_TYPES = new Set(["won", "lost", "warning"]);

export function createStatus(element) {
  return function setStatus(message, type = "") {
    element.textContent = message;
    element.dataset.state = type;

    if (!RESULT_TYPES.has(type)) return;

    // Restart the animation.
    element.classList.remove("status-pop");
    void element.offsetWidth;
    element.classList.add("status-pop");

    const box = element.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }
  };
}
