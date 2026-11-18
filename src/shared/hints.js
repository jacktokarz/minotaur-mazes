/**
 * The Hint button and hint dialog, shared by every puzzle page.
 *
 * What the player sees:
 *   1. The Hint button unlocks once the puzzle has been on screen for
 *      30 seconds (it counts down until then).
 *   2. Clicking it asks if they're sure they want a minor hint.
 *      "No" closes the dialog and the button stays available.
 *      "Yes" shows the minor hint.
 *   3. After that, the button is always available (no second wait). Clicking
 *      it shows the minor hint again and offers the major hint. If they
 *      accept, the major hint appears below the minor one.
 *   4. From then on, the button just shows both hints again.
 *
 * Only time with the page visible counts, so a puzzle left open in a
 * background tab doesn't unlock its hints.
 *
 * Using it on a puzzle page:
 *
 *   HTML (usually inside .game-buttons):
 *     <button id="hint-button" type="button" hidden>Hint</button>
 *
 *   JS:
 *     import { createHints } from "../shared/hints.js";
 *     const hints = createHints(document.querySelector("#hint-button"));
 *
 *     // Every time a puzzle is loaded (this also restarts the 30 seconds):
 *     hints.load({ minor: "…", major: "…" });
 *
 * Each hint is a string, or an array of strings to show several paragraphs.
 * Hints are optional: call hints.load(null) for a puzzle without hints and
 * the button stays hidden.
 *
 * The dialog's CSS lives in src/shared/game.css ("Hints").
 */

export const HINT_DELAY_MS = 30_000;

const TEXT = {
  offerMinor:
    "This is a minor hint: a small nudge in the right direction, not the " +
    "answer. Are you sure you want it?",
  offerMajor:
    "Still stuck? The major hint tells you exactly what to do for part of " +
    "the puzzle. Are you sure you want it?",
};

