/**
 * Shows or hides the "this puzzle is from the Substack" banner.
 *
 * Expects this markup on the page:
 *   <aside id="source-banner" class="source-banner" hidden>
 *     <p id="source-banner-text"></p>
 *     <a id="source-banner-link" class="button button-primary">…</a>
 *   </aside>
 *
 * @param {{ url: string, text?: string } | null | undefined} source
 *   Pass null/undefined to hide the banner.
 * @param {string} defaultText  Used when source.text is not given.
 */
export function renderSourceBanner(source, defaultText) {
  const banner = document.querySelector("#source-banner");

  if (!banner) {
    return;
  }

  if (!source?.url) {
    banner.hidden = true;
    return;
  }

  const text = banner.querySelector("#source-banner-text");
  const link = banner.querySelector("#source-banner-link");

  text.replaceChildren(
    Object.assign(document.createElement("strong"), {
      textContent: "From the Professional Puzzles Substack. ",
    }),
    source.text ?? defaultText
  );

  link.href = source.url;
  banner.hidden = false;
}
