import type { Attachment } from "svelte/attachments";

/**
 * Moves a modal's root element to `<body>`.
 *
 * Pages render inside the content panel, whose `backdrop-filter` (glass) and
 * `contain: strict` (scroller) make it the containing block of any
 * `position: fixed` child. A modal left there covers only that panel, and its
 * own blur is nested inside the panel's, so it frosts nothing and the cards
 * behind it show through. From `<body>` it covers the window and blurs the app.
 *
 * Use on the single root element of an `{#if}` block or component.
 */
export const portal: Attachment<HTMLElement> = (node) => {
  document.body.append(node);
  return () => node.remove();
};