// Where the player is in the hint sequence.
const STAGE = {
  MINOR_LOCKED: "minor-locked", // counting down to the minor hint
  MINOR_READY: "minor-ready",   // minor hint can be requested
  MAJOR_READY: "major-ready",   // minor hint seen; major hint can be requested
  DONE: "done",                 // both hints revealed
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function paragraphs(hint) {
  return (Array.isArray(hint) ? hint : [hint]).filter(Boolean);
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * @param {HTMLButtonElement} button  The page's Hint button.
 * @param {{ delayMs?: number }} [options]
 */
export function createHints(button, { delayMs = HINT_DELAY_MS } = {}) {
  if (!button) {
    console.warn("Hints: no hint button found on this page.");
    return { load() {} };
  }

  let hints = null;
  let stage = STAGE.MINOR_LOCKED;

  // Countdown: time left, and when it was last updated.
  let remaining = 0;
  let lastTick = 0;
  let timer = null;

  // ------------------------------------------------------------
  // Dialog
  // ------------------------------------------------------------

  const dialog = element("dialog", "hint-dialog");
  dialog.setAttribute("aria-labelledby", "hint-dialog-title");

  // The panel fills the dialog, so a click on the dialog element itself
  // is a click on the backdrop.
  const panel = element("div", "hint-dialog-panel");
  const header = element("div", "hint-dialog-header");
  const title = element("h2", "hint-dialog-title");
  title.id = "hint-dialog-title";

  const closeButton = element("button", "hint-dialog-close", "\u00d7");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.addEventListener("click", () => closeDialog());

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  const body = element("div", "hint-dialog-body");
  const actions = element("div", "hint-dialog-actions");

  header.append(title, closeButton);
  panel.append(header, body, actions);
  dialog.append(panel);
  document.body.append(dialog);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  // Keep key presses inside the dialog from reaching the puzzle
  // (e.g. arrow keys moving Theseus behind the dialog).
  dialog.addEventListener("keydown", (event) => event.stopPropagation());

  function hintBlock(label, hint, kind) {
    const block = element("section", `hint-block hint-block-${kind}`);
    block.append(element("h3", "hint-block-label", label));
    for (const text of paragraphs(hint)) {
      block.append(element("p", "", text));
    }
    return block;
  }

  function actionButton(label, onClick, primary = false) {
    const node = element("button", `button${primary ? " button-primary" : ""}`, label);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  /**
   * Show one of the dialog's screens:
   *   "offer-minor"  Are you sure you want a minor hint?
   *   "minor"        The minor hint.
   *   "offer-major"  The minor hint, and: do you want the major hint?
   *   "all"          Both hints.
   */
  function render(view) {
    let focus;

    body.replaceChildren();
    actions.replaceChildren();

    if (view === "offer-minor") {
      title.textContent = "Want a hint?";
      body.append(element("p", "hint-question", TEXT.offerMinor));

      focus = actionButton("No, I've got this", closeDialog);
      actions.append(
        focus,
        actionButton("Yes, give me a hint", () => {
          stage = STAGE.MAJOR_READY;
          updateButton();
          render("minor");
        }, true)
      );
    } else if (view === "minor") {
      title.textContent = "Here's a nudge";
      body.append(hintBlock("Minor hint", hints.minor, "minor"));

      focus = actionButton("Back to the puzzle", closeDialog, true);
      actions.append(focus);
    } else if (view === "offer-major") {
      title.textContent = "Need more help?";
      body.append(
        hintBlock("Minor hint", hints.minor, "minor"),
        element("p", "hint-question", TEXT.offerMajor)
      );

      focus = actionButton("No, I'll keep trying", closeDialog);
      actions.append(
        focus,
        actionButton("Yes, show me", () => {
          stage = STAGE.DONE;
          updateButton();
          render("all");

          // On small screens the major hint can start below the fold.
          const major = body.querySelector(".hint-block-major");
          body.scrollTop = major.offsetTop - body.clientTop - 12;
        }, true)
      );
    } else {
      title.textContent = "Hints";
      body.append(
        hintBlock("Minor hint", hints.minor, "minor"),
        hintBlock("Major hint", hints.major, "major")
      );

      focus = actionButton("Back to the puzzle", closeDialog, true);
      actions.append(focus);
    }

    body.scrollTop = 0;

    // showModal() focuses the [autofocus] element; if the dialog is already
    // open (switching screens), move focus ourselves.
    focus.autofocus = true;
    if (dialog.open) focus.focus();
  }

  function open() {
    if (!hints || button.disabled) return;

    if (stage === STAGE.MINOR_READY) render("offer-minor");
    else if (stage === STAGE.MAJOR_READY) render("offer-major");
    else if (stage === STAGE.DONE) render("all");
    else return;

    if (!dialog.open) dialog.showModal();
  }

  button.addEventListener("click", open);
  button.setAttribute("aria-haspopup", "dialog");

  // ------------------------------------------------------------
  // Button and countdown
  // ------------------------------------------------------------

  function updateButton() {
    button.disabled = stage === STAGE.MINOR_LOCKED;
    button.dataset.stage = stage;

    if (stage === STAGE.MINOR_LOCKED) {
      button.textContent = `Hint in ${formatTime(remaining)}`;
    } else if (stage === STAGE.MINOR_READY) {
      button.textContent = "Hint";
    } else {
      button.textContent = "Hints";
    }
  }

  function stopCountdown() {
    clearInterval(timer);
    timer = null;
  }

  function tick() {
    const now = performance.now();

    if (document.visibilityState === "visible") {
      remaining -= now - lastTick;
    }
    lastTick = now;

    if (remaining <= 0) {
      stopCountdown();
      stage = STAGE.MINOR_READY;
    }

    updateButton();
  }

  function startCountdown() {
    stopCountdown();
    stage = STAGE.MINOR_LOCKED;
    remaining = delayMs;
    lastTick = performance.now();
    timer = setInterval(tick, 250);
    updateButton();
  }

  // Count the visible time up to the moment the page is hidden, and skip
  // the time it spent hidden.
  document.addEventListener("visibilitychange", () => {
    if (!timer) return;

    const now = performance.now();
    if (document.visibilityState === "hidden") {
      remaining -= now - lastTick;
    }
    lastTick = now;
  });

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------

  return {
    /**
     * Set the hints for the puzzle that was just loaded and restart the
     * countdown. Pass null (or hints without a minor and major hint) to
     * hide the button.
     *
     * @param {{ minor: string | string[], major: string | string[] } | null} puzzleHints
     */
    load(puzzleHints) {
      const usable =
        puzzleHints &&
        paragraphs(puzzleHints.minor).length > 0 &&
        paragraphs(puzzleHints.major).length > 0;

      hints = usable ? puzzleHints : null;

      stopCountdown();
      stage = STAGE.MINOR_LOCKED;
      closeDialog();

      button.hidden = !hints;

      if (hints) {
        startCountdown();
      } else if (puzzleHints) {
        console.warn("Hints need both a minor and a major hint.", puzzleHints);
      }
    },
  };
}
